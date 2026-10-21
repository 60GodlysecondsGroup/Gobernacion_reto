/**
 * Fase 5 · Salas interactivas, con WebSocket real y la base del .env (npm run test:db).
 * Cada prueba usa un servidor propio cuyas consultas van a una transacción que se revierte.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { crearServidor, type Servidor } from '../../src/app.js';
import { cargarConfig } from '../../src/config/env.js';
import { crearPool, type PoolDeDatos } from '../../src/db/database.js';
import { crearLogger } from '../../src/lib/logger.js';
import { MENSAJE_BLOQUEO } from '../../src/modules/dlp/dlp.analizador.js';
import type { MensajeServidor } from '../../src/modules/salas/salas.protocolo.js';
import { crearRepositorioSalas } from '../../src/modules/salas/salas.repository.js';
import { crearToken } from '../../src/modules/seguridad/sesion.token.js';
import { configPrueba, enCola, hasta } from '../apoyo.js';

const logger = crearLogger('silencioso');
const CIERRE_SEGUNDOS = 2;

let pool: PoolDeDatos;
let cliente: pg.PoolClient;
let servidor: Servidor;
let http: Server;
let puerto: number;
const salas: Record<string, string> = {};

beforeAll(async () => {
  pool = crearPool(cargarConfig().baseDeDatos);
  const { rows } = await pool.query(
    `select c.rango_edad || ':' || s.nombre as clave, s.id_sala
     from app.sala s join app.comunidad c using (id_comunidad) where s.estado <> 'cerrada'`,
  );
  for (const fila of rows) salas[fila.clave] = fila.id_sala;
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  cliente = await pool.connect();
  await cliente.query('begin');
  servidor = crearServidor({
    db: enCola(cliente),
    logger,
    config: { ...configPrueba, salas: { cierreSegundos: CIERRE_SEGUNDOS } },
    ttlReglasDlpMs: 0,
    intervalosSalas: { movimientoMs: 0, mensajeMs: 0, guardadoMs: 20 },
  });
  http = createServer(servidor.app);
  http.on('upgrade', (req, socket, cabecera) =>
    servidor.tiempoReal.manejarUpgrade(req, socket, cabecera),
  );
  await new Promise<void>((resolver) => http.listen(0, '127.0.0.1', resolver));
  puerto = (http.address() as AddressInfo).port;
});

afterEach(async () => {
  servidor.salas.detener();
  servidor.tiempoReal.cerrar();
  await new Promise((resolver) => http.close(resolver));
  await cliente.query('rollback');
  cliente.release();
});

/** Crea usuarios sintéticos de un rango dentro de la transacción y devuelve sus tokens. */
async function usuarios(cantidad: number, rango = 'B') {
  const tokens: string[] = [];
  for (let i = 0; i < cantidad; i++) {
    const { rows } = await cliente.query(
      `insert into app.usuario (codigo, alias, rol, rango_edad) values ($1, $2, 'usuario', $3)
       returning id_usuario`,
      [`Prueba_${rango}${i}`, `Prueba${rango}${i}`, rango],
    );
    tokens.push(crearToken(rows[0].id_usuario, configPrueba.sesion.secreto, 600_000));
  }
  return tokens;
}

async function tokenDe(codigo: string) {
  const { rows } = await cliente.query('select id_usuario from app.usuario where codigo = $1', [
    codigo,
  ]);
  return crearToken(rows[0].id_usuario, configPrueba.sesion.secreto, 600_000);
}

function conectar(idSala: string, token?: string, origen?: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${puerto}/ws/salas/${idSala}`, {
    headers: {
      ...(token && { Cookie: `sesion=${token}` }),
      ...(origen && { Origin: origen }),
    },
  });
  const mensajes: MensajeServidor[] = [];
  ws.on('message', (datos) => mensajes.push(JSON.parse(datos.toString())));
  ws.on('error', () => {});
  const cierre = new Promise<number>((resolver) => ws.on('close', (codigo) => resolver(codigo)));

  async function esperar<T extends MensajeServidor['tipo']>(
    tipo: T,
    condicion: (m: Extract<MensajeServidor, { tipo: T }>) => boolean = () => true,
    limiteMs = 8000,
  ): Promise<Extract<MensajeServidor, { tipo: T }>> {
    const inicio = Date.now();
    for (;;) {
      const encontrado = mensajes.find(
        (m) => m.tipo === tipo && condicion(m as Extract<MensajeServidor, { tipo: T }>),
      );
      if (encontrado) return encontrado as Extract<MensajeServidor, { tipo: T }>;
      if (Date.now() - inicio > limiteMs) throw new Error(`No llegó «${tipo}»`);
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  return {
    ws,
    mensajes,
    cierre,
    esperar,
    enviar: (mensaje: object) => ws.send(JSON.stringify(mensaje)),
  };
}

const ocupacionEnBase = async (idSala: string) =>
  (
    await cliente.query('select usuarios_actuales, estado from app.sala where id_sala = $1', [
      idSala,
    ])
  ).rows[0];

describe('AV-12 · Aislamiento de salas por comunidad', () => {
  it('cada comunidad lista solo sus cinco salas y no ve las ajenas', async () => {
    const nube = await tokenDe('Usuario_004');
    const lista = await request(servidor.app).get('/api/salas').set('Cookie', `sesion=${nube}`);
    expect(lista.body.salas).toHaveLength(5);
    expect(lista.body.salas.map((s: { id: string }) => s.id)).not.toContain(
      salas['B:Bienestar cotidiano'],
    );

    const ajena = await request(servidor.app)
      .get(`/api/salas/${salas['B:Bienestar cotidiano']}`)
      .set('Cookie', `sesion=${nube}`);
    expect(ajena.status).toBe(404);
  });

  it('el WebSocket rechaza otra comunidad, sin sesión y sin permiso, sin enviar nada de la sala', async () => {
    const sala = salas['B:Bienestar cotidiano']!;
    const otra = conectar(sala, await tokenDe('Usuario_004'));
    expect(await otra.cierre).toBe(4404);
    expect(otra.mensajes).toEqual([
      { tipo: 'error', codigo: 'NO_ENCONTRADA', mensaje: 'La sala no existe.' },
    ]);

    expect(await conectar(sala).cierre).toBe(4401);
    expect(await conectar(sala, await tokenDe('Gestor_001')).cierre).toBe(4403);
  });

  it('rechaza el handshake desde un origen ajeno', async () => {
    const ajeno = conectar(
      salas['B:Bienestar cotidiano']!,
      await tokenDe('Usuario_001'),
      'https://sitio-ajeno.example',
    );
    const respuesta = await new Promise<number>((resolver) =>
      ajeno.ws.on('unexpected-response', (_req, res) => resolver(res.statusCode ?? 0)),
    );
    expect(respuesta).toBe(403);
  });
});

describe('TRL-07 y AV-09 · Capacidad de 10', () => {
  it('con 11 entradas simultáneas entran 10 y la 11.ª recibe «La sala está llena»', async () => {
    const sala = salas['B:Vida académica']!;
    const tokens = await usuarios(11);
    const conexiones = tokens.map((token) => conectar(sala, token));
    // En la prueba todas las entradas comparten una conexión a la base: van en fila y tardan.
    const resultados = await Promise.all(
      conexiones.map(async (c) => {
        const inicio = Date.now();
        while (Date.now() - inicio < 50_000) {
          if (c.mensajes.some((m) => m.tipo === 'estado')) return 'dentro';
          if (c.mensajes.some((m) => m.tipo === 'error')) return 'rechazada';
          await new Promise((r) => setTimeout(r, 20));
        }
        return 'sin respuesta';
      }),
    );

    expect(resultados.filter((r) => r === 'dentro')).toHaveLength(10);
    expect(resultados.filter((r) => r === 'rechazada')).toHaveLength(1);
    const rechazada = conexiones[resultados.indexOf('rechazada')]!;
    expect(rechazada.mensajes[0]).toEqual({
      tipo: 'error',
      codigo: 'SALA_LLENA',
      mensaje: 'La sala está llena.',
    });
    expect(await rechazada.cierre).toBe(4429);

    expect(await ocupacionEnBase(sala)).toEqual({ usuarios_actuales: 10, estado: 'llena' });
    const abiertas = await cliente.query(
      'select count(*)::int as n from app.participacion_sala where id_sala = $1 and hora_salida is null',
      [sala],
    );
    expect(abiertas.rows[0].n).toBe(10);

    // Al salir alguien, el cupo queda libre (F15).
    conexiones[resultados.indexOf('dentro')]!.ws.close();
    expect(
      await hasta(
        () => ocupacionEnBase(sala),
        (fila) => fila.usuarios_actuales === 9,
      ),
    ).toEqual({ usuarios_actuales: 9, estado: 'disponible' });
  }, 90_000);
});

describe('AV-04, AV-06, AV-07 y AV-08 · Movimiento compartido', () => {
  it('W, A, S, D mueven en el servidor, todos lo ven, y no se cruzan límites ni obstáculos', async () => {
    const sala = salas['B:Bienestar cotidiano']!;
    const luna = conectar(sala, await tokenDe('Usuario_001'));
    const estadoLuna = await luna.esperar('estado');
    const sol = conectar(sala, await tokenDe('Usuario_002'));
    const estadoSol = await sol.esperar('estado');

    // Quien entra tarde recibe el estado de todos.
    expect(estadoSol.participantes.map((p) => p.alias).sort()).toEqual(['LunaDemo', 'SolDemo']);
    await luna.esperar('entro', (m) => m.participante.alias === 'SolDemo');
    const yo = estadoLuna.yo;
    expect(estadoLuna.participantes.find((p) => p.id === yo)).toMatchObject({ x: 1, y: 6 });

    // AV-04 / AV-08: derecha → (2, 6), visto por las dos sesiones.
    luna.enviar({ tipo: 'mover', direccion: 'derecha' });
    await luna.esperar('movio', (m) => m.id === yo && m.x === 2 && m.y === 6);
    await sol.esperar('movio', (m) => m.id === yo && m.x === 2 && m.y === 6);

    // AV-07: (2, 6) → derecha (3, 6) → derecha (4, 6) → arriba (4, 5) → arriba (4, 4) es un cojín.
    for (const direccion of ['derecha', 'derecha', 'arriba'])
      luna.enviar({ tipo: 'mover', direccion });
    await sol.esperar('movio', (m) => m.id === yo && m.x === 4 && m.y === 5);
    luna.enviar({ tipo: 'mover', direccion: 'arriba' });
    await luna.esperar('movimiento_rechazado', (m) => m.motivo === 'obstaculo');

    // AV-06: el borde inferior (y = 7) es el último; más abajo es el límite.
    luna.enviar({ tipo: 'mover', direccion: 'abajo' });
    luna.enviar({ tipo: 'mover', direccion: 'abajo' });
    luna.enviar({ tipo: 'mover', direccion: 'abajo' });
    await luna.esperar('movimiento_rechazado', (m) => m.motivo === 'limite');
    expect(servidor.salas.participantes(sala).find((p) => p.id === yo)).toMatchObject({
      x: 4,
      y: 7,
    });

    // POSICION_AVATAR_SALA queda en la base.
    const posicion = await hasta(
      async () =>
        (
          await cliente.query(
            'select x, y from app.posicion_avatar_sala where id_sala = $1 and id_usuario = $2',
            [sala, yo],
          )
        ).rows[0],
      (fila) => fila?.x === 4 && fila?.y === 7,
    );
    expect(posicion).toEqual({ x: 4, y: 7 });
  }, 30_000);
});

describe('F14 · Chat de sala con DLP', () => {
  it('un mensaje con teléfono no llega a los demás; el autor ve el aviso', async () => {
    const sala = salas['B:Bienestar cotidiano']!;
    const luna = conectar(sala, await tokenDe('Usuario_001'));
    await luna.esperar('estado');
    const sol = conectar(sala, await tokenDe('Usuario_002'));
    await sol.esperar('estado');

    luna.enviar({ tipo: 'mensaje', texto: 'Escríbeme al 3000000000' });
    expect(await luna.esperar('mensaje_bloqueado')).toEqual({
      tipo: 'mensaje_bloqueado',
      mensaje: MENSAJE_BLOQUEO,
    });

    luna.enviar({ tipo: 'mensaje', texto: 'Hola, ¿cómo va la semana?' });
    await sol.esperar('mensaje', (m) => m.texto === 'Hola, ¿cómo va la semana?');
    expect(sol.mensajes.filter((m) => m.tipo === 'mensaje')).toHaveLength(1);

    const eventos = await cliente.query(
      `select tipo_contenido, resultado from app.evento_dlp order by fecha desc limit 1`,
    );
    expect(eventos.rows[0]).toEqual({ tipo_contenido: 'sala', resultado: 'bloqueado' });
  });
});

describe('Conexión perdida', () => {
  it('si se corta la conexión, la persona sale y los demás lo ven', async () => {
    const sala = salas['B:Bienestar cotidiano']!;
    const luna = conectar(sala, await tokenDe('Usuario_001'));
    const { yo } = await luna.esperar('estado');
    const sol = conectar(sala, await tokenDe('Usuario_002'));
    await sol.esperar('estado');

    luna.ws.terminate();
    await sol.esperar('salio', (m) => m.id === yo && m.ocupacion === 1);
    const fila = await hasta(
      () => ocupacionEnBase(sala),
      (f) => f.usuarios_actuales === 1,
    );
    expect(fila.usuarios_actuales).toBe(1);
  }, 30_000);
});

describe('TRL-08 y AV-10 · Cierre automático', () => {
  it(`vacía durante ${CIERRE_SEGUNDOS} s, la instancia se cierra y se habilita otra`, async () => {
    const sala = salas['B:Hablar con alguien']!;
    const luna = conectar(sala, await tokenDe('Usuario_001'));
    await luna.esperar('estado');
    luna.ws.close();
    await luna.cierre;

    const cerrada = await hasta(
      async () =>
        (
          await cliente.query(
            'select estado, fecha_cierre is not null as con_fecha from app.sala where id_sala = $1',
            [sala],
          )
        ).rows[0],
      (fila) => fila.estado === 'cerrada',
      (CIERRE_SEGUNDOS + 6) * 1000,
    );
    expect(cerrada).toEqual({ estado: 'cerrada', con_fecha: true });

    const tarde = conectar(sala, await tokenDe('Usuario_002'));
    expect(await tarde.cierre).toBe(4409);

    const detalle = await request(servidor.app)
      .get(`/api/salas/${sala}`)
      .set('Cookie', `sesion=${await tokenDe('Usuario_002')}`);
    expect(detalle.body.sala).toMatchObject({
      estado: 'cerrada',
      instanciaVigente: expect.any(String),
    });
    const nueva = detalle.body.sala.instanciaVigente;
    const escenario = await cliente.query(
      'select count(*)::int as n from app.escenario_sala where id_sala = $1',
      [nueva],
    );
    expect(escenario.rows[0].n).toBe(1);
  }, 30_000);

  it('si alguien entra antes del tiempo, no se cierra', async () => {
    const sala = salas['B:Hablar con alguien']!;
    const luna = conectar(sala, await tokenDe('Usuario_001'));
    await luna.esperar('estado');
    luna.ws.close();
    await luna.cierre;
    await new Promise((r) => setTimeout(r, 700));

    const sol = conectar(sala, await tokenDe('Usuario_002'));
    await sol.esperar('estado');
    await new Promise((r) => setTimeout(r, (CIERRE_SEGUNDOS + 1) * 1000));
    expect((await ocupacionEnBase(sala)).estado).toBe('disponible');
  }, 30_000);
});

describe('Reconciliación al arrancar', () => {
  it('cierra participaciones abiertas y deja vacías las salas que tenían gente', async () => {
    const sala = salas['C:Vida académica']!;
    await cliente.query(
      `update app.sala set usuarios_actuales = 3, estado = 'disponible' where id_sala = $1`,
      [sala],
    );
    await cliente.query(
      `insert into app.participacion_sala (id_sala, id_usuario)
       select $1, id_usuario from app.usuario where codigo = 'Usuario_004'`,
      [sala],
    );

    const vacias = await crearRepositorioSalas(cliente).reconciliar();
    expect(vacias.map((v) => v.id)).toContain(sala);
    expect(await ocupacionEnBase(sala)).toEqual({ usuarios_actuales: 0, estado: 'vacia' });
    const abiertas = await cliente.query(
      'select count(*)::int as n from app.participacion_sala where hora_salida is null',
    );
    expect(abiertas.rows[0].n).toBe(0);
  });
});

describe('Concurrencia real en la base', () => {
  it('12 entradas en paralelo por conexiones distintas: solo 10 ocupan cupo', async () => {
    const sala = salas['D:Cambios y nuevas etapas']!;
    const creados = await pool.query(
      `insert into app.usuario (codigo, alias, rol, rango_edad)
       select 'PruebaConcurrencia_' || i, 'Concurrencia' || i, 'usuario', 'D' from generate_series(1, 12) i
       returning id_usuario`,
    );
    const ids = creados.rows.map((f) => f.id_usuario as string);
    const repositorio = crearRepositorioSalas(pool);
    try {
      const resultados = await Promise.all(ids.map((id) => repositorio.ocupar(sala, id)));
      expect(resultados.filter((r) => r.resultado === 'ok')).toHaveLength(10);
      expect(resultados.filter((r) => r.resultado === 'llena')).toHaveLength(2);
      const { rows } = await pool.query(
        'select usuarios_actuales from app.sala where id_sala = $1',
        [sala],
      );
      expect(rows[0].usuarios_actuales).toBe(10);
    } finally {
      await pool.query('delete from app.participacion_sala where id_usuario = any($1)', [ids]);
      await pool.query('delete from app.usuario where id_usuario = any($1)', [ids]);
      await pool.query(
        `update app.sala set usuarios_actuales = 0, estado = 'disponible', vacia_desde = null where id_sala = $1`,
        [sala],
      );
    }
  });
});
