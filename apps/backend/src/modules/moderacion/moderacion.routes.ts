import { Router } from 'express';
import { z } from 'zod';
import { validar } from '../../http/validacion.js';
import { requerirPermiso } from '../seguridad/permisos.js';
import type { RepositorioModeracion } from './moderacion.repository.js';

const esquemaConsulta = z.object({ dias: z.coerce.number().int().min(1).max(90).default(7) });

/** Rutas de moderación. El resto (reportes, usuarios, reglas) llega en la Fase 7. */
export function rutasModeracion(repositorio: RepositorioModeracion): Router {
  const router = Router();

  router.get(
    '/moderacion/incidencias-dlp',
    requerirPermiso('revisar_incidencias_dlp'),
    async (req, res) => {
      const { dias } = validar(esquemaConsulta, req.query);
      res.set('Cache-Control', 'no-store').json(await repositorio.incidenciasDlp(dias));
    },
  );

  return router;
}
