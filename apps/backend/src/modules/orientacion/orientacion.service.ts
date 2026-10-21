import { errores } from '../../http/errores.js';
import { esUuid } from '../../http/validacion.js';
import type { EstadoFuente } from '../fuentes/fuentes.esquemas.js';
import type { FuenteRegistrada, RepositorioFuentes } from '../fuentes/fuentes.repository.js';

/** Solo se muestran como opción las fuentes activas o en revisión (con aviso). Nunca las inactivas. */
const ESTADOS_VISIBLES: EstadoFuente[] = ['activo', 'requiere_revision'];

/** Necesidades cuyos canales aparecen en «Necesito ayuda» (F18). */
const NECESIDADES_AYUDA = ['lineas_ayuda', 'hablar_con_alguien'];

/**
 * Ficha pública de un servicio (11.3 y B.6): institución, servicio, información, canal,
 * fuente, fecha de verificación y estado. Sin notas internas ni responsables.
 */
export type FichaServicio = Pick<
  FuenteRegistrada,
  | 'id'
  | 'institucion'
  | 'servicio'
  | 'descripcion'
  | 'tipoCanal'
  | 'telefono'
  | 'enlace'
  | 'horario'
  | 'fuenteOriginal'
  | 'fechaVerificacion'
  | 'estado'
  | 'esDemo'
  | 'necesidades'
>;

const aFicha = (fuente: FuenteRegistrada): FichaServicio => ({
  id: fuente.id,
  institucion: fuente.institucion,
  servicio: fuente.servicio,
  descripcion: fuente.descripcion,
  tipoCanal: fuente.tipoCanal,
  telefono: fuente.telefono,
  enlace: fuente.enlace,
  horario: fuente.horario,
  fuenteOriginal: fuente.fuenteOriginal,
  fechaVerificacion: fuente.fechaVerificacion,
  estado: fuente.estado,
  esDemo: fuente.esDemo,
  necesidades: fuente.necesidades,
});

/**
 * Navegador de orientación (F04–F06, F18). Las necesidades son categorías para buscar
 * información: no hay preguntas de evaluación, puntajes ni mensajes de diagnóstico o riesgo.
 */
export function crearServicioOrientacion(repositorio: RepositorioFuentes) {
  return {
    necesidades: () => repositorio.necesidades(),

    async serviciosDe(codigo: string) {
      const necesidad = (await repositorio.necesidades()).find((n) => n.codigo === codigo);
      if (!necesidad) throw errores.noEncontrado();
      const servicios = await repositorio.listar({
        estados: ESTADOS_VISIBLES,
        necesidades: [codigo],
      });
      return { necesidad, servicios: servicios.map(aFicha) };
    },

    async servicio(id: string) {
      const [fuente] = esUuid(id)
        ? await repositorio.listar({ id, estados: ESTADOS_VISIBLES })
        : [];
      if (!fuente) throw errores.noEncontrado();
      return aFicha(fuente);
    },

    async ayuda() {
      const canales = await repositorio.listar({
        estados: ESTADOS_VISIBLES,
        necesidades: NECESIDADES_AYUDA,
      });
      return canales.map(aFicha);
    },
  };
}

export type ServicioOrientacion = ReturnType<typeof crearServicioOrientacion>;
