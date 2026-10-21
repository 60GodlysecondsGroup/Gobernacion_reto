import { Router } from 'express';
import type { ServicioOrientacion } from './orientacion.service.js';

/**
 * Rutas públicas: la información institucional y «Necesito ayuda» no exigen iniciar sesión,
 * para que llegar a un canal oficial no tenga pasos ni barreras innecesarias (F18, RF20).
 */
export function rutasOrientacion(servicio: ServicioOrientacion): Router {
  const router = Router();
  router.use('/orientacion', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.get('/orientacion/necesidades', async (_req, res) => {
    res.json({ necesidades: await servicio.necesidades() });
  });

  router.get('/orientacion/necesidades/:codigo', async (req, res) => {
    res.json(await servicio.serviciosDe(req.params.codigo));
  });

  router.get('/orientacion/servicios/:id', async (req, res) => {
    res.json({ servicio: await servicio.servicio(req.params.id) });
  });

  router.get('/orientacion/ayuda', async (_req, res) => {
    res.json({ canales: await servicio.ayuda() });
  });

  return router;
}
