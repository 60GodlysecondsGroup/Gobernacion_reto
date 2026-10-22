import type { RequestHandler, Response } from 'express';
import { errores } from '../../http/errores.js';
import type { Sesion } from './sesion.service.js';

export const ROLES = ['usuario', 'moderador', 'admin_plataforma', 'gestor_fuentes'] as const;
export type Rol = (typeof ROLES)[number];

const TODOS: readonly Rol[] = ROLES;

/**
 * Matriz general de permisos del Anexo A.2. Las celdas «según permisos / configuración /
 * limitado» se resuelven así (ver DECISIONES.md):
 *  - moderador: ve comunidad solo si tiene una asignada, responde, entra a salas, consulta
 *    registros y gestiona usuarios de forma limitada (Fase 7); no crea hilos por defecto.
 *  - gestor de fuentes: consulta registros administrativos (bitácora de fuentes).
 */
const MATRIZ = {
  consultar_orientacion: TODOS,
  editar_perfil_propio: TODOS,
  ver_comunidad_propia: ['usuario', 'moderador', 'admin_plataforma'],
  crear_hilo: ['usuario', 'admin_plataforma'],
  responder_hilo: ['usuario', 'moderador', 'admin_plataforma'],
  acceder_salas: ['usuario', 'moderador', 'admin_plataforma'],
  personalizar_avatar_propio: ['usuario', 'admin_plataforma'],
  crear_sala_tematica: ['admin_plataforma'],
  reportar_contenido: ['usuario', 'moderador', 'admin_plataforma'],
  revisar_reportes: ['moderador', 'admin_plataforma'],
  revisar_incidencias_dlp: ['moderador', 'admin_plataforma'],
  gestionar_usuarios: ['moderador', 'admin_plataforma'],
  consultar_reglas_dlp: ['moderador', 'admin_plataforma'],
  gestionar_reglas_dlp: ['admin_plataforma'],
  gestionar_fuentes: ['admin_plataforma', 'gestor_fuentes'],
  configurar_comunidades: ['admin_plataforma'],
  consultar_registros_administrativos: ['moderador', 'admin_plataforma', 'gestor_fuentes'],
  usar_asistente_admin: ['admin_plataforma'],
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
