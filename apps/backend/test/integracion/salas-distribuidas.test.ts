/**
 * Salas con dos procesos backend independientes que comparten Redis y la base de pruebas
 * (npm run test:db, con npm run redis:local): la prueba de que las salas no dependen de la
 * memoria de una instancia. Sin Redis, se omite diciendo por qué.
 *
 * Aquí las escrituras sí se confirman (son otros procesos): se usan cuentas sintéticas propias,
 * que se borran al terminar, y las salas usadas quedan como estaban.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from 'redis';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { cargarConfig } from '../../src/config/env.js';
import { crearPool, type PoolDeDatos } from '../../src/db/database.js';
import type { MensajeServidor } from '../../src/modules/salas/salas.protocolo.js';
import { abrirSesionInterna } from '../../src/modules/seguridad/sesion.service.js';
import { hasta, ORIGEN_FRONTEND, redisDisponible, URL_REDIS_PRUEBAS } from '../apoyo.js';

const SECRETO = 'secreto-solo-para-pruebas-distribuidas-00000000';
const PRESENCIA_SEGUNDOS = 3;
const prefijo = `prueba-distribuida:${randomUUID()}:`;
const directorioBackend = fileURLToPath(new URL('../../', import.meta.url));
const cliTsx = path.join(
  path.dirname(createRequire(import.meta.url).resolve('tsx/package.json')),
  'dist',
  'cli.mjs',
);
const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

type Instancia = { puerto: number; proceso: ChildProcess; salida: string[] };

function puertoLibre() {
  return new Promise<number>((resolver, rechazar) => {
    const sonda = createServer();
    sonda.once('error', rechazar);
    sonda.listen(0, '127.0.0.1', () => {
      const { port } = sonda.address() as { port: number };
      sonda.close(() => resolver(port));
    });
  });
}

/** Un proceso backend real (src/server.ts) con la configuración de esta prueba. */
async function levantar(extra: Record<string, string> = {}): Promise<Instancia> {
  const puerto = await puertoLibre();
  const salida: string[] = [];
  const proceso = spawn(process.execPath, [cliTsx, 'src/server.ts'], {
    cwd: directorioBackend,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      BACKEND_PORT: String(puerto),
      SESSION_SECRET: SECRETO,
      FRONTEND_ORIGIN: ORIGEN_FRONTEND,
      REDIS_URL: URL_REDIS_PRUEBAS,
      REDIS_PREFIJO: prefijo,
      SALAS_LATIDO_SEGUNDOS: '1',
      SALAS_PRESENCIA_SEGUNDOS: String(PRESENCIA_SEGUNDOS),
      SALA_CIERRE_SEGUNDOS: '3600',
      LOG_LEVEL: 'warn',
      ...extra,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proceso.stdout!.on('data', (d) => salida.push(String(d)));
  proceso.stderr!.on('data', (d) => salida.push(String(d)));
  const inicio = Date.now();
  for (;;) {
    try {
      const respuesta = await fetch(`http://127.0.0.1:${puerto}/api/salud`);
      if (respuesta.ok) return { puerto, proceso, salida };
    } catch {
      // Todavía arrancando.
    }
    if (proceso.exitCode !== null || Date.now() - inicio > 60_000) {
      throw new Error(`La instancia no arrancó:\n${salida.join('')}`);
    }
    await esperar(200);
  }
}

async function detener(instancia: Instancia | undefined) {
  if (!instancia || instancia.proceso.exitCode !== null) return;
  const fin = new Promise((resolver) => instancia.proceso.once('exit', resolver));
  instancia.proceso.kill();
  await fin;
}

function conectar(instancia: Instancia, idSala: string, token?: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${instancia.puerto}/ws/salas/${idSala}`, {
    headers: token ? { Cookie: `sesion=${token}` } : {},
  });
  const mensajes: MensajeServidor[] = [];
  ws.on('message', (datos) => mensajes.push(JSON.parse(datos.toString())));
  ws.on('error', () => {});
  const cierre = new Promise<number>((resolver) => ws.on('close', (codigo) => resolver(codigo)));

  async function esperarMensaje<T extends MensajeServidor['tipo']>(
    tipo: T,
    condicion: (m: Extract<MensajeServidor, { tipo: T }>) => boolean = () => true,
    limiteMs = 10_000,
  ) {
    const inicio = Date.now();
    for (;;) {
      const encontrado = mensajes.find(
        (m) => m.tipo === tipo && condicion(m as Extract<MensajeServidor, { tipo: T }>),
      );
      if (encontrado) return encontrado as Extract<MensajeServidor, { tipo: T }>;
      if (Date.now() - inicio > limiteMs) throw new Error(`No llegó «${tipo}»`);
      await esperar(20);
    }
  }
  const de = <T extends MensajeServidor['tipo']>(tipo: T) =>
    mensajes.filter((m): m is Extract<MensajeServidor, { tipo: T }> => m.tipo === tipo);

  return {
    ws,
    mensajes,
    cierre,
    esperar: esperarMensaje,
    de,
    enviar: (mensaje: object) => ws.send(JSON.stringify(mensaje)),
  };
}

const hayRedis = await redisDisponible();

describe.skipIf(!hayRedis)('Salas con dos instancias del backend y Redis compartido', () => {
  let pool: PoolDeDatos;
  let uno: Instancia;
  let dos: Instancia;
  const extras: Instancia[] = [];
  const usuarios: { id: string; alias: string }[] = [];
  const tokens: Record<string, string> = {};
  let sala: string;
  let otraSala: string;
  let salaAjena: string;
  const abiertas: ReturnType<typeof conectar>[] = [];
  const abrir = (...args: Parameters<typeof conectar>) => {
    const c = conectar(...args);
    abiertas.push(c);
    return c;
  };

  const ocupacion = async (idSala: string) =>
    (
      await pool.query<{ usuarios_actuales: number }>(
        'select usuarios_actuales from app.sala where id_sala = $1',
        [idSala],
      )
    ).rows[0]!.usuarios_actuales;

  beforeAll(async () => {
    pool = crearPool(cargarConfig().baseDeDatos);
    const { rows: salas } = await pool.query<{ clave: string; id: string }>(
      `select c.rango_edad || ':' || s.nombre as clave, s.id_sala as id
       from app.sala s join app.comunidad c using (id_comunidad) where s.estado <> 'cerrada'`,
    );
    const porClave = Object.fromEntries(salas.map((s) => [s.clave, s.id]));
    sala = porClave['B:Bienestar cotidiano']!;
    otraSala = porClave['B:Vida académica']!;
    salaAjena = porClave['C:Bienestar cotidiano']!;

    for (const nombre of ['Ana', 'Beto', 'Caro']) {
      const { rows } = await pool.query<{ id: string; alias: string }>(
        `insert into app.usuario (codigo, alias, rol, rango_edad)
         values ($1, $2, 'usuario', 'B') returning id_usuario as id, alias`,
        [`PruebaDistribuida_${nombre}`, `Dist${nombre}`],
      );
      usuarios.push(rows[0]!);
      tokens[nombre] = await abrirSesionInterna(pool, SECRETO, rows[0]!.id, 600_000);
    }
    const { rows: ajenos } = await pool.query<{ id: string }>(
      `insert into app.usuario (codigo, alias, rol, rango_edad)
       values ('PruebaDistribuida_Ajena', 'DistAjena', 'usuario', 'C') returning id_usuario as id`,
    );
    usuarios.push({ id: ajenos[0]!.id, alias: 'DistAjena' });
    tokens.Ajena = await abrirSesionInterna(pool, SECRETO, ajenos[0]!.id, 600_000);

    [uno, dos] = await Promise.all([levantar(), levantar()]);
  }, 120_000);

  afterEach(() => {
    for (const c of abiertas.splice(0)) c.ws.terminate();
  });

  afterAll(async () => {
    await Promise.all([detener(uno), detener(dos), ...extras.map(detener)]);
    if (!pool) return;
    const ids = usuarios.map((u) => u.id);
    for (const tabla of ['evento_dlp', 'participacion_sala', 'posicion_avatar_sala', 'sesion']) {
      await pool.query(`delete from app.${tabla} where id_usuario = any($1)`, [ids]);
    }
    await pool.query('delete from app.usuario where id_usuario = any($1)', [ids]);
    await pool.query(
      `update app.sala set usuarios_actuales = 0, estado = 'disponible', vacia_desde = null
       where id_sala = any($1)`,
      [[sala, otraSala]],
    );
    await pool.end();
    const cliente = createClient({ url: URL_REDIS_PRUEBAS });
    await cliente.connect();
    for await (const claves of cliente.scanIterator({ MATCH: `${prefijo}*`, COUNT: 500 })) {
      if (claves.length) await cliente.del(claves);
    }
    await cliente.close();
  }, 60_000);

  /** Espera a que las presencias de la prueba anterior se vayan (cupos libres). */
  async function salaVacia(idSala = sala) {
    await hasta(
      () => ocupacion(idSala),
      (n) => n === 0,
      (PRESENCIA_SEGUNDOS + 5) * 1000,
    );
  }

  it('A en la instancia 1 y B en la 2: se ven entrar, escribir y moverse', async () => {
    const ana = abrir(uno, sala, tokens.Ana);
    const { yo: idAna } = await ana.esperar('estado');
    const beto = abrir(dos, sala, tokens.Beto);
    const estadoBeto = await beto.esperar('estado');

    expect(estadoBeto.participantes.map((p) => p.alias).sort()).toEqual(['DistAna', 'DistBeto']);
    await ana.esperar('entro', (m) => m.participante.alias === 'DistBeto' && m.ocupacion === 2);

    ana.enviar({ tipo: 'mensaje', texto: 'Hola desde la instancia 1' });
    await beto.esperar('mensaje', (m) => m.texto === 'Hola desde la instancia 1');

    ana.enviar({ tipo: 'mover', direccion: 'derecha' });
    const paso = await beto.esperar('movio', (m) => m.id === idAna);
    beto.enviar({ tipo: 'mover', direccion: 'arriba' });
    await ana.esperar('movio', (m) => m.id === estadoBeto.yo);

    // Cada evento llega una sola vez a cada conexión.
    await esperar(300);
    expect(beto.de('mensaje')).toHaveLength(1);
    expect(beto.de('movio').filter((m) => m.id === idAna)).toEqual([paso]);
    expect(await ocupacion(sala)).toBe(2);
  }, 30_000);

  it('salir se ve enseguida en la otra instancia; un corte espera a que venza la presencia', async () => {
    await salaVacia();
    const ana = abrir(uno, sala, tokens.Ana);
    await ana.esperar('estado');
    const beto = abrir(dos, sala, tokens.Beto);
    const { yo: idBeto } = await beto.esperar('estado');
    const caro = abrir(dos, sala, tokens.Caro);
    const { yo: idCaro } = await caro.esperar('estado');

    beto.ws.close(1000);
    await ana.esperar('salio', (m) => m.id === idBeto);

    // Un corte (sin cierre) no saca a Caro de inmediato: tiene margen para reconectarse.
    caro.ws.terminate();
    await esperar(1000);
    expect(ana.de('salio').filter((m) => m.id === idCaro)).toEqual([]);
    const salida = await ana.esperar(
      'salio',
      (m) => m.id === idCaro,
      (PRESENCIA_SEGUNDOS + 5) * 1000,
    );
    expect(salida.ocupacion).toBe(1);
    expect(
      await hasta(
        () => ocupacion(sala),
        (n) => n === 1,
      ),
    ).toBe(1);
  }, 30_000);

  it('la misma persona en las dos instancias queda una vez, y reconectarse no la duplica', async () => {
    await salaVacia();
    const beto = abrir(dos, sala, tokens.Beto);
    await beto.esperar('estado');
    const pestana1 = abrir(uno, sala, tokens.Ana);
    const { yo: idAna } = await pestana1.esperar('estado');
    pestana1.enviar({ tipo: 'mover', direccion: 'derecha' });
    const posicion = await beto.esperar('movio', (m) => m.id === idAna);

    const pestana2 = abrir(dos, sala, tokens.Ana);
    await pestana2.esperar('estado');
    expect(await pestana1.cierre).toBe(4000);

    // Se corta la pestaña nueva y vuelve por la otra instancia antes de que venza.
    pestana2.ws.terminate();
    await esperar(300);
    const vuelta = abrir(uno, sala, tokens.Ana);
    const estado = await vuelta.esperar('estado');
    expect(estado.participantes.find((p) => p.id === idAna)).toMatchObject({
      x: posicion.x,
      y: posicion.y,
    });
    expect(estado.ocupacion).toBe(2);

    await esperar((PRESENCIA_SEGUNDOS + 1) * 1000);
    expect(beto.de('entro').filter((m) => m.participante.id === idAna)).toHaveLength(1);
    expect(beto.de('salio')).toEqual([]);
    expect(await ocupacion(sala)).toBe(2);
  }, 30_000);

  it('si una instancia cae, quien está en la otra sigue, y quien estaba en ella vuelve sin salir', async () => {
    await salaVacia();
    const ana = abrir(uno, sala, tokens.Ana);
    const { yo: idAna } = await ana.esperar('estado');
    const beto = abrir(dos, sala, tokens.Beto);
    await beto.esperar('estado');

    await detener(uno);
    expect(await ana.cierre).not.toBe(1000);

    // Ana vuelve por la instancia que sigue en pie, dentro del margen de su presencia.
    const anaDeNuevo = abrir(dos, sala, tokens.Ana);
    await anaDeNuevo.esperar('estado');
    // La instancia caída vuelve a arrancar: no limpia ni saca a nadie.
    uno = await levantar();
    await esperar((PRESENCIA_SEGUNDOS + 1) * 1000);

    // Beto entró después de Ana: ni la caída ni la vuelta de Ana le llegan como salida o entrada.
    expect(beto.de('salio')).toEqual([]);
    expect(beto.de('entro').filter((m) => m.participante.id === idAna)).toEqual([]);
    expect(beto.ws.readyState).toBe(WebSocket.OPEN);
    expect(await ocupacion(sala)).toBe(2);

    // Y desde la instancia reiniciada se ve a los dos.
    const caro = abrir(uno, sala, tokens.Caro);
    const estado = await caro.esperar('estado');
    expect(estado.participantes.map((p) => p.alias).sort()).toEqual([
      'DistAna',
      'DistBeto',
      'DistCaro',
    ]);
  }, 60_000);

  it('sin sesión o de otra comunidad no entra por ninguna instancia, y lo de una sala no llega a otra', async () => {
    expect(await abrir(uno, sala).cierre).toBe(4401);
    expect(await abrir(dos, sala, tokens.Ajena).cierre).toBe(4404);
    expect(await abrir(dos, salaAjena, tokens.Ana).cierre).toBe(4404);

    await salaVacia(otraSala);
    const ana = abrir(uno, sala, tokens.Ana);
    await ana.esperar('estado');
    const beto = abrir(dos, otraSala, tokens.Beto);
    await beto.esperar('estado');
    ana.enviar({ tipo: 'mensaje', texto: 'Solo para esta sala', idSala: otraSala });
    ana.enviar({ tipo: 'mover', direccion: 'derecha', sala: otraSala });
    await ana.esperar('mensaje', (m) => m.texto === 'Solo para esta sala');
    await esperar(500);
    expect(beto.mensajes.filter((m) => m.tipo !== 'estado')).toEqual([]);
  }, 30_000);

  it('si Redis no responde, la instancia no abre salas solo en su memoria: cierra para reintentar', async () => {
    const sinRedis = await levantar({ REDIS_URL: `redis://127.0.0.1:${await puertoLibre()}` });
    extras.push(sinRedis);
    const ana = abrir(sinRedis, sala, tokens.Ana);
    expect(await ana.cierre).toBe(1011);
    expect(ana.mensajes).toEqual([expect.objectContaining({ codigo: 'ERROR_INTERNO' })]);
    // El resto de la API sigue respondiendo.
    expect((await fetch(`http://127.0.0.1:${sinRedis.puerto}/api/salud`)).ok).toBe(true);
  }, 60_000);
});
