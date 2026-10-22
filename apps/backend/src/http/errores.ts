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

/**
 * Errores que significan «la base de datos no está disponible»: no se pudo resolver o alcanzar el
 * servidor, credenciales o base inexistentes, servidor apagándose o esquema sin crear.
 */
const CODIGOS_SIN_BASE = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  '08001',
  '08006',
  '28P01',
  '28000',
  '3D000',
  '57P01',
  '57P03',
  '3F000',
]);

export function esErrorDeConexionBase(error: unknown): boolean {
  const codigo = (error as { code?: unknown })?.code;
  if (typeof codigo === 'string' && CODIGOS_SIN_BASE.has(codigo)) return true;
  const mensaje = error instanceof Error ? error.message : '';
  return /Connection terminated|timeout exceeded when trying to connect|schema "app" does not exist/i.test(
    mensaje,
  );
}

/** Pista para quien administra el prototipo (solo en los logs, nunca en la respuesta). */
export const AYUDA_BASE =
  'Revisa DATABASE_URL en el .env. Para usar la base local sin instalar nada: npm run dev:local (o npm run db:local en otra terminal). Si el esquema no existe: npm run db:reset.';

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
    } else if (esErrorDeConexionBase(error)) {
      // La base no responde: no es un fallo del código. Se avisa sin la traza completa.
      logger.warn('Base de datos no disponible', {
        idSolicitud: res.locals.idSolicitud,
        ruta: `${req.method} ${req.originalUrl.split('?')[0]}`,
        error: error instanceof Error ? error.message : String(error),
        ayuda: AYUDA_BASE,
      });
      errorApp = new ErrorApp(
        503,
        'SERVICIO_NO_DISPONIBLE',
        'El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.',
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
