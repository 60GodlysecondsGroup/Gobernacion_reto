import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { Logger } from '../lib/logger.js';

/** Registra método, ruta, estado y duración de cada solicitud. No registra cuerpos ni query strings. */
export function registroDeSolicitudes(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const inicio = process.hrtime.bigint();
    // originalUrl conserva el prefijo de los routers montados (req.path no); se descarta la query.
    const ruta = req.originalUrl.split('?')[0];
    const idSolicitud = randomUUID();
    res.locals.idSolicitud = idSolicitud;
    res.setHeader('X-Request-Id', idSolicitud);

    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
      const nivel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      logger[nivel](`${req.method} ${ruta} ${res.statusCode} ${ms.toFixed(1)}ms`, { idSolicitud });
    });

    next();
  };
}
