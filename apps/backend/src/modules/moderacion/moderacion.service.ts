import { z } from 'zod';
import { ErrorApp, errores } from '../../http/errores.js';
import { esUuid, validar } from '../../http/validacion.js';
import type { ServicioAdministracion } from '../administracion/administracion.service.js';
import { tienePermiso } from '../seguridad/permisos.js';
import type { Sesion } from '../seguridad/sesion.service.js';
import {
  ESTADOS_REPORTE,
  RESOLUCIONES,
  type EstadoReporte,
  type RepositorioModeracion,
} from './moderacion.repository.js';

export const REPORTES_POR_PAGINA = 15;

/** Transiciones de estado de un reporte (F30). Un reporte cerrado se puede reabrir. */
export const TRANSICIONES: Record<EstadoReporte, readonly EstadoReporte[]> = {
  pendiente: ['en_revision', 'resuelto', 'descartado'],
  en_revision: ['pendiente', 'resuelto', 'descartado'],
  resuelto: ['en_revision'],
  descartado: ['en_revision'],
};

export const ACCIONES_REPORTE = [
  'ocultar_contenido',
  'restaurar_contenido',
  'suspender_autor',
  'reactivar_autor',
  'deshabilitar_sala',
] as const;
export type AccionReporte = (typeof ACCIONES_REPORTE)[number];

const esquemaListado = z.object({
  estado: z.enum(ESTADOS_REPORTE).optional(),
  pagina: z.coerce.number().int().min(1).max(500).default(1),
});

const esquemaEstado = z
  .object({
    estado: z.enum(ESTADOS_REPORTE),
    resolucion: z.enum(RESOLUCIONES).optional(),
  })
  .strict();

const esquemaAccion = z.object({ accion: z.enum(ACCIONES_REPORTE) }).strict();

const esquemaDias = z.object({ dias: z.coerce.number().int().min(1).max(90).default(7) });

const noAplica = (mensaje: string) => new ErrorApp(409, 'ACCION_NO_APLICA', mensaje);

type Dependencias = {
  repositorio: RepositorioModeracion;
  administracion: ServicioAdministracion;
};

/**
 * Segunda capa de protección (sección 17.1): revisión humana de reportes. El moderador ve el
 * motivo, la fecha y el contenido asociado, cambia el estado y aplica acciones permitidas.
 */
export function crearServicioModeracion({ repositorio, administracion }: Dependencias) {
  async function detalle(idReporte: string) {
    const reporte = esUuid(idReporte) ? await repositorio.reporte(idReporte) : null;
    if (!reporte) throw errores.noEncontrado();
    return reporte;
  }

  return {
    async incidenciasDlp(consulta: unknown) {
      const { dias } = validar(esquemaDias, consulta);
      return repositorio.incidenciasDlp(dias);
    },

    async listarReportes(consulta: unknown) {
      const { estado, pagina } = validar(esquemaListado, consulta);
      const [filas, conteo] = await Promise.all([
        repositorio.listarReportes({
          estado,
          limite: REPORTES_POR_PAGINA + 1,
          desplazamiento: (pagina - 1) * REPORTES_POR_PAGINA,
        }),
        repositorio.conteoReportes(),
      ]);
      return {
        reportes: filas.slice(0, REPORTES_POR_PAGINA),
        conteo,
        pagina,
        hayMas: filas.length > REPORTES_POR_PAGINA,
      };
    },

    reporte: detalle,

    async cambiarEstado(sesion: Sesion, idReporte: string, entrada: unknown) {
      const { estado, resolucion } = validar(esquemaEstado, entrada);
      const actual = await detalle(idReporte);
      if (actual.estado === estado) return actual;
      if (!TRANSICIONES[actual.estado].includes(estado)) {
        throw new ErrorApp(
          409,
          'TRANSICION_INVALIDA',
          'Ese cambio de estado no está permitido para este reporte.',
        );
      }
      // Al cerrar un reporte sin una acción previa, queda constancia de que no hubo medida.
      const cierra = estado === 'resuelto' || estado === 'descartado';
      const resolucionFinal =
        resolucion ?? (cierra && !actual.resolucion ? ('sin_accion' as const) : undefined);
      const aplicado = await repositorio.cambiarEstadoReporte({
        idReporte: actual.id,
        anterior: actual.estado,
        nuevo: estado,
        resolucion: resolucionFinal,
        actor: sesion.idUsuario,
      });
      if (!aplicado) {
        throw new ErrorApp(409, 'CAMBIO_CONCURRENTE', 'El reporte cambió. Vuelve a cargarlo.');
      }
      return detalle(actual.id);
    },

    /** Acciones administrativas sobre el contenido o su autor, desde el reporte. */
    async aplicarAccion(sesion: Sesion, idReporte: string, entrada: unknown) {
      const { accion } = validar(esquemaAccion, entrada);
      const objetivo = esUuid(idReporte) ? await repositorio.objetivo(idReporte) : null;
      if (!objetivo) throw errores.noEncontrado();
      const { tipoContenido, idContenido, idAutor } = objetivo;

      switch (accion) {
        case 'ocultar_contenido':
        case 'restaurar_contenido': {
          if (tipoContenido !== 'hilo' && tipoContenido !== 'respuesta') {
            throw noAplica('Solo se pueden ocultar hilos y respuestas.');
          }
          const ocultar = accion === 'ocultar_contenido';
          await repositorio.cambiarVisibilidad({
            tipo: tipoContenido,
            id: idContenido,
            ocultar,
            actor: sesion.idUsuario,
            idReporte,
          });
          await repositorio.anotarResolucion(
            idReporte,
            ocultar ? 'contenido_oculto' : 'sin_accion',
            sesion.idUsuario,
          );
          break;
        }
        case 'suspender_autor':
        case 'reactivar_autor': {
          if (!idAutor) throw noAplica('Este contenido no tiene una persona autora.');
          const suspender = accion === 'suspender_autor';
          await administracion.cambiarEstadoUsuario(
            sesion,
            idAutor,
            suspender ? 'suspendido' : 'activo',
            { idReporte },
          );
          await repositorio.anotarResolucion(
            idReporte,
            suspender ? 'usuario_suspendido' : 'sin_accion',
            sesion.idUsuario,
          );
          break;
        }
        case 'deshabilitar_sala': {
          if (tipoContenido !== 'sala') throw noAplica('Este reporte no es sobre una sala.');
          if (!tienePermiso(sesion.rol, 'configurar_comunidades')) throw errores.prohibido();
          await administracion.actualizarSala(sesion, idContenido, { habilitada: false });
          await repositorio.anotarResolucion(idReporte, 'sala_deshabilitada', sesion.idUsuario);
          break;
        }
      }
      return detalle(idReporte);
    },
  };
}

export type ServicioModeracion = ReturnType<typeof crearServicioModeracion>;
