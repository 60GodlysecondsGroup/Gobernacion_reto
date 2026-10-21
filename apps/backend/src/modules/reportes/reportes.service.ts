import { z } from 'zod';
import { errores } from '../../http/errores.js';
import { esUuid, vacioANull, validar } from '../../http/validacion.js';
import { exigirRango } from '../comunidad/comunidad.service.js';
import type { ServicioComunidad } from '../comunidad/comunidad.service.js';
import type { ServicioDlp } from '../dlp/dlp.service.js';
import type { Sesion } from '../seguridad/sesion.service.js';
import type { RepositorioReportes } from './reportes.repository.js';

/** Motivos de reporte (sección 17.2, F19). */
export const CATEGORIAS_REPORTE = [
  'informacion_personal',
  'acoso',
  'contenido_inapropiado',
  'contacto_externo',
  'publicidad',
  'otro',
] as const;

/** Confirmación exacta (F20). No se informa qué acción se tomará con otra persona. */
export const MENSAJE_REPORTE = 'Tu reporte fue registrado.';

const esquemaReporte = z
  .object({
    tipoContenido: z.enum(['hilo', 'respuesta', 'perfil']),
    idContenido: z.string(),
    categoria: z.enum(CATEGORIAS_REPORTE, 'Elige un motivo.'),
    descripcion: z.preprocess(
      vacioANull,
      z.string().trim().max(300, 'Máximo 300 caracteres.').nullable().default(null),
    ),
  })
  .strict();

type Dependencias = {
  repositorio: RepositorioReportes;
  comunidades: ServicioComunidad;
  dlp: ServicioDlp;
};

/**
 * Reportes de usuarios (F19, F20, RF13). Solo se reporta contenido visible de la propia
 * comunidad: lo demás responde 404 como si no existiera.
 */
export function crearServicioReportes({ repositorio, comunidades, dlp }: Dependencias) {
  return {
    async reportar(sesion: Sesion, entrada: unknown) {
      const datos = validar(esquemaReporte, entrada);
      const rango = exigirRango(sesion);
      const comunidad = await comunidades.obtenerPropia(sesion);

      const visible =
        esUuid(datos.idContenido) &&
        (await repositorio.contenidoEnComunidad(
          datos.tipoContenido,
          datos.idContenido,
          comunidad.id,
          rango,
        ));
      if (!visible) throw errores.noEncontrado();

      if (datos.descripcion) {
        await dlp.exigirPermitido(
          { descripcion: datos.descripcion },
          { tipoContenido: 'reporte', idUsuario: sesion.idUsuario },
        );
      }

      await repositorio.registrar({
        idUsuario: sesion.idUsuario,
        idComunidad: comunidad.id,
        tipoContenido: datos.tipoContenido,
        idContenido: datos.idContenido,
        categoria: datos.categoria,
        descripcion: datos.descripcion,
      });
      return { mensaje: MENSAJE_REPORTE };
    },
  };
}

export type ServicioReportes = ReturnType<typeof crearServicioReportes>;
