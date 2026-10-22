import { Router } from 'express';
import { exigirPermiso, requerirPermiso } from '../seguridad/permisos.js';
import type { ServicioModeracion } from './moderacion.service.js';

/**
 * Moderación (Fase 7): incidencias DLP (F35) y revisión de reportes (F30). Moderación y
 * administración; el permiso se comprueba aquí, no solo ocultando la interfaz.
 */
export function rutasModeracion(servicio: ServicioModeracion): Router {
  const router = Router();

  router.get(
    '/moderacion/incidencias-dlp',
    requerirPermiso('revisar_incidencias_dlp'),
    async (req, res) => {
      res.set('Cache-Control', 'no-store').json(await servicio.incidenciasDlp(req.query));
    },
  );

  router.use('/moderacion/reportes', requerirPermiso('revisar_reportes'));

  router.get('/moderacion/reportes', async (req, res) => {
    res.set('Cache-Control', 'no-store').json(await servicio.listarReportes(req.query));
  });

  router.get('/moderacion/reportes/:id', async (req, res) => {
    res.set('Cache-Control', 'no-store').json({ reporte: await servicio.reporte(req.params.id) });
  });

  router.patch('/moderacion/reportes/:id', async (req, res) => {
    const sesion = exigirPermiso(res, 'revisar_reportes');
    res.json({ reporte: await servicio.cambiarEstado(sesion, req.params.id, req.body) });
  });

  router.post('/moderacion/reportes/:id/acciones', async (req, res) => {
    const sesion = exigirPermiso(res, 'revisar_reportes');
    res.json({ reporte: await servicio.aplicarAccion(sesion, req.params.id, req.body) });
  });

  return router;
}
