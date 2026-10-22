import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.js';
import type { Database } from '../src/db/database.js';
import { crearLogger } from '../src/lib/logger.js';
import { configPrueba, ORIGEN_FRONTEND } from './apoyo.js';

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

const app = (escenario: Escenario = 'ok', config = configPrueba) =>
  crearApp({ db: dbSimulada(escenario), logger: crearLogger('silencioso'), config });

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

  it('permite CORS para los orígenes del frontend configurados', async () => {
    const configConVercel = {
      ...configPrueba,
      origenesPermitidos: [ORIGEN_FRONTEND, 'https://gobernacion-reto-i8so.vercel.app'],
    };
    const appVercel = app('ok', configConVercel);

    const permitidoLocal = await request(appVercel).get('/api/salud').set('Origin', ORIGEN_FRONTEND);
    expect(permitidoLocal.headers['access-control-allow-origin']).toBe(ORIGEN_FRONTEND);

    const permitidoVercel = await request(appVercel)
      .get('/api/salud')
      .set('Origin', 'https://gobernacion-reto-i8so.vercel.app');
    expect(permitidoVercel.headers['access-control-allow-origin']).toBe(
      'https://gobernacion-reto-i8so.vercel.app',
    );

    const ajeno = await request(appVercel)
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

describe('Guardianes de seguridad (sin base de datos)', () => {
  it.each([
    '/api/comunidad',
    '/api/perfil',
    '/api/perfiles?buscar=Luna',
    '/api/moderacion/incidencias-dlp',
    '/api/gestion/fuentes',
    '/api/comunidad/hilos',
    '/api/comunidad/categorias',
  ])('sin sesión, %s responde 401', async (ruta) => {
    const res = await request(app()).get(ruta);
    expect(res.status).toBe(401);
    expect(res.body.error.codigo).toBe('NO_AUTENTICADO');
  });

  it('una cookie de sesión falsificada no da acceso', async () => {
    const res = await request(app())
      .get('/api/comunidad')
      .set('Cookie', 'sesion=eyJ1IjoieCIsImV4cCI6OTk5OTk5OTk5OTk5OX0.firma-falsa');
    expect(res.status).toBe(401);
  });

  it('rechaza escrituras desde un origen distinto al frontend', async () => {
    const res = await request(app())
      .post('/api/sesion')
      .set('Origin', 'https://sitio-ajeno.example')
      .send({ codigo: 'Usuario_001' });
    expect(res.status).toBe(403);
    expect(res.body.error.codigo).toBe('ORIGEN_NO_PERMITIDO');
  });

  it('sin modo demo no existe el selector de usuarios sintéticos', async () => {
    const sinDemo = app('ok', { ...configPrueba, accesoDemo: false });
    expect((await request(sinDemo).get('/api/sesion/usuarios-demo')).status).toBe(404);
    expect(
      (await request(sinDemo).post('/api/sesion').send({ codigo: 'Usuario_001' })).status,
    ).toBe(404);
  });

  it('sin sesión, GET /api/sesion responde usuario null', async () => {
    const res = await request(app()).get('/api/sesion');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ usuario: null });
  });

  it('si la base no responde, una ruta de datos responde 503 claro, sin detalles internos', async () => {
    const res = await request(app('sin_conexion')).get('/api/orientacion/necesidades');
    expect(res.status).toBe(503);
    expect(res.body.error).toEqual({
      codigo: 'SERVICIO_NO_DISPONIBLE',
      mensaje: 'El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.',
    });
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
  });

  it('con un host que no existe (DATABASE_URL sin completar) también responde 503', async () => {
    const sinHost = {
      async query() {
        throw Object.assign(new Error('getaddrinfo ENOTFOUND HOST'), { code: 'ENOTFOUND' });
      },
    } as Database;
    const res = await request(
      crearApp({ db: sinHost, logger: crearLogger('silencioso'), config: configPrueba }),
    ).get('/api/orientacion/necesidades');
    expect(res.status).toBe(503);
  });
});
