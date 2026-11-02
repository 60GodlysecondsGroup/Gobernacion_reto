import { Router } from 'express';
import { z } from 'zod';
import { ErrorApp } from '../../http/errores.js';
import { validar } from '../../http/validacion.js';
import { crearLimitador } from '../seguridad/limitador.js';
import { LARGO_MAXIMO_MENSAJE, type ServicioCocuyo } from './cocuyo.service.js';

const esquemaMensaje = z
  .object({ mensaje: z.string().trim().min(1).max(LARGO_MAXIMO_MENSAJE) })
  .strict();

/**
 * Chat de Cocuyo, la guía de inicio. Abierto también sin sesión (la guía aparece en las páginas
 * públicas), con límite por cuenta o, sin sesión, por IP. Nunca responde un error por fallos de
 * la IA: el servicio usa la respuesta predeterminada.
 */
export function rutasCocuyo(
  servicio: ServicioCocuyo,
  { maximoPorMinuto = 10 }: { maximoPorMinuto?: number } = {},
): Router {
  const router = Router();
  const limitador = crearLimitador({ maximo: maximoPorMinuto, ventanaMs: 60_000 });

  router.post('/guia/cocuyo', async (req, res) => {
    const { mensaje } = validar(esquemaMensaje, req.body);
    const sesion = res.locals.sesion;
    const clave = sesion ? `usuario:${sesion.idUsuario}` : `ip:${req.ip ?? 'desconocida'}`;
    const espera = limitador.bloqueadoPor(clave);
    if (espera > 0) {
      res.set('Retry-After', String(espera));
      throw new ErrorApp(
        429,
        'LIMITE_COCUYO',
        'Escribiste muchas preguntas seguidas. Espera un minuto o elige una de las preguntas frecuentes.',
      );
    }
    limitador.registrar(clave);

    const respuesta = await servicio.responder(mensaje);
    res.set('Cache-Control', 'no-store').json(respuesta);
  });

  return router;
}
