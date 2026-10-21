/**
 * Simula personas sintéticas dentro de una sala, para demostrar la capacidad (TRL-07) y el
 * movimiento compartido sin abrir diez navegadores. Requiere el backend en marcha (npm run dev).
 *
 *   npm run salas:simular                                    → 9 en «Bienestar cotidiano» de la comunidad B
 *   npm run salas:simular -- --cantidad 10 --sala "Vida académica" --comunidad B
 *   npm run salas:simular -- --cantidad 1 --desde 10        → solo Simulado_010 (p. ej. la persona 11)
 *
 * Crea (o reutiliza) usuarios `Simulado_001…` del rango indicado, los conecta por WebSocket
 * como cualquier cliente y los mueve al azar. Ctrl+C los saca de la sala.
 */
import { parseArgs } from 'node:util';
import WebSocket from 'ws';
import { cargarConfig } from '../src/config/env.js';
import { crearPool } from '../src/db/database.js';
import { crearLogger } from '../src/lib/logger.js';
import { NOMBRE_COOKIE_SESION } from '../src/modules/seguridad/sesion.middleware.js';
import { crearToken } from '../src/modules/seguridad/sesion.token.js';

const { values } = parseArgs({
  options: {
    cantidad: { type: 'string', default: '9' },
    desde: { type: 'string', default: '1' },
    sala: { type: 'string', default: 'Bienestar cotidiano' },
    comunidad: { type: 'string', default: 'B' },
  },
});

const cantidad = Math.min(Math.max(Number(values.cantidad) || 9, 1), 20);
const desde = Math.min(Math.max(Number(values.desde) || 1, 1), 99);
const rango = values.comunidad.toUpperCase();
const config = cargarConfig();
const logger = crearLogger('info');

if (config.sesion.secretoGenerado) {
  logger.error('Define SESSION_SECRET en el .env: el backend y este script deben firmar igual.');
  process.exit(1);
}

const pool = crearPool(config.baseDeDatos);
const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

const { rows: salas } = await pool.query<{ id: string; nombre: string }>(
  `select s.id_sala as id, s.nombre
   from app.sala s join app.comunidad c using (id_comunidad)
   where c.rango_edad = $1 and s.nombre = $2 and s.estado <> 'cerrada'`,
  [rango, values.sala],
);
const sala = salas[0];
if (!sala) {
  logger.error(`No hay una sala abierta «${values.sala}» en la comunidad ${rango}.`);
  await pool.end();
  process.exit(1);
}

// Usuarios sintéticos del mismo rango que la sala (no aparecen en el selector de acceso).
const usuarios: { id: string; alias: string }[] = [];
for (let i = desde; i < desde + cantidad; i++) {
  const numero = String(i).padStart(3, '0');
  const { rows } = await pool.query<{ id: string; alias: string }>(
    `insert into app.usuario (codigo, alias, rol, rango_edad)
     values ($1, $2, 'usuario', $3)
     on conflict (codigo) do update set rango_edad = excluded.rango_edad, estado = 'activo'
     returning id_usuario as id, alias`,
    [`Simulado_${numero}`, `Simulado${numero}`, rango],
  );
  await pool.query(
    `insert into app.configuracion_avatar (id_usuario, id_personaje)
     values ($1, $2) on conflict (id_usuario) do nothing`,
    [rows[0]!.id, ['base-azul', 'base-verde', 'base-coral'][i % 3]],
  );
  usuarios.push(rows[0]!);
}

logger.info(`Conectando ${cantidad} personas simuladas a «${sala.nombre}» (comunidad ${rango})…`);
const conexiones: WebSocket[] = [];
for (const usuario of usuarios) {
  const token = crearToken(usuario.id, config.sesion.secreto, 2 * 60 * 60 * 1000);
  const ws = new WebSocket(`ws://localhost:${config.puerto}/ws/salas/${sala.id}`, {
    headers: { Cookie: `${NOMBRE_COOKIE_SESION}=${token}` },
  });
  ws.on('message', (datos) => {
    const mensaje = JSON.parse(datos.toString()) as {
      tipo: string;
      ocupacion?: number;
      mensaje?: string;
    };
    if (mensaje.tipo === 'estado') logger.info(`${usuario.alias} entró (${mensaje.ocupacion}/10)`);
    if (mensaje.tipo === 'error') logger.warn(`${usuario.alias}: ${mensaje.mensaje}`);
  });
  ws.on('error', (error) => logger.error(`${usuario.alias}: ${error.message}`));
  conexiones.push(ws);
  await esperar(300);
}

const direcciones = ['arriba', 'abajo', 'izquierda', 'derecha'];
const paseo = setInterval(() => {
  for (const ws of conexiones) {
    if (ws.readyState === ws.OPEN && Math.random() < 0.5) {
      const direccion = direcciones[Math.floor(Math.random() * direcciones.length)];
      ws.send(JSON.stringify({ tipo: 'mover', direccion }));
    }
  }
}, 1500);

logger.info('Listo. Pulsa Ctrl+C para sacarlos de la sala.');
process.on('SIGINT', () => {
  clearInterval(paseo);
  for (const ws of conexiones) ws.close(1000, 'SALIDA');
  void esperar(1000)
    .then(() => pool.end())
    .then(() => process.exit(0));
});
