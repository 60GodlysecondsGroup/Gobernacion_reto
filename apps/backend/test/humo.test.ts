import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.js';
import type { Database } from '../src/db/database.js';
import { crearLogger } from '../src/lib/logger.js';

const ORIGEN_FRONTEND = 'http://localhost:3000';
const CONTEO = { comunidades: 4, usuarios: 1, categorias: 5, salas: 1, fuentes: 1 };

type Escenario = 'ok' | 'sin_conexion' | 'sin_esquema' | 'falla_interna';

/** Base de datos simulada: la prueba de humo no depende de la red. */
function dbSimulada(escenario: Escenario): Database {
  const errorConCodigo = (mensaje: string, code: string) =>
    Object.assign(new Error(mensaje), { code });
  return {
    async query(sql: string) {
      if (escenario === 'sin_conexion')
        throw errorConCodigo('connect ECONNREFUSED', 'ECONNREFUSED');
      if (sql.trim() === 'select 1') return { rows: [{}] } as never;
      if (escenario === 'sin_esquema')
        throw errorConCodigo('relation "app.comunidad" does not exist', '42P01');
      if (escenario === 'falla_interna') throw errorConCodigo('detalle interno secreto', '57014');
      return { rows: [CONTEO] } as never;
    },
  };
}

const app = (escenario: Escenario = 'ok') =>
  crearApp({
    db: dbSimulada(escenario),
    logger: crearLogger('silencioso'),
    origenesPermitidos: [ORIGEN_FRONTEND],
  });

describe('Prueba de humo del backend', () => {
  it('GET /api/salud responde backend ok con la base conectada', async () => {
    const res = await request(app()).get('/api/salud');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      estado: 'ok',
      backend: 'ok',
      baseDeDatos: { estado: 'ok' },
      datosDemo: CONTEO,
    });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('sigue respondiendo y avisa si no hay conexión con la base', async () => {
    const res = await request(app('sin_conexion')).get('/api/salud');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      estado: 'degradado',
      backend: 'ok',
      baseDeDatos: { estado: 'sin_conexion', latenciaMs: null },
      datosDemo: null,
    });
  });

  it('avisa si falta inicializar el esquema', async () => {
    const res = await request(app('sin_esquema')).get('/api/salud');
    expect(res.body.baseDeDatos.estado).toBe('sin_esquema');
  });

  it('permite CORS solo al origen del frontend', async () => {
    const permitido = await request(app()).get('/api/salud').set('Origin', ORIGEN_FRONTEND);
    expect(permitido.headers['access-control-allow-origin']).toBe(ORIGEN_FRONTEND);

    const ajeno = await request(app())
      .get('/api/salud')
      .set('Origin', 'https://sitio-ajeno.example');
    expect(ajeno.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('responde 404 en JSON para rutas inexistentes', async () => {
    const res = await request(app()).get('/api/no-existe');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { codigo: 'NO_ENCONTRADO', mensaje: 'El recurso no existe.' },
    });
  });

  it('rechaza JSON mal formado con 400', async () => {
    const res = await request(app())
      .post('/api/salud')
      .set('Content-Type', 'application/json')
      .send('{"roto":');

    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe('JSON_INVALIDO');
  });

  it('no filtra detalles internos en errores 500', async () => {
    const res = await request(app('falla_interna')).get('/api/salud');

    expect(res.status).toBe(500);
    expect(res.body.error).toEqual({
      codigo: 'ERROR_INTERNO',
      mensaje: 'Ocurrió un error inesperado.',
    });
    expect(JSON.stringify(res.body)).not.toContain('secreto');
  });

  it('envía cabeceras de seguridad básicas y un id de solicitud', async () => {
    const res = await request(app()).get('/api/salud');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});
