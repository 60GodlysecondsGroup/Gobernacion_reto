import { Router } from 'express';
import { requerirPermiso } from '../seguridad/permisos.js';
import { exigirSesion } from '../seguridad/sesion.middleware.js';
import type { ServicioComunidad } from './comunidad.service.js';

export function rutasComunidad(servicio: ServicioComunidad): Router {
  const router = Router();
  router.use(['/comunidad', '/comunidades'], requerirPermiso('ver_comunidad_propia'));

  router.get('/comunidad', async (_req, res) => {
    res.json({ comunidad: await servicio.obtenerPropia(exigirSesion(res)) });
  });

  router.get('/comunidades', async (_req, res) => {
    res.json({ comunidades: await servicio.listar(exigirSesion(res)) });
  });

  router.get('/comunidades/:referencia', async (req, res) => {
    res.json({
      comunidad: await servicio.obtenerPorReferencia(exigirSesion(res), req.params.referencia),
    });
  });

  return router;
}
