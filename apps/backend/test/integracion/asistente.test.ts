/** Asistente admin: endpoint real, roles reales y conteos comparados con la base sintética. */
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
    config: { ...configPrueba, openai: { apiKey: 'clave-falsa-de-prueba', model: 'modelo-test' } },
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

describe('endpoint de asistente IA admin', () => {
  it('permite al ADMIN, deniega otros roles y comprueba los conteos con PostgreSQL', async () => {
    const admin = await entrar('Admin_001');
    const moderador = await entrar('Moderador_001');

    const anonimo = await request(app)
      .post('/api/admin/asistente')
      .send({ pregunta: 'Resumen del panel' });
    const denegado = await request(app)
      .post('/api/admin/asistente')
      .set('Cookie', moderador)
      .send({ pregunta: 'Resumen del panel' });
    expect(anonimo.status).toBe(401);
    expect(denegado.status).toBe(403);

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  tool_calls: [
                    { id: 'call-1', function: { name: 'getReportsSummary', arguments: '{}' } },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockImplementationOnce(async (_url: unknown, init: RequestInit) => {
        const cuerpo = JSON.parse(String(init.body)) as {
          messages: { role: string; content: string | null }[];
        };
        const herramienta = cuerpo.messages.find((mensaje) => mensaje.role === 'tool');
        const estadisticas = JSON.parse(herramienta?.content ?? '{}') as {
          estados: Record<string, number>;
          hoy: number;
          ayer: number;
        };
        const esperado = await pool.query(`
          select
            (select count(*)::int from app.reporte where estado = 'pendiente') as pendientes,
            count(*) filter (where (fecha_reporte at time zone 'America/Bogota')::date =
              (now() at time zone 'America/Bogota')::date)::int as hoy,
            count(*) filter (where (fecha_reporte at time zone 'America/Bogota')::date =
              (now() at time zone 'America/Bogota')::date - 1)::int as ayer
          from app.reporte`);
        expect(estadisticas.estados.pendiente ?? 0).toBe(esperado.rows[0]!.pendientes);
        expect(estadisticas.hoy).toBe(esperado.rows[0]!.hoy);
        expect(estadisticas.ayer).toBe(esperado.rows[0]!.ayer);
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Resumen de reportes verificado.' } }],
          }),
          { status: 200 },
        );
      });

    const permitido = await request(app)
      .post('/api/admin/asistente')
      .set('Cookie', admin)
      .send({ pregunta: '¿Cuántos reportes recibimos hoy?' });
    expect(permitido.status).toBe(200);
    expect(permitido.headers['cache-control']).toBe('no-store');
    expect(permitido.body.respuesta).toBe('Resumen de reportes verificado.');
    expect(JSON.stringify(permitido.body)).not.toContain('clave-falsa-de-prueba');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
