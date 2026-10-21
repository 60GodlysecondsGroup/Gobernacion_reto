import { randomBytes } from 'node:crypto';
import { ErrorApp, errores } from '../../http/errores.js';
import { esUuid, validar } from '../../http/validacion.js';
import type { Sesion } from '../seguridad/sesion.service.js';
import {
  ESTADOS_FUENTE,
  esquemaCreacion,
  esquemaDesactivacion,
  esquemaEdicion,
  esquemaMarcarRevision,
  esquemaVerificacion,
  type EstadoFuente,
  type FuenteCompleta,
} from './fuentes.esquemas.js';
import {
  accionesPermitidas,
  calcularCambios,
  generarCodigo,
  TRANSICIONES,
  type AccionEstado,
} from './fuentes.reglas.js';
import { aCompleta, type RepositorioFuentes } from './fuentes.repository.js';

const NOMBRE_ACCION: Record<AccionEstado, string> = {
  marcar_revision: 'marcar para revisión',
  verificar: 'verificar',
  desactivar: 'desactivar',
};

const conflicto = () =>
  new ErrorApp(
    409,
    'CONFLICTO',
    'La fuente cambió mientras la editabas. Recarga e intenta de nuevo.',
  );

/** Gestión de fuentes institucionales (F32–F34): solo gestor de fuentes y administración. */
export function crearServicioFuentes(repositorio: RepositorioFuentes) {
  async function obtener(id: string) {
    const [fuente] = esUuid(id) ? await repositorio.listar({ id }) : [];
    if (!fuente) throw errores.noEncontrado();
    return fuente;
  }

  async function detalle(id: string) {
    const fuente = await obtener(id);
    return {
      fuente,
      accionesPermitidas: accionesPermitidas(fuente.estado),
      bitacora: await repositorio.bitacora(fuente.id),
    };
  }

  return {
    detalle,

    /** Panel con semáforo (F34): verde activo, amarillo en revisión, rojo inactivo. */
    async listar(consulta: { estado?: unknown }) {
      const estado = ESTADOS_FUENTE.find((e) => e === consulta.estado);
      const [resumen, fuentes] = await Promise.all([
        repositorio.resumenEstados(),
        repositorio.listar(estado ? { estados: [estado] } : {}),
      ]);
      return { resumen, fuentes };
    },

    async crear(sesion: Sesion, entrada: unknown) {
      const datos = validar(esquemaCreacion, entrada);
      const id = await repositorio.crear(
        { ...datos, codigo: generarCodigo(datos.servicio, randomBytes(3).toString('hex')) },
        { responsable: sesion.idUsuario, observacion: 'Creada desde el panel de fuentes.' },
      );
      return detalle(id);
    },

    /** Edita los datos. No cambia el estado ni la fecha de verificación: eso tiene sus acciones. */
    async editar(sesion: Sesion, id: string, entrada: unknown) {
      const datos = validar(esquemaEdicion, entrada);
      const actual = await obtener(id);
      const antes = aCompleta(actual);
      const despues: FuenteCompleta = {
        ...datos,
        estado: actual.estado,
        fechaVerificacion: actual.fechaVerificacion,
      };
      const cambios = calcularCambios(antes, despues);
      if (Object.keys(cambios).length === 0) return detalle(id);

      const guardada = await repositorio.guardar(actual.id, despues, {
        accion: 'actualizar',
        responsable: sesion.idUsuario,
        observacion: null,
        cambios,
        estadoEsperado: actual.estado,
      });
      if (!guardada) throw conflicto();
      return detalle(id);
    },

    /** Marcar para revisión, verificar (con fecha) o desactivar, con su registro en la bitácora. */
    async cambiarEstado(sesion: Sesion, id: string, accion: AccionEstado, entrada: unknown) {
      const actual = await obtener(id);
      const { desde, hacia } = TRANSICIONES[accion];
      if (!desde.includes(actual.estado)) {
        throw new ErrorApp(
          409,
          'TRANSICION_NO_PERMITIDA',
          `No se puede ${NOMBRE_ACCION[accion]} una fuente en estado «${actual.estado}».`,
        );
      }

      let fechaVerificacion = actual.fechaVerificacion;
      let observacion: string | null;
      if (accion === 'verificar') {
        const datos = validar(esquemaVerificacion, entrada ?? {});
        fechaVerificacion = datos.fecha;
        observacion = datos.observacion;
      } else {
        const esquema = accion === 'marcar_revision' ? esquemaMarcarRevision : esquemaDesactivacion;
        observacion = validar(esquema, entrada).motivo;
      }

      const antes = aCompleta(actual);
      const despues: FuenteCompleta = {
        ...antes,
        estado: hacia as EstadoFuente,
        fechaVerificacion,
      };
      const guardada = await repositorio.guardar(actual.id, despues, {
        accion,
        responsable: sesion.idUsuario,
        observacion,
        cambios: calcularCambios(antes, despues),
        estadoEsperado: actual.estado,
      });
      if (!guardada) throw conflicto();
      return detalle(id);
    },
  };
}

export type ServicioFuentes = ReturnType<typeof crearServicioFuentes>;
