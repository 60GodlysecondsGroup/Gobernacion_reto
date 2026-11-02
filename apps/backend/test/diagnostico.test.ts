import { describe, expect, it } from 'vitest';
import {
  datosError,
  presenciaVariablesObligatorias,
  sanitizarRuta,
  sanitizarTexto,
} from '../src/lib/diagnostico.js';

describe('instrumentación diagnóstica', () => {
  it('redacta URLs, credenciales y tokens de texto', () => {
    const texto =
      'Falló redis://default:clave-falsa@cache.example:6379; Authorization: Bearer token-falso; password=otra-clave';
    const seguro = sanitizarTexto(texto);

    expect(seguro).not.toContain('clave-falsa');
    expect(seguro).not.toContain('token-falso');
    expect(seguro).not.toContain('otra-clave');
    expect(seguro).not.toContain('cache.example:6379');
    expect(seguro).toContain('redis://[REDACTADO]');
    expect(seguro).toContain('Authorization: [REDACTADO]');
  });

  it('registra solo presencia booleana de variables obligatorias', () => {
    const presencia = presenciaVariablesObligatorias();

    expect(Object.keys(presencia)).toEqual(['DATABASE_URL', 'SESSION_SECRET', 'REDIS_URL']);
    expect(Object.values(presencia).every((valor) => typeof valor === 'boolean')).toBe(true);
  });

  it('quita query strings e identifica segmentos privados de la ruta', () => {
    expect(sanitizarRuta('/api/perfiles/persona@example.com?token=secreto')).toBe(
      '/api/perfiles/[CORREO_REDACTADO]',
    );
  });

  it('incluye nombre, código y marcos de stack sin incluir el mensaje arbitrario por defecto', () => {
    const error = Object.assign(new Error('falló con correo persona@example.com'), {
      code: 'ECONNREFUSED',
    });
    const datos = datosError(error);

    expect(datos.nombre).toBe('Error');
    expect(datos.codigo).toBe('ECONNREFUSED');
    expect(datos.stack).toContain('diagnostico.test.ts');
    expect(datos).not.toHaveProperty('mensaje');
    expect(JSON.stringify(datos)).not.toContain('persona@example.com');
  });

  it('puede incluir un mensaje sanitizado para errores de infraestructura', () => {
    const error = new Error('No conecta con rediss://default:clave-falsa@cache.example:6379');
    const datos = datosError(error, true);

    expect(datos.mensaje).toBe('No conecta con rediss://[REDACTADO]');
    expect(JSON.stringify(datos)).not.toContain('clave-falsa');
  });
});
