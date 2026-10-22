import { Router } from 'express';
import { z } from 'zod';
import { ErrorApp } from '../../http/errores.js';
import { validar } from '../../http/validacion.js';
import { exigirPermiso } from '../seguridad/permisos.js';
import type { ServicioAsistenteUsuario } from './asistente-usuario.service.js';

const esquemaPregunta = z.object({ pregunta: z.string().trim().min(2).max(800) }).strict();
const ventanas = new Map<string, { inicio: number; solicitudes: number }>();
const MAX_SOLICITUDES = 8;
const VENTANA_MS = 60_000;

export function rutasAsistenteUsuario(servicio: ServicioAsistenteUsuario): Router {
  const router = Router();
  router.post('/usuario/asistente', async (req, res) => {
    const sesion = exigirPermiso(res, 'usar_asistente_usuario');
    const { pregunta } = validar(esquemaPregunta, req.body);

    const ahora = Date.now();
    for (const [usuario, ventana] of ventanas) {
      if (ahora - ventana.inicio >= VENTANA_MS) ventanas.delete(usuario);
    }
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

    try {
      const respuesta = await servicio.responder(pregunta, sesion);
      res.set('Cache-Control', 'no-store').json(respuesta);
    } catch (error) {
      if (error instanceof Error && error.message === 'ASISTENTE_NO_CONFIGURADO') {
        throw new ErrorApp(
          503,
          'ASISTENTE_NO_CONFIGURADO',
          'El asistente no está disponible en este momento.',
        );
      }
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
        'No se pudo obtener una respuesta. Intenta de nuevo más tarde.',
      );
    }
  });
  return router;
}
