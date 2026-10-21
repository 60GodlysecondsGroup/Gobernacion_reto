import { Router } from 'express';
import { exigirPermiso } from '../seguridad/permisos.js';
import type { ServicioHilos } from './hilos.service.js';

/**
 * Foros de la comunidad. `ver_comunidad_propia` ya lo exige el router de comunidad para todo
 * `/comunidad/*`; crear y responder piden además su propio permiso (matriz A.2).
 */
export function rutasHilos(servicio: ServicioHilos): Router {
  const router = Router();

  router.get('/comunidad/categorias', async (_req, res) => {
    const sesion = exigirPermiso(res, 'ver_comunidad_propia');
    res.json({ categorias: await servicio.categorias(sesion) });
  });

  router.get('/comunidad/hilos', async (req, res) => {
    const sesion = exigirPermiso(res, 'ver_comunidad_propia');
    res.set('Cache-Control', 'no-store').json(await servicio.listar(sesion, req.query));
  });

  router.post('/comunidad/hilos', async (req, res) => {
    const sesion = exigirPermiso(res, 'crear_hilo');
    res.status(201).json(await servicio.crear(sesion, req.body));
  });

  router.get('/comunidad/hilos/:id', async (req, res) => {
    const sesion = exigirPermiso(res, 'ver_comunidad_propia');
    res.set('Cache-Control', 'no-store').json(await servicio.obtener(sesion, req.params.id));
  });

  router.post('/comunidad/hilos/:id/respuestas', async (req, res) => {
    const sesion = exigirPermiso(res, 'responder_hilo');
    res.status(201).json(await servicio.responder(sesion, req.params.id, req.body));
  });

  return router;
}
