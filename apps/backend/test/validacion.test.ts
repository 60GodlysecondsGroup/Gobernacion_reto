import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { cargarConfig } from '../src/config/env.js';
import { ErrorApp } from '../src/http/errores.js';
import { validar } from '../src/http/validacion.js';

describe('validar()', () => {
  const esquema = z.object({ titulo: z.string().trim().min(3).max(120) });

  it('devuelve los datos normalizados cuando son válidos', () => {
    expect(validar(esquema, { titulo: '  Me cuesta adaptarme  ' })).toEqual({
      titulo: 'Me cuesta adaptarme',
    });
  });

  it('lanza un 400 con los campos inválidos, sin repetir el valor recibido', () => {
    let capturado: unknown;
    try {
      validar(esquema, { titulo: 'xq' });
    } catch (error) {
      capturado = error;
    }

    expect(capturado).toBeInstanceOf(ErrorApp);
    const error = capturado as ErrorApp;
    expect(error.estado).toBe(400);
    expect(error.detalles).toEqual([{ campo: 'titulo', mensaje: expect.any(String) }]);
    expect(JSON.stringify(error.detalles)).not.toContain('xq');
  });
});

describe('cargarConfig()', () => {
  const URL_PRUEBA = 'postgresql://usuario:clave@localhost:5432/postgres';

  it('aplica valores por defecto seguros', () => {
    const config = cargarConfig({ DATABASE_URL: URL_PRUEBA });

    expect(config).toMatchObject({
      entorno: 'development',
      puerto: 4000,
      origenesPermitidos: ['http://localhost:3000'],
      baseDeDatos: { url: URL_PRUEBA, ssl: 'require' },
    });
  });

  it('usa BACKEND_PORT e ignora PORT, que reservan Next.js y otras herramientas', () => {
    expect(cargarConfig({ DATABASE_URL: URL_PRUEBA, PORT: '3000' }).puerto).toBe(4000);
    expect(cargarConfig({ DATABASE_URL: URL_PRUEBA, BACKEND_PORT: '4100' }).puerto).toBe(4100);
  });

  it('sin SESSION_SECRET (o vacío) usa uno temporal; en producción es obligatorio', () => {
    const vacio = cargarConfig({ DATABASE_URL: URL_PRUEBA, SESSION_SECRET: '' });
    expect(vacio.sesion).toMatchObject({ secretoGenerado: true });
    expect(vacio.sesion.secreto).toHaveLength(64);
    expect(() => cargarConfig({ DATABASE_URL: URL_PRUEBA, SESSION_SECRET: 'corto' })).toThrow(
      /32 caracteres/,
    );
    expect(() => cargarConfig({ DATABASE_URL: URL_PRUEBA, NODE_ENV: 'production' })).toThrow(
      /SESSION_SECRET/,
    );
  });

  it('el acceso de demostración está activo en desarrollo y apagado en producción', () => {
    const produccion = {
      DATABASE_URL: URL_PRUEBA,
      NODE_ENV: 'production',
      SESSION_SECRET: 'x'.repeat(32),
    };
    expect(cargarConfig({ DATABASE_URL: URL_PRUEBA }).accesoDemo).toBe(true);
    expect(cargarConfig(produccion).accesoDemo).toBe(false);
    expect(cargarConfig({ DATABASE_URL: URL_PRUEBA, ACCESO_DEMO: 'false' }).accesoDemo).toBe(false);
  });

  it('admite varios orígenes de CORS separados por coma y elimina barras finales', () => {
    const config = cargarConfig({
      DATABASE_URL: URL_PRUEBA,
      FRONTEND_ORIGIN:
        'http://localhost:3000/, https://gobernacion-reto-i8so.vercel.app/, http://127.0.0.1:3000',
    });
    expect(config.origenesPermitidos).toEqual([
      'http://localhost:3000',
      'https://gobernacion-reto-i8so.vercel.app',
      'http://127.0.0.1:3000',
    ]);
  });

  it('permite configurar COOKIE_SAME_SITE para despliegues entre dominios', () => {
    const config = cargarConfig({
      DATABASE_URL: URL_PRUEBA,
      COOKIE_SAME_SITE: 'none',
    });
    expect(config.sesion.sameSite).toBe('none');
  });

  it('falla con un mensaje claro si falta DATABASE_URL', () => {
    expect(() => cargarConfig({})).toThrow(/DATABASE_URL/);
  });
});
