import { Router } from 'express';
import { exigirPermiso } from '../seguridad/permisos.js';
import type { ServicioSuperadmin } from './superadmin.service.js';

/**
 * Sección Superadmin: cuentas de administración de la plataforma. Cada ruta exige
 * `gestionar_administradores` en el backend (rol y estado se leen de la base en cada solicitud),
 * y el servicio lo vuelve a comprobar. Las respuestas nunca se guardan en caché.
 */
export function rutasSuperadmin(servicio: ServicioSuperadmin): Router {
  const router = Router();
  const sinCache = { 'Cache-Control': 'no-store' };

  router.get('/superadmin/administradores', async (_req, res) => {
    const sesion = exigirPermiso(res, 'gestionar_administradores');
    res.set(sinCache).json(await servicio.listar(sesion));
  });

  router.post('/superadmin/administradores', async (req, res) => {
    const sesion = exigirPermiso(res, 'gestionar_administradores');
    res
      .set(sinCache)
      .status(201)
      .json(await servicio.crear(sesion, req.body));
  });

  router.patch('/superadmin/administradores/:id', async (req, res) => {
    const sesion = exigirPermiso(res, 'gestionar_administradores');
    res.set(sinCache).json(await servicio.actualizarDatos(sesion, req.params.id, req.body));
  });

  router.patch('/superadmin/administradores/:id/rol', async (req, res) => {
    const sesion = exigirPermiso(res, 'gestionar_administradores');
    res.set(sinCache).json(await servicio.cambiarRol(sesion, req.params.id, req.body));
  });

  router.patch('/superadmin/administradores/:id/estado', async (req, res) => {
    const sesion = exigirPermiso(res, 'gestionar_administradores');
    res.set(sinCache).json(await servicio.cambiarEstado(sesion, req.params.id, req.body));
  });

  router.post('/superadmin/administradores/:id/contrasena', async (req, res) => {
    const sesion = exigirPermiso(res, 'gestionar_administradores');
    res.set(sinCache).json(await servicio.restablecerContrasena(sesion, req.params.id, req.body));
  });

  return router;
}
