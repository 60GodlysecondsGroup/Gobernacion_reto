import { Router } from 'express';
import { requerirPermiso } from '../seguridad/permisos.js';
import { exigirSesion } from '../seguridad/sesion.middleware.js';
import type { ServicioPerfil } from './perfil.service.js';

export function rutasPerfil(servicio: ServicioPerfil): Router {
  const router = Router();
  router.use('/perfil', requerirPermiso('editar_perfil_propio'));
  router.use('/perfiles', requerirPermiso('ver_comunidad_propia'));

  router.get('/perfil', async (_req, res) => {
    res.json({ perfil: await servicio.obtenerPropio(exigirSesion(res)) });
  });

  router.put('/perfil', async (req, res) => {
    res.json({ perfil: await servicio.actualizarPropio(exigirSesion(res), req.body) });
  });

  router.get('/perfiles', async (req, res) => {
    res.json({ perfiles: await servicio.buscarEnComunidad(exigirSesion(res), req.query) });
  });

  router.get('/perfiles/:id', async (req, res) => {
    res.json({ perfil: await servicio.obtenerPublico(exigirSesion(res), req.params.id) });
  });

  return router;
}
