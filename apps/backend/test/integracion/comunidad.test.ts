/**
 * Fase 4 · Comunidad: hilos, respuestas y reportes, contra la base real del .env.
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
const UUID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';
type App = ReturnType<typeof crearApp>;

let pool: PoolDeDatos;
let app: App;
const ids: Record<string, string> = {};

beforeAll(async () => {
  pool = crearPool(cargarConfig().baseDeDatos);
  app = crearApp({ db: pool, logger, config: configPrueba, ttlReglasDlpMs: 0 });
  const hilos = await pool.query(`select titulo, id_hilo from app.hilo`);
  for (const fila of hilos.rows) ids[fila.titulo] = fila.id_hilo;
  const usuarios = await pool.query(`select codigo, id_usuario from app.usuario`);
  for (const fila of usuarios.rows) ids[fila.codigo] = fila.id_usuario;
});

afterAll(async () => {
  await pool.end();
});

const HILO_B = '¿Cómo organizan su tiempo para estudiar?';

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
    get: (ruta: string) => request(aplicacion).get(ruta).set('Cookie', cookie),
    post: (ruta: string, cuerpo: object = {}) =>
      request(aplicacion).post(ruta).set('Cookie', cookie).send(cuerpo),
  };
}

const titulos = (hilos: { titulo: string }[]) => hilos.map((h) => h.titulo);

describe('TRL-02 · Crear hilo', () => {
  it('el hilo queda solo en la comunidad del autor y otros del mismo rango lo ven', async () => {
    await enTransaccionRevertida(async (enTx, cliente) => {
      const luna = await entrar(enTx, 'Usuario_001');
      const creado = await luna.post('/api/comunidad/hilos', {
        categoria: 'bienestar-cotidiano',
        titulo: 'Rutinas que me ayudan en la semana',
        contenido: 'Les comparto que preparar la mochila la noche anterior me quita estrés.',
      });

      expect(creado.status).toBe(201);
      expect(creado.body.hilo).toMatchObject({
        titulo: 'Rutinas que me ayudan en la semana',
        categoria: { codigo: 'bienestar-cotidiano', nombre: 'Bienestar cotidiano' },
        autor: { alias: 'LunaDemo', avatar: { personaje: expect.any(String) } },
      });
      expect(creado.body.respuestas).toEqual([]);

      const { rows } = await cliente.query(
        `select c.rango_edad from app.hilo h join app.comunidad c using (id_comunidad) where h.id_hilo = $1`,
        [creado.body.hilo.id],
      );
      expect(rows).toEqual([{ rango_edad: 'B' }]);

      const sol = await entrar(enTx, 'Usuario_002');
      const lista = await sol.get('/api/comunidad/hilos');
      expect(titulos(lista.body.hilos)[0]).toBe('Rutinas que me ayudan en la semana');
      expect((await sol.get(`/api/comunidad/hilos/${creado.body.hilo.id}`)).status).toBe(200);
    });
  });

  it('nunca muestra edad, rango ni datos de contacto del autor', async () => {
    const sol = await entrar(app, 'Usuario_002');
    const res = await sol.get(`/api/comunidad/hilos/${ids[HILO_B]}`);
    expect(Object.keys(res.body.hilo.autor).sort()).toEqual(['alias', 'avatar', 'id']);
    expect(JSON.stringify(res.body)).not.toMatch(/edad|rango|nacimiento/i);
  });

  it('rechaza categorías inexistentes y campos que no son del hilo', async () => {
    const luna = await entrar(app, 'Usuario_001');
    const base = { categoria: 'vida-academica', titulo: 'Un título', contenido: 'Un contenido.' };
    expect((await luna.post('/api/comunidad/hilos', { ...base, categoria: 'otra' })).status).toBe(
      400,
    );
    const otraComunidad = await luna.post('/api/comunidad/hilos', { ...base, comunidad: 'C' });
    expect(otraComunidad.status).toBe(400);
  });
});

describe('TRL-03 · Responder', () => {
  it('la respuesta pasa por el DLP y aparece en el hilo con su autor', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const luna = await entrar(enTx, 'Usuario_001');
      const res = await luna.post(`/api/comunidad/hilos/${ids[HILO_B]}/respuestas`, {
        contenido: 'Yo uso un horario semanal pegado en la pared.',
      });

      expect(res.status).toBe(201);
      expect(res.body.respuestas.at(-1)).toMatchObject({
        contenido: 'Yo uso un horario semanal pegado en la pared.',
        autor: { alias: 'LunaDemo' },
      });
    });
  });

  it('no se puede responder un hilo cerrado', async () => {
    await enTransaccionRevertida(async (enTx, cliente) => {
      await cliente.query(`update app.hilo set estado = 'cerrado' where id_hilo = $1`, [
        ids[HILO_B],
      ]);
      const luna = await entrar(enTx, 'Usuario_001');
      const res = await luna.post(`/api/comunidad/hilos/${ids[HILO_B]}/respuestas`, {
        contenido: 'Hola',
      });
      expect(res.status).toBe(409);
    });
  });
});

describe('DLP en hilos y respuestas', () => {
  it.each([
    ['teléfono en el contenido', { contenido: 'Escríbeme al 3000000000.' }, 'contenido'],
    ['red social en el título', { titulo: 'Búscame en Instagram' }, 'titulo'],
    [
      'ubicación en el contenido',
      { contenido: 'Nos vemos en la dirección de prueba 123.' },
      'contenido',
    ],
  ])('bloquea un hilo con %s y no lo guarda', async (_caso, cambio, campo) => {
    await enTransaccionRevertida(async (enTx, cliente) => {
      const antes = (await cliente.query('select count(*)::int as n from app.hilo')).rows[0].n;
      const luna = await entrar(enTx, 'Usuario_001');
      const res = await luna.post('/api/comunidad/hilos', {
        categoria: 'bienestar-cotidiano',
        titulo: 'Un hilo de prueba',
        contenido: 'Contenido de prueba.',
        ...cambio,
      });

      expect(res.status).toBe(422);
      expect(res.body.error).toEqual({
        codigo: 'CONTENIDO_BLOQUEADO',
        mensaje: MENSAJE_BLOQUEO,
        detalles: { campo },
      });
      expect((await cliente.query('select count(*)::int as n from app.hilo')).rows[0].n).toBe(
        antes,
      );

      const evento = await cliente.query(
        `select tipo_contenido, resultado from app.evento_dlp order by fecha desc limit 1`,
      );
      expect(evento.rows[0]).toEqual({ tipo_contenido: 'hilo', resultado: 'bloqueado' });
    });
  });

  it('bloquea una respuesta con un teléfono y no la guarda', async () => {
    await enTransaccionRevertida(async (enTx, cliente) => {
      const luna = await entrar(enTx, 'Usuario_001');
      const res = await luna.post(`/api/comunidad/hilos/${ids[HILO_B]}/respuestas`, {
        contenido: 'Mi número es 300 000 0000',
      });
      expect(res.status).toBe(422);
      const respuestas = await cliente.query(
        'select count(*)::int as n from app.respuesta where id_hilo = $1',
        [ids[HILO_B]],
      );
      expect(respuestas.rows[0].n).toBe(1);
    });
  });
});

describe('Aislamiento: otro rango no ve, no responde, no lista ni busca el hilo', () => {
  it.each(['Usuario_003', 'Usuario_004', 'Usuario_005'])('%s (otro rango)', async (codigo) => {
    const otro = await entrar(app, codigo);
    const inexistente = await otro.get(`/api/comunidad/hilos/${UUID_INEXISTENTE}`);

    const directo = await otro.get(`/api/comunidad/hilos/${ids[HILO_B]}`);
    expect(directo.status).toBe(404);
    expect(directo.body).toEqual(inexistente.body);

    const lista = await otro.get('/api/comunidad/hilos');
    expect(titulos(lista.body.hilos)).not.toContain(HILO_B);

    const busqueda = await otro.get('/api/comunidad/hilos?buscar=organizan');
    expect(busqueda.body.hilos).toEqual([]);

    const respuesta = await otro.post(`/api/comunidad/hilos/${ids[HILO_B]}/respuestas`, {
      contenido: 'Hola',
    });
    expect(respuesta.status).toBe(404);

    const reporte = await otro.post('/api/reportes', {
      tipoContenido: 'hilo',
      idContenido: ids[HILO_B],
      categoria: 'otro',
    });
    expect(reporte.status).toBe(404);
  });

  it('cada comunidad ve solo sus propios hilos', async () => {
    const luna = await entrar(app, 'Usuario_001');
    const rio = await entrar(app, 'Usuario_003');
    expect(titulos((await luna.get('/api/comunidad/hilos')).body.hilos).sort()).toEqual(
      [HILO_B, 'Me cuesta adaptarme a los cambios de este año'].sort(),
    );
    expect(titulos((await rio.get('/api/comunidad/hilos')).body.hilos)).toEqual([
      '¿Cómo hacer nuevos amigos en el descanso?',
    ]);
  });

  it('un hilo oculto por moderación deja de verse', async () => {
    await enTransaccionRevertida(async (enTx, cliente) => {
      await cliente.query(`update app.hilo set estado = 'oculto' where id_hilo = $1`, [
        ids[HILO_B],
      ]);
      const sol = await entrar(enTx, 'Usuario_002');
      expect((await sol.get(`/api/comunidad/hilos/${ids[HILO_B]}`)).status).toBe(404);
      expect(titulos((await sol.get('/api/comunidad/hilos')).body.hilos)).not.toContain(HILO_B);
    });
  });
});

describe('Listado', () => {
  it('filtra por categoría, busca dentro de la comunidad y cuenta respuestas', async () => {
    const luna = await entrar(app, 'Usuario_001');
    const academica = await luna.get('/api/comunidad/hilos?categoria=vida-academica');
    expect(academica.body.hilos).toEqual([
      expect.objectContaining({
        titulo: HILO_B,
        respuestas: 1,
        categoria: expect.objectContaining({ codigo: 'vida-academica' }),
      }),
    ]);
    expect(titulos((await luna.get('/api/comunidad/hilos?buscar=horarios')).body.hilos)).toEqual([
      'Me cuesta adaptarme a los cambios de este año',
    ]);
  });

  it('pagina de 10 en 10', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const luna = await entrar(enTx, 'Usuario_001');
      for (let i = 1; i <= 11; i++) {
        await luna.post('/api/comunidad/hilos', {
          categoria: 'vida-academica',
          titulo: `Hilo de paginación ${i}`,
          contenido: 'Contenido de prueba.',
        });
      }
      const primera = await luna.get('/api/comunidad/hilos');
      expect(primera.body).toMatchObject({ pagina: 1, hayMas: true });
      expect(primera.body.hilos).toHaveLength(10);

      const segunda = await luna.get('/api/comunidad/hilos?pagina=2');
      expect(segunda.body).toMatchObject({ pagina: 2, hayMas: false });
      expect(segunda.body.hilos).toHaveLength(3);
    });
  });

  it('ofrece las cinco categorías con su número de hilos', async () => {
    const luna = await entrar(app, 'Usuario_001');
    const res = await luna.get('/api/comunidad/categorias');
    expect(res.body.categorias.map((c: { nombre: string }) => c.nombre)).toEqual([
      'Bienestar cotidiano',
      'Vida académica',
      'Relaciones y convivencia',
      'Cambios y nuevas etapas',
      'Orientación',
    ]);
    expect(
      res.body.categorias.find((c: { codigo: string }) => c.codigo === 'vida-academica').hilos,
    ).toBe(1);
  });
});

describe('Reportes (F19, F20)', () => {
  it('registra el reporte con su motivo y el contenido asociado', async () => {
    await enTransaccionRevertida(async (enTx, cliente) => {
      const sol = await entrar(enTx, 'Usuario_002');
      const { respuestas } = (await sol.get(`/api/comunidad/hilos/${ids[HILO_B]}`)).body;

      const res = await sol.post('/api/reportes', {
        tipoContenido: 'respuesta',
        idContenido: respuestas[0].id,
        categoria: 'contenido_inapropiado',
        descripcion: 'Prueba de reporte automatizada.',
      });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ mensaje: 'Tu reporte fue registrado.' });

      const { rows } = await cliente.query(
        `select r.tipo_contenido, r.id_contenido, r.categoria, r.estado, c.rango_edad, u.alias
         from app.reporte r
         join app.comunidad c using (id_comunidad)
         join app.usuario u on u.id_usuario = r.id_usuario_reportante`,
      );
      expect(rows).toEqual([
        {
          tipo_contenido: 'respuesta',
          id_contenido: respuestas[0].id,
          categoria: 'contenido_inapropiado',
          estado: 'pendiente',
          rango_edad: 'B',
          alias: 'SolDemo',
        },
      ]);

      const repetido = await sol.post('/api/reportes', {
        tipoContenido: 'respuesta',
        idContenido: respuestas[0].id,
        categoria: 'acoso',
      });
      expect(repetido.body).toEqual({ mensaje: 'Tu reporte fue registrado.' });
      expect((await cliente.query('select count(*)::int as n from app.reporte')).rows[0].n).toBe(1);
    });
  });

  it('permite reportar hilos y perfiles de la propia comunidad', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const luna = await entrar(enTx, 'Usuario_001');
      expect(
        (
          await luna.post('/api/reportes', {
            tipoContenido: 'hilo',
            idContenido: ids[HILO_B],
            categoria: 'publicidad',
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await luna.post('/api/reportes', {
            tipoContenido: 'perfil',
            idContenido: ids.Usuario_002,
            categoria: 'otro',
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await luna.post('/api/reportes', {
            tipoContenido: 'perfil',
            idContenido: ids.Usuario_004,
            categoria: 'otro',
          })
        ).status,
      ).toBe(404);
    });
  });

  it('valida el motivo y pasa la descripción por el DLP', async () => {
    const luna = await entrar(app, 'Usuario_001');
    const base = { tipoContenido: 'hilo', idContenido: ids[HILO_B] };
    expect((await luna.post('/api/reportes', { ...base, categoria: 'no-existe' })).status).toBe(
      400,
    );

    await enTransaccionRevertida(async (enTx, cliente) => {
      const enTxLuna = await entrar(enTx, 'Usuario_001');
      const res = await enTxLuna.post('/api/reportes', {
        ...base,
        categoria: 'otro',
        descripcion: 'Escríbeme al 3000000000',
      });
      expect(res.status).toBe(422);
      expect((await cliente.query('select count(*)::int as n from app.reporte')).rows[0].n).toBe(0);
    });
  });
});

describe('Permisos', () => {
  it('sin sesión: 401 en hilos y reportes', async () => {
    expect((await request(app).get('/api/comunidad/hilos')).status).toBe(401);
    expect((await request(app).post('/api/reportes').send({})).status).toBe(401);
  });

  it('el personal sin comunidad no publica ni lee foros; el gestor no tiene acceso', async () => {
    const moderador = await entrar(app, 'Moderador_001');
    expect((await moderador.get('/api/comunidad/hilos')).body.error.codigo).toBe('SIN_COMUNIDAD');
    expect((await moderador.post('/api/comunidad/hilos', {})).status).toBe(403);

    const gestor = await entrar(app, 'Gestor_001');
    expect((await gestor.get('/api/comunidad/hilos')).status).toBe(403);
  });
});
