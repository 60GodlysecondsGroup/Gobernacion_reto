/**
 * Fase 10 · Filtros de contenido contra la base real del .env (npm run test:db):
 * lenguaje ofensivo en hilos, respuestas y perfil, y reglas cargadas por la migración 0006.
 * Todo lo que escribe corre en una transacción que se revierte al final.
 */
import request from 'supertest';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { cargarConfig } from '../../src/config/env.js';
import { crearPool, type PoolDeDatos } from '../../src/db/database.js';
import { crearLogger } from '../../src/lib/logger.js';
import { MENSAJE_BLOQUEO } from '../../src/modules/dlp/dlp.analizador.js';
import { configPrueba } from '../apoyo.js';

const logger = crearLogger('silencioso');
const MENSAJE_OFENSIVO =
  'Este mensaje contiene lenguaje ofensivo. Reformúlalo de manera respetuosa.';
const HILO_B = '¿Cómo organizan su tiempo para estudiar?';
type App = ReturnType<typeof crearApp>;

let pool: PoolDeDatos;
let idHiloB: string;

beforeAll(async () => {
  pool = crearPool(cargarConfig().baseDeDatos);
  const { rows } = await pool.query('select id_hilo from app.hilo where titulo = $1', [HILO_B]);
  idHiloB = rows[0].id_hilo;
});

afterAll(async () => {
  await pool.end();
});

async function enTransaccionRevertida(prueba: (app: App, cliente: pg.PoolClient) => Promise<void>) {
  const cliente = await pool.connect();
  try {
    await cliente.query('begin');
    await prueba(
      crearApp({ db: cliente, logger, config: configPrueba, ttlReglasDlpMs: 0 }),
      cliente,
    );
  } finally {
    await cliente.query('rollback');
    cliente.release();
  }
}

async function entrar(aplicacion: App, codigo: string) {
  const res = await request(aplicacion).post('/api/sesion').send({ codigo });
  expect(res.status).toBe(201);
  const cookie = (res.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
  return {
    post: (ruta: string, cuerpo: object) =>
      request(aplicacion).post(ruta).set('Cookie', cookie).send(cuerpo),
    put: (ruta: string, cuerpo: object) =>
      request(aplicacion).put(ruta).set('Cookie', cookie).send(cuerpo),
  };
}

const contar = async (cliente: pg.PoolClient, tabla: string) =>
  (await cliente.query(`select count(*)::int as n from ${tabla}`)).rows[0].n as number;

async function ultimoEvento(cliente: pg.PoolClient) {
  const { rows } = await cliente.query(
    `select e.tipo_contenido, e.categoria, e.resultado, r.codigo as regla, to_jsonb(e) as fila
       from app.evento_dlp e left join app.regla_dlp r using (id_regla)
      order by e.fecha desc limit 1`,
  );
  return rows[0];
}

describe('Migración 0006 · reglas persistentes en la base', () => {
  it('la categoría lenguaje_ofensivo existe con sus cinco reglas activas', async () => {
    const categoria = await pool.query(
      `select nombre from app.categoria_dlp where codigo = 'lenguaje_ofensivo'`,
    );
    expect(categoria.rows).toEqual([{ nombre: 'Lenguaje ofensivo' }]);

    const reglas = await pool.query(
      `select codigo, accion, estado from app.regla_dlp
        where categoria = 'lenguaje_ofensivo' order by codigo`,
    );
    expect(reglas.rows).toHaveLength(5);
    for (const regla of reglas.rows) {
      expect(regla).toMatchObject({ accion: 'bloquear', estado: 'activa' });
    }
  });

  it('«ig» ya no está en redes-plataformas y existe la regla con contexto', async () => {
    const { rows } = await pool.query(
      `select codigo, patron from app.regla_dlp
        where codigo in ('redes-plataformas', 'redes-ig-contexto') order by codigo`,
    );
    expect(rows.map((r) => r.codigo)).toEqual(['redes-ig-contexto', 'redes-plataformas']);
    expect(rows[1].patron).not.toMatch(/\|ig\|/);
  });
});

describe('Lenguaje ofensivo · hilos', () => {
  it('bloquea un hilo con un insulto (422), no lo guarda y registra el evento sin el texto', async () => {
    await enTransaccionRevertida(async (enTx, cliente) => {
      const antes = await contar(cliente, 'app.hilo');
      const luna = await entrar(enTx, 'Usuario_001');
      const res = await luna.post('/api/comunidad/hilos', {
        categoria: 'bienestar-cotidiano',
        titulo: 'Una pregunta',
        contenido: 'Eres un idiota, nadie te pidió opinión.',
      });

      expect(res.status).toBe(422);
      expect(res.body.error).toEqual({
        codigo: 'CONTENIDO_BLOQUEADO',
        mensaje: MENSAJE_OFENSIVO,
        detalles: { campo: 'contenido' },
      });
      expect(await contar(cliente, 'app.hilo')).toBe(antes);

      const evento = await ultimoEvento(cliente);
      expect(evento).toMatchObject({
        tipo_contenido: 'hilo',
        categoria: 'lenguaje_ofensivo',
        resultado: 'bloqueado',
        regla: 'ofensivo-insulto-dirigido',
      });
      expect(JSON.stringify(evento.fila)).not.toContain('idiota');
    });
  });

  it('bloquea también el título y las variantes con evasión', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const luna = await entrar(enTx, 'Usuario_001');
      for (const [titulo, contenido, campo] of [
        ['h.p.', 'Contenido normal.', 'titulo'],
        ['Una duda', 'i d i o t a', 'contenido'],
        ['Una duda', 'MALPARIDO', 'contenido'],
        ['Una duda', 'eres un 1d10t4', 'contenido'],
      ] as const) {
        const res = await luna.post('/api/comunidad/hilos', {
          categoria: 'bienestar-cotidiano',
          titulo,
          contenido,
        });
        expect(res.status).toBe(422);
        expect(res.body.error).toMatchObject({ mensaje: MENSAJE_OFENSIVO, detalles: { campo } });
      }
    });
  });

  it('publica mensajes normales y usos ambiguos que no son insultos', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const luna = await entrar(enTx, 'Usuario_001');
      for (const contenido of [
        'Me sentí como un idiota en el examen, pero ya pasó.',
        'Mi perra se llama Luna y es muy juguetona.',
        'Sigo el ig de la Gobernación para ver los horarios.',
      ]) {
        const res = await luna.post('/api/comunidad/hilos', {
          categoria: 'bienestar-cotidiano',
          titulo: 'Les cuento algo',
          contenido,
        });
        expect(res.status).toBe(201);
      }
    });
  });

  it('las reglas de privacidad siguen igual (mensaje estándar)', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const luna = await entrar(enTx, 'Usuario_001');
      const res = await luna.post('/api/comunidad/hilos', {
        categoria: 'bienestar-cotidiano',
        titulo: 'Contacto',
        contenido: 'Mi número es ３００１２３４５６７',
      });
      expect(res.status).toBe(422);
      expect(res.body.error).toMatchObject({ mensaje: MENSAJE_BLOQUEO });
    });
  });
});

describe('Lenguaje ofensivo · respuestas', () => {
  it('bloquea una respuesta ofensiva y acepta una normal', async () => {
    await enTransaccionRevertida(async (enTx, cliente) => {
      const antes = await contar(cliente, 'app.respuesta');
      const luna = await entrar(enTx, 'Usuario_001');

      const bloqueada = await luna.post(`/api/comunidad/hilos/${idHiloB}/respuestas`, {
        contenido: 'cállate, imbécil',
      });
      expect(bloqueada.status).toBe(422);
      expect(bloqueada.body.error).toEqual({
        codigo: 'CONTENIDO_BLOQUEADO',
        mensaje: MENSAJE_OFENSIVO,
        detalles: { campo: 'contenido' },
      });
      expect(await contar(cliente, 'app.respuesta')).toBe(antes);
      expect(await ultimoEvento(cliente)).toMatchObject({
        tipo_contenido: 'respuesta',
        categoria: 'lenguaje_ofensivo',
      });

      const normal = await luna.post(`/api/comunidad/hilos/${idHiloB}/respuestas`, {
        contenido: 'A mí me sirve hacer una lista cada noche.',
      });
      expect([200, 201]).toContain(normal.status);
      expect(await contar(cliente, 'app.respuesta')).toBe(antes + 1);
    });
  });
});

describe('Lenguaje ofensivo · perfil', () => {
  it.each([
    [{ alias: 'Malparido', intereses: ['música'] }, 'alias'],
    [{ alias: 'LunaDemo', intereses: ['música', 'eres un idiota'] }, 'intereses'],
  ])('bloquea el perfil (%j) en el campo %s', async (perfil, campo) => {
    await enTransaccionRevertida(async (enTx, cliente) => {
      const luna = await entrar(enTx, 'Usuario_001');
      const res = await luna.put('/api/perfil', perfil);
      expect(res.status).toBe(422);
      expect(res.body.error).toEqual({
        codigo: 'CONTENIDO_BLOQUEADO',
        mensaje: MENSAJE_OFENSIVO,
        detalles: { campo },
      });
      const { rows } = await cliente.query(
        `select alias from app.usuario where codigo = 'Usuario_001'`,
      );
      expect(rows[0].alias).toBe('LunaDemo');
    });
  });

  it('acepta un perfil normal', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const luna = await entrar(enTx, 'Usuario_001');
      const res = await luna.put('/api/perfil', {
        alias: 'LunaDemo',
        intereses: ['música', 'dibujo'],
      });
      expect(res.status).toBe(200);
    });
  });
});
