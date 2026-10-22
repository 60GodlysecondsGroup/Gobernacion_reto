import { Router } from 'express';
import { z } from 'zod';
import { ErrorApp } from '../../http/errores.js';
import { validar } from '../../http/validacion.js';
import { exigirPermiso } from '../seguridad/permisos.js';
import type { ServicioAsistente } from './asistente.service.js';

const esquemaPregunta = z.object({ pregunta: z.string().trim().min(2).max(800) }).strict();
const ventanas = new Map<string, { inicio: number; solicitudes: number }>();
const MAX_SOLICITUDES = 8;
const VENTANA_MS = 60_000;

const pareceDatoPersonal = (texto: string) =>
  /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b(?:\+?57[\s.-]?)?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b|\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/i.test(
    texto,
  );

export function rutasAsistente(servicio: ServicioAsistente): Router {
  const router = Router();
  router.post('/admin/asistente', async (req, res) => {
    const sesion = exigirPermiso(res, 'usar_asistente_admin');
    const { pregunta } = validar(esquemaPregunta, req.body);
    if (pareceDatoPersonal(pregunta)) {
      throw new ErrorApp(
        400,
        'CONSULTA_CON_DATOS_PERSONALES',
        'Quita teléfonos, correos o identificadores antes de consultar estadísticas. No compartas contenido personal.',
      );
    }

    const ahora = Date.now();
    const previo = ventanas.get(sesion.idUsuario);
    if (!previo || ahora - previo.inicio >= VENTANA_MS) {
      ventanas.set(sesion.idUsuario, { inicio: ahora, solicitudes: 1 });
    } else if (previo.solicitudes >= MAX_SOLICITUDES) {
      res.set('Retry-After', String(Math.ceil((VENTANA_MS - (ahora - previo.inicio)) / 1000)));
      throw new ErrorApp(
        429,
        'LIMITE_ASISTENTE',
        'Alcanzaste el límite temporal del asistente. Intenta de nuevo en un minuto.',
      );
    } else {
      previo.solicitudes += 1;
    }

    let respuesta;
    try {
      respuesta = await servicio.responder(pregunta);
    } catch (error) {
      if (error instanceof ErrorApp) throw error;
      if (
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
      ) {
        throw new ErrorApp(
          504,
          'ASISTENTE_TIEMPO_AGOTADO',
          'El asistente tardó demasiado. Intenta de nuevo.',
        );
      }
      throw new ErrorApp(
        502,
        'ASISTENTE_NO_DISPONIBLE',
        'No se pudo obtener una respuesta del asistente. Intenta de nuevo más tarde.',
      );
    }
    res.set('Cache-Control', 'no-store').json(respuesta);
  });
  return router;
}
