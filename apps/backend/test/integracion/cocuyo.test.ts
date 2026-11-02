/** Cocuyo con la aplicación completa: ruta pública, reglas DLP de la base y proveedor simulado. */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearApp } from '../../src/app.js';
import { cargarConfig } from '../../src/config/env.js';
import { crearPool, type PoolDeDatos } from '../../src/db/database.js';
import { crearLogger } from '../../src/lib/logger.js';
import { RESPUESTAS_RESERVA } from '../../src/modules/cocuyo/cocuyo.catalogo.js';
import { cookieDe, configPrueba, ORIGEN_FRONTEND } from '../apoyo.js';

let pool: PoolDeDatos;
let app: ReturnType<typeof crearApp>;
const fetchMock = vi.fn();
const REFORMULACION =
  'Cada sala tiene un tema fijo y admite hasta 10 personas. Puedes salir cuando quieras con «Salir de la sala».';

beforeAll(() => {
  vi.stubGlobal('fetch', fetchMock);
  pool = crearPool(cargarConfig().baseDeDatos);
  app = crearApp({
    db: pool,
    logger: crearLogger('silencioso'),
    config: { ...configPrueba, openai: { apiKey: 'clave-falsa-de-prueba', model: 'modelo-test' } },
  });
});

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(
    async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: REFORMULACION } }] }), {
        status: 200,
      }),
  );
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await pool.end();
});

const preguntar = (mensaje: string, cookie?: string) => {
  const solicitud = request(app).post('/api/guia/cocuyo').set('Origin', ORIGEN_FRONTEND);
  return (cookie ? solicitud.set('Cookie', cookie) : solicitud).send({ mensaje });
};

describe('Cocuyo con PostgreSQL', () => {
  it('responde sin sesión y con sesión de cualquier rol, solo con temas del catálogo', async () => {
    const anonima = await preguntar('¿Cómo funcionan las salas?');
    expect(anonima.status).toBe(200);
    expect(anonima.body).toMatchObject({ intencion: 'salas', origen: 'ia', texto: REFORMULACION });

    const usuario = await preguntar(
      '¿Cómo funcionan las salas?',
      await cookieDe(pool, 'Usuario_001'),
    );
    expect(usuario.body).toMatchObject({ intencion: 'salas' });

    const fuera = await preguntar('cuéntame un chiste', await cookieDe(pool, 'Moderador_001'));
    expect(fuera.body).toMatchObject({ tipo: 'fuera_de_alcance' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('usa las reglas DLP activas de la base y no envía datos personales a la IA', async () => {
    const eventosAntes = await pool.query('select count(*)::int as total from app.evento_dlp');
    const respuesta = await preguntar(
      'voy a cumplir quince años, ¿quién puede ver lo que publico?',
    );
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      intencion: 'comunidad',
      origen: 'predeterminada',
      aviso: RESPUESTAS_RESERVA.datosPersonales,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    // El mensaje no se publica: no se registra como incidencia DLP.
    const eventosDespues = await pool.query('select count(*)::int as total from app.evento_dlp');
    expect(eventosDespues.rows[0].total).toBe(eventosAntes.rows[0].total);
  });

  it('si el proveedor falla, responde igual con la respuesta predeterminada', async () => {
    fetchMock.mockImplementation(async () => new Response('caído', { status: 503 }));
    const respuesta = await preguntar('¿Qué hago si algo me incomoda?');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ intencion: 'reportar', origen: 'predeterminada' });
  });

  it('rechaza escrituras desde otros orígenes', async () => {
    const respuesta = await request(app)
      .post('/api/guia/cocuyo')
      .set('Origin', 'https://otro-sitio.example')
      .send({ mensaje: '¿Cómo funcionan las salas?' });
    expect(respuesta.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
