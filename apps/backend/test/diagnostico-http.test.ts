import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { crearApp } from '../src/app.js';
import type { Database } from '../src/db/database.js';
import type { Logger } from '../src/lib/logger.js';
import { configPrueba } from './apoyo.js';

describe('diagnóstico de errores HTTP', () => {
  it('registra requestId, ruta, código y stack sin copiar el mensaje privado', async () => {
    const eventos: Array<{ mensaje: string; datos?: Record<string, unknown> }> = [];
    const logger: Logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn((mensaje, datos) => eventos.push({ mensaje, datos })),
    };
    const db: Database = {
      async query(sql) {
        if (sql.trim() === 'select 1') return { rows: [{}] } as never;
        throw Object.assign(new Error('fallo con dato privado@example.com'), { code: '57014' });
      },
    };

    const respuesta = await request(crearApp({ db, logger, config: configPrueba }))
      .get('/api/salud')
      .set('x-vercel-id', 'iad1::request-de-prueba');
    const evento = eventos.find(({ mensaje }) => mensaje === 'Error no controlado');

    expect(respuesta.status).toBe(500);
    expect(evento?.datos).toMatchObject({
      idSolicitud: respuesta.headers['x-request-id'],
      idVercel: 'iad1::request-de-prueba',
      ruta: 'GET /api/salud',
      nombre: 'Error',
      codigo: '57014',
    });
    expect(evento?.datos?.stack).toContain('diagnostico-http.test.ts');
    expect(JSON.stringify(evento)).not.toContain('dato privado@example.com');
  });
});
