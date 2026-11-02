import type { RequestHandler, Response } from 'express';
import { errores } from '../../http/errores.js';
import type { Sesion } from './sesion.service.js';

export const ROLES = [
  'usuario',
  'moderador',
  'admin_plataforma',
  'gestor_fuentes',
  'superadmin',
] as const;
export type Rol = (typeof ROLES)[number];

/**
 * Roles de personal que la administración crea y asigna desde el panel. Entran con correo y
 * contraseña (`POST /api/sesion/personal`), nunca por «Iniciar con mi Avatar».
 */
export const ROLES_PERSONAL = ['moderador', 'gestor_fuentes'] as const satisfies readonly Rol[];
export type RolPersonal = (typeof ROLES_PERSONAL)[number];

export const esRolPersonal = (rol: string): rol is RolPersonal =>
  (ROLES_PERSONAL as readonly string[]).includes(rol);

/**
 * Roles de administración de la plataforma. `superadmin` tiene todos los permisos de
 * `admin_plataforma` y, además, gestiona estas mismas cuentas (`gestionar_administradores`).
 * Sus cuentas solo se gestionan desde la sección Superadmin, nunca desde el panel general.
 */
export const ROLES_ADMINISTRACION = [
  'admin_plataforma',
  'superadmin',
] as const satisfies readonly Rol[];
export type RolAdministracion = (typeof ROLES_ADMINISTRACION)[number];

export const esRolAdministracion = (rol: string): rol is RolAdministracion =>
  (ROLES_ADMINISTRACION as readonly string[]).includes(rol);

const TODOS: readonly Rol[] = ROLES;
const ADMIN = ROLES_ADMINISTRACION;

/**
 * Matriz general de permisos del Anexo A.2. Las celdas «según permisos / configuración /
 * limitado» se resuelven así (ver DECISIONES.md):
 *  - moderador: ve comunidad solo si tiene una asignada, responde, entra a salas, consulta
 *    registros y gestiona usuarios de forma limitada (Fase 7); no crea hilos por defecto.
 *  - gestor de fuentes: consulta registros administrativos (bitácora de fuentes).
 *  - superadmin: todo lo de la administración y, solo él, la gestión de sus cuentas.
 */
const MATRIZ = {
  consultar_orientacion: TODOS,
  editar_perfil_propio: TODOS,
  ver_comunidad_propia: ['usuario', 'moderador', ...ADMIN],
  crear_hilo: ['usuario', ...ADMIN],
  responder_hilo: ['usuario', 'moderador', ...ADMIN],
  acceder_salas: ['usuario', 'moderador', ...ADMIN],
  personalizar_avatar_propio: ['usuario', ...ADMIN],
  crear_sala_tematica: [...ADMIN],
  reportar_contenido: ['usuario', 'moderador', ...ADMIN],
  revisar_reportes: ['moderador', ...ADMIN],
  revisar_incidencias_dlp: ['moderador', ...ADMIN],
  gestionar_usuarios: ['moderador', ...ADMIN],
  // Crear cuentas de personal y cambiar su rol: nadie se asigna privilegios a sí mismo.
  gestionar_personal: [...ADMIN],
  consultar_reglas_dlp: ['moderador', ...ADMIN],
  gestionar_reglas_dlp: [...ADMIN],
  gestionar_fuentes: [...ADMIN, 'gestor_fuentes'],
  configurar_comunidades: [...ADMIN],
  consultar_registros_administrativos: ['moderador', ...ADMIN, 'gestor_fuentes'],
  usar_asistente_admin: [...ADMIN],
  // Cuentas de administración (crear, editar, activar, desactivar, cambiar o revocar el rol,
  // restablecer la contraseña). Solo la superadministración: la administración no se gestiona a
  // sí misma ni puede elevarse.
  gestionar_administradores: ['superadmin'],
  usar_asistente_usuario: ['usuario'],
} as const satisfies Record<string, readonly Rol[]>;

export type Permiso = keyof typeof MATRIZ;

export const tienePermiso = (rol: Rol, permiso: Permiso): boolean =>
  (MATRIZ[permiso] as readonly Rol[]).includes(rol);

export const permisosDe = (rol: Rol): Permiso[] =>
  (Object.keys(MATRIZ) as Permiso[]).filter((permiso) => tienePermiso(rol, permiso));

/** Sesión con el permiso pedido, o 401 / 403. Para usar dentro de un handler. */
export function exigirPermiso(res: Response, permiso: Permiso): Sesion {
  const sesion = res.locals.sesion;
  if (!sesion) throw errores.noAutenticado();
  if (!tienePermiso(sesion.rol, permiso)) throw errores.prohibido();
  return sesion;
}

/**
 * Guardián reutilizable: 401 sin sesión, 403 si el rol no tiene el permiso.
 * Siempre en el backend; ocultar algo en la interfaz no es una medida de seguridad.
 */
export function requerirPermiso(permiso: Permiso): RequestHandler {
  return (_req, res, next) => {
    exigirPermiso(res, permiso);
    next();
  };
}
