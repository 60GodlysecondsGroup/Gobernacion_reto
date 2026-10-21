import { describe, expect, it } from 'vitest';
import {
  permisosDe,
  ROLES,
  tienePermiso,
  type Permiso,
  type Rol,
} from '../src/modules/seguridad/permisos.js';
import { proveedorRangoSintetico } from '../src/modules/seguridad/rango-edad.js';
import { leerCookie } from '../src/modules/seguridad/sesion.middleware.js';
import { crearToken, verificarToken } from '../src/modules/seguridad/sesion.token.js';

const SECRETO = 'secreto-solo-para-pruebas-automatizadas-0000';

describe('Token de sesión', () => {
  it('verifica un token propio y devuelve el id del usuario', () => {
    const token = crearToken('id-usuario', SECRETO, 60_000);
    expect(verificarToken(token, SECRETO)).toBe('id-usuario');
  });

  it('rechaza un token con el contenido alterado', () => {
    const [, firma] = crearToken('id-usuario', SECRETO, 60_000).split('.');
    const otroContenido = Buffer.from(
      JSON.stringify({ u: 'otro', exp: Date.now() + 60_000 }),
    ).toString('base64url');
    expect(verificarToken(`${otroContenido}.${firma}`, SECRETO)).toBeNull();
  });

  it('rechaza un token firmado con otro secreto', () => {
    expect(verificarToken(crearToken('id', 'otro-secreto-cualquiera', 60_000), SECRETO)).toBeNull();
  });

  it('rechaza un token vencido', () => {
    const token = crearToken('id', SECRETO, 1_000, Date.now() - 10_000);
    expect(verificarToken(token, SECRETO)).toBeNull();
  });

  it('lee la cookie de sesión entre otras cookies', () => {
    expect(leerCookie('a=1; sesion=abc.def; b=2', 'sesion')).toBe('abc.def');
    expect(leerCookie('a=1', 'sesion')).toBeUndefined();
  });
});

describe('Matriz de permisos (Anexo A.2)', () => {
  const casos: [Rol, Permiso, boolean][] = [
    ['usuario', 'ver_comunidad_propia', true],
    ['usuario', 'crear_hilo', true],
    ['usuario', 'reportar_contenido', true],
    ['usuario', 'revisar_reportes', false],
    ['usuario', 'revisar_incidencias_dlp', false],
    ['usuario', 'gestionar_fuentes', false],
    ['usuario', 'crear_sala_tematica', false],
    ['moderador', 'revisar_reportes', true],
    ['moderador', 'revisar_incidencias_dlp', true],
    ['moderador', 'gestionar_reglas_dlp', false],
    ['moderador', 'gestionar_fuentes', false],
    ['moderador', 'personalizar_avatar_propio', false],
    ['gestor_fuentes', 'gestionar_fuentes', true],
    ['gestor_fuentes', 'ver_comunidad_propia', false],
    ['gestor_fuentes', 'revisar_reportes', false],
    ['admin_plataforma', 'gestionar_reglas_dlp', true],
    ['admin_plataforma', 'configurar_comunidades', true],
  ];

  it.each(casos)('%s → %s: %s', (rol, permiso, esperado) => {
    expect(tienePermiso(rol, permiso)).toBe(esperado);
  });

  it('todos los roles consultan orientación y editan su propio perfil', () => {
    for (const rol of ROLES) {
      expect(permisosDe(rol)).toEqual(
        expect.arrayContaining(['consultar_orientacion', 'editar_perfil_propio']),
      );
    }
  });
});

describe('Proveedor de rango de edad (provisional)', () => {
  it('toma el rango del usuario sintético y devuelve null para el personal', async () => {
    expect(await proveedorRangoSintetico.determinarRango({ idUsuario: 'x', rangoEdad: 'B' })).toBe(
      'B',
    );
    expect(
      await proveedorRangoSintetico.determinarRango({ idUsuario: 'x', rangoEdad: null }),
    ).toBeNull();
  });

  it('rechaza un rango desconocido en lugar de adivinar', async () => {
    await expect(
      proveedorRangoSintetico.determinarRango({ idUsuario: 'x', rangoEdad: 'Z' }),
    ).rejects.toThrow(/desconocido/);
  });
});
