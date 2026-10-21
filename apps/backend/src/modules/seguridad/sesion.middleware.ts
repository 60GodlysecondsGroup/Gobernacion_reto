import type { RequestHandler, Response } from 'express';
import { errores } from '../../http/errores.js';
import type { Sesion, ServicioSesion } from './sesion.service.js';

export const NOMBRE_COOKIE_SESION = 'sesion';

export function leerCookie(cabecera: string | undefined, nombre: string): string | undefined {
  if (!cabecera) return undefined;
  for (const par of cabecera.split(';')) {
    const separador = par.indexOf('=');
    if (separador === -1) continue;
    if (par.slice(0, separador).trim() === nombre) {
      try {
        return decodeURIComponent(par.slice(separador + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/** Carga `res.locals.sesion` si la cookie trae un token válido. No rechaza: eso lo hacen los guardianes. */
export function cargarSesion(servicio: ServicioSesion): RequestHandler {
  return async (req, res, next) => {
    const token = leerCookie(req.headers.cookie, NOMBRE_COOKIE_SESION);
    if (token) res.locals.sesion = (await servicio.resolver(token)) ?? undefined;
    next();
  };
}

/** Sesión de la solicitud o 401. */
export function exigirSesion(res: Response): Sesion {
  const sesion = res.locals.sesion;
  if (!sesion) throw errores.noAutenticado();
  return sesion;
}
