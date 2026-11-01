import { describe, expect, it } from 'vitest';
import {
  hashearContrasena,
  problemaDeContrasena,
  verificarContrasena,
} from '../src/modules/seguridad/contrasena.js';
import { crearLimitador } from '../src/modules/seguridad/limitador.js';
import { crearToken, verificarToken } from '../src/modules/seguridad/sesion.token.js';

describe('Hash de contraseñas (scrypt)', () => {
  it('verifica la contraseña correcta y rechaza cualquier otra', async () => {
    const hash = await hashearContrasena('luciernaga-azul-27');
    expect(hash).toMatch(/^scrypt\$131072\$8\$1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
    expect(hash).not.toContain('luciernaga');
    expect(await verificarContrasena('luciernaga-azul-27', hash)).toBe(true);
    expect(await verificarContrasena('luciernaga-azul-28', hash)).toBe(false);
    expect(await verificarContrasena('', hash)).toBe(false);
  });

  it('usa una sal distinta en cada hash', async () => {
    const [a, b] = await Promise.all([
      hashearContrasena('igual-igual'),
      hashearContrasena('igual-igual'),
    ]);
    expect(a).not.toBe(b);
  });

  it('un hash con formato desconocido o alterado nunca valida', async () => {
    expect(await verificarContrasena('x', 'texto-plano')).toBe(false);
    expect(await verificarContrasena('x', 'bcrypt$1$2$3$a$b')).toBe(false);
    const hash = await hashearContrasena('original-123');
    expect(await verificarContrasena('original-123', `${hash.slice(0, -4)}AAAA`)).toBe(false);
  });

  it('aplica la política mínima de contraseñas', () => {
    expect(problemaDeContrasena('corta')).toMatch(/al menos 8/);
    expect(problemaDeContrasena('x'.repeat(129))).toMatch(/máximo 128/);
    expect(problemaDeContrasena('12345678')).toMatch(/fácil de adivinar/);
    expect(problemaDeContrasena('aaaaaaaaaa')).toMatch(/fácil de adivinar/);
    expect(problemaDeContrasena('soy-Rayito77-ok', 'rayito77')).toMatch(/nametag/);
    expect(problemaDeContrasena('luciernaga-azul-27', 'Rayito77')).toBeNull();
  });
});

describe('Límite de intentos', () => {
  it('bloquea al llegar al máximo y libera al vencer la ventana', () => {
    const limitador = crearLimitador({ maximo: 3, ventanaMs: 60_000 });
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(limitador.bloqueadoPor('ip|alias', t0)).toBe(0);
      limitador.registrar('ip|alias', t0);
    }
    expect(limitador.bloqueadoPor('ip|alias', t0 + 1_000)).toBe(59);
    expect(limitador.bloqueadoPor('otra-clave', t0)).toBe(0);
    expect(limitador.bloqueadoPor('ip|alias', t0 + 60_000)).toBe(0);
  });

  it('reiniciar borra los intentos de una clave', () => {
    const limitador = crearLimitador({ maximo: 1, ventanaMs: 60_000 });
    limitador.registrar('clave');
    expect(limitador.bloqueadoPor('clave')).toBeGreaterThan(0);
    limitador.reiniciar('clave');
    expect(limitador.bloqueadoPor('clave')).toBe(0);
  });
});

describe('Token de sesión', () => {
  const SECRETO = 'secreto-solo-para-pruebas-automatizadas-0000';

  it('lleva solo el id de la sesión y la expiración, no datos del usuario', () => {
    const token = crearToken('id-sesion', SECRETO, 60_000);
    const contenido = JSON.parse(Buffer.from(token.split('.')[0]!, 'base64url').toString('utf8'));
    expect(Object.keys(contenido).sort()).toEqual(['exp', 's']);
    expect(verificarToken(token, SECRETO)).toBe('id-sesion');
  });
});
