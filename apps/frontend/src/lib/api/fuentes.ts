import type { EstadoFuente, TipoCanal } from '@/config/fuentes';
import type { HorarioSemanal } from '@/lib/horarios';
import type { UbicacionFuente } from '@/lib/mapas';
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
  /** Texto legible; con horario semanal, el backend lo deriva de él. */
  horario: string | null;
  /** null en las fuentes registradas antes del horario semanal: conservan su texto. */
  horarioSemanal: HorarioSemanal | null;
  /** null en las fuentes registradas antes de la ubicación (y en las virtuales). */
  direccion: string | null;
  ubicacion: UbicacionFuente | null;
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
  /** Solo cuenta si `horarioSemanal` es null (texto anterior que se conserva). */
  horario: string;
  horarioSemanal: HorarioSemanal | null;
  /** Vacía = sin dirección. */
  direccion: string;
  /** null = sin ubicación en el mapa (la quita si la había). */
  ubicacion: UbicacionFuente | null;
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

// ── Búsqueda de lugares (Google Places, a través del backend: la clave nunca llega aquí) ──────

export type SugerenciaLugar = { placeId: string; principal: string; secundario: string | null };
export type LugarSeleccionado = {
  placeId: string;
  nombre: string | null;
  latitud: number;
  longitud: number;
  direccion: string;
};

/** Si el backend tiene configurada la búsqueda de lugares. */
export const busquedaLugaresDisponible = () => api.get<{ disponible: boolean }>(`${RUTA}/lugares`);

/** `sesion` agrupa las consultas de una misma búsqueda (una sola sesión facturable en Google). */
export const buscarLugares = (texto: string, sesion: string, signal?: AbortSignal) =>
  api.get<{ sugerencias: SugerenciaLugar[] }>(
    `${RUTA}/lugares/sugerencias?${new URLSearchParams({ texto, sesion })}`,
    { signal },
  );

export const obtenerLugar = (placeId: string, sesion: string) =>
  api.get<{ lugar: LugarSeleccionado }>(
    `${RUTA}/lugares/${encodeURIComponent(placeId)}?${new URLSearchParams({ sesion })}`,
  );
