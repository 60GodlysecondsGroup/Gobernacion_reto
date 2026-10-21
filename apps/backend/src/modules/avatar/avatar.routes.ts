import { Router } from 'express';
import { requerirPermiso } from '../seguridad/permisos.js';
import { exigirSesion } from '../seguridad/sesion.middleware.js';
import type { ServicioAvatar } from './avatar.service.js';

/**
 * «Mi avatar» (F36). Solo existe el avatar propio: no hay rutas con el id de otra persona ni
 * ningún endpoint de carga de archivos (RF21).
 */
export function rutasAvatar(servicio: ServicioAvatar): Router {
  const router = Router();
  router.use('/avatar', requerirPermiso('editar_perfil_propio'));

  router.get('/avatar', async (_req, res) => {
    res.json(await servicio.obtenerPropio(exigirSesion(res)));
  });

  router.put('/avatar', requerirPermiso('personalizar_avatar_propio'), async (req, res) => {
    res.json(await servicio.guardarPropio(exigirSesion(res), req.body));
  });

  return router;
}
