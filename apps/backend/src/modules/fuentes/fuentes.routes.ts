import { Router } from 'express';
import { requerirPermiso } from '../seguridad/permisos.js';
import { exigirSesion } from '../seguridad/sesion.middleware.js';
import type { ServicioFuentes } from './fuentes.service.js';

/** Panel del gestor de fuentes: solo los roles con `gestionar_fuentes` (A.2). */
export function rutasFuentes(servicio: ServicioFuentes): Router {
  const router = Router();
  router.use('/gestion/fuentes', requerirPermiso('gestionar_fuentes'));

  router.get('/gestion/fuentes', async (req, res) => {
    res.set('Cache-Control', 'no-store').json(await servicio.listar(req.query));
  });

  router.post('/gestion/fuentes', async (req, res) => {
    res.status(201).json(await servicio.crear(exigirSesion(res), req.body));
  });

  router.get('/gestion/fuentes/:id', async (req, res) => {
    res.set('Cache-Control', 'no-store').json(await servicio.detalle(req.params.id));
  });

  router.put('/gestion/fuentes/:id', async (req, res) => {
    res.json(await servicio.editar(exigirSesion(res), req.params.id, req.body));
  });

  router.post('/gestion/fuentes/:id/revision', async (req, res) => {
    res.json(
      await servicio.cambiarEstado(exigirSesion(res), req.params.id, 'marcar_revision', req.body),
    );
  });

  router.post('/gestion/fuentes/:id/verificacion', async (req, res) => {
    res.json(await servicio.cambiarEstado(exigirSesion(res), req.params.id, 'verificar', req.body));
  });

  router.post('/gestion/fuentes/:id/desactivacion', async (req, res) => {
    res.json(
      await servicio.cambiarEstado(exigirSesion(res), req.params.id, 'desactivar', req.body),
    );
  });

  return router;
}
