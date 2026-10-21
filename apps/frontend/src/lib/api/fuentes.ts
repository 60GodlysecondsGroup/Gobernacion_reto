import type { EstadoFuente, TipoCanal } from '@/config/fuentes';
import { api } from './cliente';

export type AccionEstado = 'marcar_revision' | 'verificar' | 'desactivar';
export type AccionBitacora = 'crear' | 'actualizar' | AccionEstado;

export type FuenteGestion = {
  id: string;
  codigo: string;
  institucion: string;
  servicio: string;
  descripcion: string;
  tipoCanal: TipoCanal;
  telefono: string | null;
  enlace: string | null;
  horario: string | null;
  fuenteOriginal: string;
  fechaVerificacion: string;
  diasDesdeVerificacion: number;
  estado: EstadoFuente;
  observaciones: string | null;
  esDemo: boolean;
  responsable: string | null;
  fechaActualizacion: string;
  necesidades: { codigo: string; nombre: string }[];
};

export type EntradaBitacora = {
  id: string;
  fecha: string;
  accion: AccionBitacora;
  estadoAnterior: EstadoFuente | null;
  estadoNuevo: EstadoFuente | null;
  observacion: string | null;
  cambios: Record<string, { antes: unknown; despues: unknown }>;
  responsable: string | null;
};

export type DetalleFuente = {
  fuente: FuenteGestion;
  accionesPermitidas: AccionEstado[];
  bitacora: EntradaBitacora[];
};

/** Lo que se envía al crear o editar. */
export type DatosFuente = {
  institucion: string;
  servicio: string;
  descripcion: string;
  tipoCanal: TipoCanal;
  telefono: string;
  enlace: string;
  horario: string;
  fuenteOriginal: string;
  necesidades: string[];
  observaciones: string;
  esDemo: boolean;
};

export type DatosNuevaFuente = DatosFuente & {
  estado: 'activo' | 'requiere_revision';
  fechaVerificacion: string;
};

const RUTA = '/api/gestion/fuentes';
const RUTAS_ACCION: Record<AccionEstado, string> = {
  marcar_revision: 'revision',
  verificar: 'verificacion',
  desactivar: 'desactivacion',
};

export const listarFuentes = (estado?: EstadoFuente) =>
  api.get<{ resumen: Record<EstadoFuente, number>; fuentes: FuenteGestion[] }>(
    estado ? `${RUTA}?estado=${estado}` : RUTA,
  );

export const obtenerFuente = (id: string) =>
  api.get<DetalleFuente>(`${RUTA}/${encodeURIComponent(id)}`);

export const crearFuente = (datos: DatosNuevaFuente) => api.post<DetalleFuente>(RUTA, datos);

export const editarFuente = (id: string, datos: DatosFuente) =>
  api.put<DetalleFuente>(`${RUTA}/${encodeURIComponent(id)}`, datos);

export const cambiarEstadoFuente = (
  id: string,
  accion: AccionEstado,
  cuerpo: { motivo?: string; fecha?: string; observacion?: string },
) => api.post<DetalleFuente>(`${RUTA}/${encodeURIComponent(id)}/${RUTAS_ACCION[accion]}`, cuerpo);
