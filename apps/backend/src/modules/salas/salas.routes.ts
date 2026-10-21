import { Router } from 'express';
import { errores } from '../../http/errores.js';
import { esUuid } from '../../http/validacion.js';
import type { ServicioComunidad } from '../comunidad/comunidad.service.js';
import { exigirPermiso } from '../seguridad/permisos.js';
import type { RepositorioSalas } from './salas.repository.js';

/**
 * Lista de salas y antesala (F11): nombre, temática, reglas y ocupación antes de entrar.
 * Solo salas de la propia comunidad; las demás responden 404 como si no existieran.
 */
export function rutasSalas(repositorio: RepositorioSalas, comunidades: ServicioComunidad): Router {
  const router = Router();

  router.get('/salas', async (_req, res) => {
    const sesion = exigirPermiso(res, 'acceder_salas');
    const comunidad = await comunidades.obtenerPropia(sesion);
    res.set('Cache-Control', 'no-store').json({ salas: await repositorio.listar(comunidad.id) });
  });

  router.get('/salas/:id', async (req, res) => {
    const sesion = exigirPermiso(res, 'acceder_salas');
    const comunidad = await comunidades.obtenerPropia(sesion);
    const sala = esUuid(req.params.id)
      ? await repositorio.porId(comunidad.id, req.params.id)
      : null;
    if (!sala) throw errores.noEncontrado();
    const { idComunidad: _comunidad, ...publica } = sala;
    res.set('Cache-Control', 'no-store').json({ sala: publica });
  });

  return router;
}
