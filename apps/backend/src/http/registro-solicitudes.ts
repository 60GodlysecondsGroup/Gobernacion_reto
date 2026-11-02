import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { sanitizarRuta } from '../lib/diagnostico.js';
import type { Logger } from '../lib/logger.js';

/** Registra método, ruta, estado y duración de cada solicitud. No registra cuerpos ni query strings. */
export function registroDeSolicitudes(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const inicio = process.hrtime.bigint();
    // originalUrl conserva el prefijo de los routers montados (req.path no); se descarta la query.
    const ruta = sanitizarRuta(req.originalUrl);
    const idSolicitud = randomUUID();
    const idVercelRecibido = req.get('x-vercel-id');
    const idVercel =
      idVercelRecibido && /^[a-z\d:_-]{1,256}$/i.test(idVercelRecibido)
        ? idVercelRecibido
        : undefined;
    res.locals.idSolicitud = idSolicitud;
    res.locals.idVercel = idVercel;
    res.setHeader('X-Request-Id', idSolicitud);

    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
      const nivel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      logger[nivel](`${req.method} ${ruta} ${res.statusCode} ${ms.toFixed(1)}ms`, {
        idSolicitud,
        ...(idVercel && { idVercel }),
      });
    });

    next();
  };
}
