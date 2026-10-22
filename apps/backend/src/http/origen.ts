import type { RequestHandler } from 'express';
import { ErrorApp } from './errores.js';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defensa adicional contra CSRF: una escritura que llega desde un navegador con un origen
 * distinto al del frontend se rechaza, aunque la cookie viaje (SameSite=Lax ya cubre el resto).
 */
export function verificarOrigen(origenesPermitidos: string[]): RequestHandler {
  const permitidos = origenesPermitidos.map((o) => o.replace(/\/+$/, ''));
  return (req, _res, next) => {
    const origen = req.headers.origin?.replace(/\/+$/, '');
    if (METODOS_SEGUROS.has(req.method) || !origen || permitidos.includes(origen)) {
      return next();
    }
    next(new ErrorApp(403, 'ORIGEN_NO_PERMITIDO', 'Origen no permitido.'));
  };
}
