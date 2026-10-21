/**
 * Fase 6 · Avatar, contra la base real del .env (npm run test:db).
 * Cada prueba usa una app cuyas consultas van a una transacción que se revierte: la base queda igual.
 */
import type pg from 'pg';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { cargarConfig } from '../../src/config/env.js';
import { crearPool, type PoolDeDatos } from '../../src/db/database.js';
import { crearLogger } from '../../src/lib/logger.js';
import { crearRepositorioSalas } from '../../src/modules/salas/salas.repository.js';
import { configPrueba, enCola } from '../apoyo.js';

const logger = crearLogger('silencioso');

/** Una apariencia distinta de la del seed para LunaDemo. */
const NUEVA = {
  personaje: 'tono-cacao',
  cabello: 'cabello-rizado',
  rasgos: 'rasgos-pecas',
  prenda: 'prenda-chaqueta',
  accesorio: 'accesorio-gafas',
};

let pool: PoolDeDatos;
let cliente: pg.PoolClient;
let app: ReturnType<typeof crearApp>;
const ids: Record<string, string> = {};

beforeAll(async () => {
  pool = crearPool(cargarConfig().baseDeDatos);
  const { rows } = await pool.query(`select codigo, id_usuario from app.usuario`);
  for (const fila of rows) ids[fila.codigo] = fila.id_usuario;
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  cliente = await pool.connect();
  await cliente.query('begin');
  app = crearApp({ db: enCola(cliente), logger, config: configPrueba, ttlReglasDlpMs: 0 });
});

afterEach(async () => {
  await cliente.query('rollback');
  cliente.release();
});

async function entrar(codigo: string) {
  const res = await request(app).post('/api/sesion').send({ codigo });
  expect(res.status).toBe(201);
  const cookie = (res.headers['set-cookie'] as unknown as string[])
    .map((c) => c.split(';')[0])
    .join('; ');
  return {
    get: (ruta: string) => request(app).get(ruta).set('Cookie', cookie),
    put: (ruta: string, cuerpo: unknown) =>
      request(app)
        .put(ruta)
        .set('Cookie', cookie)
        .send(cuerpo as object),
    post: (ruta: string, cuerpo: object) =>
      request(app).post(ruta).set('Cookie', cookie).send(cuerpo),
    sinCuerpo: (metodo: 'post' | 'put', ruta: string) =>
      request(app)[metodo](ruta).set('Cookie', cookie),
  };
}

const configuracionDe = async (codigo: string) =>
  (
    await cliente.query(
      `select id_personaje, id_cabello, id_rasgos, id_prenda, id_accesorio
       from app.configuracion_avatar where id_usuario = $1`,
      [ids[codigo]],
    )
  ).rows[0];

describe('Catálogo del avatar (F36, RF21, RF27, RF28)', () => {
  it('AV-01 · ofrece entre 2 y 4 opciones por capa, gratuitas y sin relación con la edad', async () => {
    const luna = await entrar('Usuario_001');
    const { catalogo } = (await luna.get('/api/avatar')).body as {
      catalogo: { tipo: string; nombre: string }[];
    };
    for (const tipo of ['personaje', 'cabello', 'rasgo', 'prenda', 'accesorio']) {
      const cantidad = catalogo.filter((e) => e.tipo === tipo).length;
      expect(cantidad, tipo).toBeGreaterThanOrEqual(2);
      expect(cantidad, tipo).toBeLessThanOrEqual(4);
    }
    expect(catalogo.map((e) => e.nombre).join(' ')).not.toMatch(/años|edad|niñ|adult|\d/i);

    // Sin precios, monedas ni artículos premium (RF27): el catálogo no tiene dónde guardarlos.
    const columnas = await cliente.query(
      `select column_name from information_schema.columns
       where table_schema = 'app' and table_name = 'elemento_avatar'`,
    );
    expect(columnas.rows.map((c) => c.column_name).join(' ')).not.toMatch(
      /precio|costo|moneda|premium|pago/,
    );
  });

  it('cada elemento registra su origen y su licencia (RF28)', async () => {
    const { rows } = await cliente.query(
      `select count(*)::int as sin_datos from app.elemento_avatar
       where trim(origen) = '' or trim(licencia) = ''`,
    );
    expect(rows[0].sin_datos).toBe(0);
  });

  it('la base no admite un recurso gráfico que no sea una clave de dibujo (p. ej. una URL)', async () => {
    await expect(
      cliente.query(
        `insert into app.elemento_avatar (id_elemento, tipo, nombre, recurso_grafico, origen, licencia)
         values ('foto-externa', 'accesorio', 'Foto', 'https://ejemplo.com/foto.png', 'x', 'x')`,
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('la base no admite un elemento de otra capa en la configuración', async () => {
    await expect(
      cliente.query(
        `update app.configuracion_avatar set id_prenda = 'cabello-corto' where id_usuario = $1`,
        [ids.Usuario_001],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });
});

describe('Mi avatar (F36, F37)', () => {
  it('AV-02 · guarda la apariencia y la recupera al volver a entrar', async () => {
    const luna = await entrar('Usuario_001');
    const guardado = await luna.put('/api/avatar', NUEVA);
    expect(guardado.status).toBe(200);
    expect(guardado.body).toEqual({ configuracion: NUEVA, apariencia: NUEVA });

    const otraSesion = await entrar('Usuario_001');
    expect((await otraSesion.get('/api/avatar')).body.configuracion).toEqual(NUEVA);
  });

  it('cabello y accesorio se pueden quitar', async () => {
    const luna = await entrar('Usuario_001');
    const res = await luna.put('/api/avatar', { ...NUEVA, cabello: null, accesorio: null });
    expect(res.status).toBe(200);
    expect(res.body.apariencia).toMatchObject({ cabello: null, accesorio: null });
  });

  it('AV-03 · la misma apariencia aparece en el perfil, en hilos, en respuestas y en la sala', async () => {
    const luna = await entrar('Usuario_001');
    const sol = await entrar('Usuario_002');
    await luna.put('/api/avatar', NUEVA);

    const perfil = (await luna.get('/api/perfil')).body.perfil;
    const perfilVistoPorSol = (await sol.get(`/api/perfiles/${ids.Usuario_001}`)).body.perfil;
    const hilo = (
      await luna.post('/api/comunidad/hilos', {
        categoria: 'bienestar-cotidiano',
        titulo: 'Probando mi avatar',
        contenido: 'Un hilo de prueba.',
      })
    ).body.hilo;
    const conRespuesta = (
      await luna.post(`/api/comunidad/hilos/${hilo.id}/respuestas`, {
        contenido: 'Y una respuesta.',
      })
    ).body;
    const enSala = await crearRepositorioSalas(enCola(cliente)).participante(ids.Usuario_001!);

    for (const avatar of [
      perfil.avatar,
      perfilVistoPorSol.avatar,
      hilo.autor.avatar,
      conRespuesta.respuestas.at(-1).autor.avatar,
      enSala.avatar,
    ]) {
      expect(avatar).toEqual(NUEVA);
    }
  });

  it.each([
    ['una URL', { ...NUEVA, personaje: 'https://ejemplo.com/foto.png' }],
    ['texto libre', { ...NUEVA, cabello: 'mi nombre es Luna' }],
    ['un teléfono', { ...NUEVA, prenda: '3000000000' }],
    ['una imagen', { ...NUEVA, accesorio: 'data:image/png;base64,iVBORw0KGgo=' }],
    ['un campo de foto', { ...NUEVA, foto: 'data:image/jpeg;base64,/9j/4AAQ' }],
    ['un texto con contacto', { ...NUEVA, texto: 'Escríbeme al 3000000000' }],
    ['un elemento de otra capa', { ...NUEVA, prenda: 'cabello-corto' }],
  ])('AV-11 · rechaza %s y no cambia nada', async (_caso, cuerpo) => {
    const antes = await configuracionDe('Usuario_001');
    const luna = await entrar('Usuario_001');
    const res = await luna.put('/api/avatar', cuerpo);

    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe('AVATAR_INVALIDO');
    expect(JSON.stringify(res.body)).not.toMatch(/3000000000|ejemplo\.com|base64/);
    expect(await configuracionDe('Usuario_001')).toEqual(antes);
  });

  it('AV-11 · no hay forma de subir una foto: no existe ninguna ruta de carga', async () => {
    const luna = await entrar('Usuario_001');
    const png = Buffer.from('89504e470d0a1a0a', 'hex');

    expect((await luna.post('/api/avatar', NUEVA)).status).toBe(404);
    expect(
      (await luna.sinCuerpo('post', '/api/avatar/foto').attach('foto', png, 'foto.png')).status,
    ).toBe(404);
    expect(
      (await luna.sinCuerpo('put', '/api/avatar').attach('foto', png, 'foto.png')).status,
    ).toBe(400);
  });

  it('un usuario no puede modificar el avatar de otro', async () => {
    const antes = await configuracionDe('Usuario_002');
    const luna = await entrar('Usuario_001');

    expect((await luna.put('/api/avatar', { ...NUEVA, idUsuario: ids.Usuario_002 })).status).toBe(
      400,
    );
    expect((await luna.put(`/api/avatar/${ids.Usuario_002}`, NUEVA)).status).toBe(404);
    expect(await configuracionDe('Usuario_002')).toEqual(antes);
  });

  it('un elemento desactivado ya no se ofrece ni se puede elegir', async () => {
    await cliente.query(
      `update app.elemento_avatar set estado = 'inactivo' where id_elemento = 'accesorio-gorra'`,
    );
    const luna = await entrar('Usuario_001');

    const { catalogo } = (await luna.get('/api/avatar')).body as { catalogo: { id: string }[] };
    expect(catalogo.map((e) => e.id)).not.toContain('accesorio-gorra');
    expect((await luna.put('/api/avatar', { ...NUEVA, accesorio: 'accesorio-gorra' })).status).toBe(
      400,
    );
  });

  it('sin sesión no se ve ni se cambia; el moderador lo ve pero no lo personaliza (A.2)', async () => {
    expect((await request(app).get('/api/avatar')).status).toBe(401);
    expect((await request(app).put('/api/avatar').send(NUEVA)).status).toBe(401);

    const moderador = await entrar('Moderador_001');
    expect((await moderador.get('/api/avatar')).status).toBe(200);
    expect((await moderador.put('/api/avatar', NUEVA)).status).toBe(403);
  });
});
