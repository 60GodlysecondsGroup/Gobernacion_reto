import { Router } from 'express';
import { exigirPermiso } from '../seguridad/permisos.js';
import type { ServicioReportes } from './reportes.service.js';

/** Envío de reportes. La revisión por moderación llega en la Fase 7. */
export function rutasReportes(servicio: ServicioReportes): Router {
  const router = Router();

  router.post('/reportes', async (req, res) => {
    const sesion = exigirPermiso(res, 'reportar_contenido');
    res.status(201).json(await servicio.reportar(sesion, req.body));
  });

  return router;
}
