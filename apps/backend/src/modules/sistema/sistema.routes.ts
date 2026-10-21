import { Router } from 'express';
import type { ServicioSistema } from './sistema.service.js';

export function rutasSistema(servicio: ServicioSistema): Router {
  const router = Router();

  router.get('/salud', async (_req, res) => {
    res.set('Cache-Control', 'no-store').json(await servicio.obtenerSalud());
  });

  return router;
}
