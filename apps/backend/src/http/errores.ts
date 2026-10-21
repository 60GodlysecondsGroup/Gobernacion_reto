import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from '../lib/logger.js';

/** Error de aplicación con estado HTTP y un código estable que el frontend puede interpretar. */
export class ErrorApp extends Error {
  constructor(
    readonly estado: number,
    readonly codigo: string,
    mensaje: string,
    readonly detalles?: unknown,
  ) {
    super(mensaje);
    this.name = 'ErrorApp';
  }
}

export const errores = {
  solicitudInvalida: (detalles?: unknown) =>
    new ErrorApp(400, 'SOLICITUD_INVALIDA', 'La solicitud no es válida.', detalles),
  noAutenticado: () => new ErrorApp(401, 'NO_AUTENTICADO', 'Debes iniciar sesión.'),
  // Se usa también para recursos de otra comunidad: no se revela si existen (Fase 2).
  noEncontrado: () => new ErrorApp(404, 'NO_ENCONTRADO', 'El recurso no existe.'),
  prohibido: () => new ErrorApp(403, 'PROHIBIDO', 'No tienes permiso para esta acción.'),
};

export const rutaNoEncontrada: RequestHandler = (_req, _res, next) => {
  next(errores.noEncontrado());
};

type ErrorDeParser = Error & { type?: string; status?: number };

export function manejadorDeErrores(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, _next) => {
    let errorApp: ErrorApp;

    if (error instanceof ErrorApp) {
      errorApp = error;
    } else if ((error as ErrorDeParser)?.type === 'entity.parse.failed') {
      errorApp = new ErrorApp(400, 'JSON_INVALIDO', 'El cuerpo de la solicitud no es JSON válido.');
    } else if ((error as ErrorDeParser)?.type === 'entity.too.large') {
      errorApp = new ErrorApp(
        413,
        'CUERPO_DEMASIADO_GRANDE',
        'El contenido enviado es demasiado grande.',
      );
    } else {
      // Error no previsto: se registra completo en el servidor y se responde genérico al cliente.
      logger.error('Error no controlado', {
        idSolicitud: res.locals.idSolicitud,
        ruta: `${req.method} ${req.originalUrl.split('?')[0]}`,
        error: error instanceof Error ? (error.stack ?? error.message) : String(error),
      });
      errorApp = new ErrorApp(500, 'ERROR_INTERNO', 'Ocurrió un error inesperado.');
    }

    res.status(errorApp.estado).json({
      error: {
        codigo: errorApp.codigo,
        mensaje: errorApp.message,
        ...(errorApp.detalles !== undefined && { detalles: errorApp.detalles }),
      },
    });
  };
}
