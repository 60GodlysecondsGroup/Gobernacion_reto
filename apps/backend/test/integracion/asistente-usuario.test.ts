/** El asistente final usa exclusivamente las salas de la comunidad del usuario autenticado. */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { crearApp } from '../../src/app.js';
import { cargarConfig } from '../../src/config/env.js';
import { crearPool, type PoolDeDatos } from '../../src/db/database.js';
import { crearLogger } from '../../src/lib/logger.js';
import { configPrueba } from '../apoyo.js';

let pool: PoolDeDatos;
let app: ReturnType<typeof crearApp>;
const fetchMock = vi.fn();

beforeAll(() => {
  vi.stubGlobal('fetch', fetchMock);
  pool = crearPool(cargarConfig().baseDeDatos);
  app = crearApp({
    db: pool,
    logger: crearLogger('silencioso'),
    config: {
      ...configPrueba,
      openai: { apiKey: 'clave-falsa-de-prueba', model: 'modelo-test' },
    },
  });
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await pool.end();
});

async function entrar(codigo: string) {
  const inicio = await request(app).post('/api/sesion').send({ codigo });
  expect(inicio.status).toBe(201);
  return (inicio.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
}

describe('asistente de orientación de usuario con PostgreSQL', () => {
  it('permite solo a usuarios finales y no filtra salas entre comunidades', async () => {
    const usuarioB = await entrar('Usuario_001');
    const usuarioA = await entrar('Usuario_003');
    const admin = await entrar('Admin_001');
    const moderador = await entrar('Moderador_001');
    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Abre Ver sala para consultar sus detalles.' } }],
          }),
          { status: 200 },
        ),
    );

    const [salasB, salasA] = await Promise.all([
      request(app).get('/api/salas').set('Cookie', usuarioB),
      request(app).get('/api/salas').set('Cookie', usuarioA),
    ]);
    const [asistenteB, asistenteA] = await Promise.all([
      request(app)
        .post('/api/usuario/asistente')
        .set('Cookie', usuarioB)
        .send({ pregunta: '¿Qué salas hay disponibles?' }),
      request(app)
        .post('/api/usuario/asistente')
        .set('Cookie', usuarioA)
        .send({ pregunta: '¿Qué salas hay disponibles?' }),
    ]);

    expect(salasB.status).toBe(200);
    expect(salasA.status).toBe(200);
    expect(asistenteB.status).toBe(200);
    expect(asistenteA.status).toBe(200);
    const enlacesB = asistenteB.body.accesos.map((acceso: { href: string }) =>
      acceso.href.replace('/salas/', ''),
    );
    const enlacesA = asistenteA.body.accesos.map((acceso: { href: string }) =>
      acceso.href.replace('/salas/', ''),
    );
    expect(new Set(enlacesB)).toEqual(
      new Set(salasB.body.salas.map((sala: { id: string }) => sala.id)),
    );
    expect(new Set(enlacesA)).toEqual(
      new Set(salasA.body.salas.map((sala: { id: string }) => sala.id)),
    );
    expect(enlacesA).not.toEqual(enlacesB);

    expect(
      (
        await request(app)
          .post('/api/usuario/asistente')
          .set('Cookie', admin)
          .send({ pregunta: '¿Cómo uso las salas?' })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/usuario/asistente')
          .set('Cookie', moderador)
          .send({ pregunta: '¿Cómo uso las salas?' })
      ).status,
    ).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('contesta recursos con registros activos publicados, sin llamar al modelo', async () => {
    const usuario = await entrar('Usuario_001');
    fetchMock.mockClear();
    const respuesta = await request(app)
      .post('/api/usuario/asistente')
      .set('Cookie', usuario)
      .send({ pregunta: '¿Dónde encuentro los teléfonos de ayuda?' });
    const canales = await pool.query<{ telefono: string | null; institucion: string }>(`
      select f.telefono, f.institucion
      from app.fuente_institucional f
      join app.fuente_necesidad fn on fn.id_fuente = f.id_fuente
      where f.estado = 'activo'
        and fn.codigo_necesidad in ('lineas_ayuda', 'hablar_con_alguien')
    `);

    expect(respuesta.status).toBe(200);
    for (const canal of canales.rows) {
      expect(respuesta.body.respuesta).toContain(canal.institucion);
      if (canal.telefono) expect(respuesta.body.respuesta).toContain(canal.telefono);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
