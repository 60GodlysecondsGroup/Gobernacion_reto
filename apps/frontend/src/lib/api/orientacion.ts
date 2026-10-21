import type { EstadoFuente, TipoCanal } from '@/config/fuentes';
import { api } from './cliente';

export type Necesidad = { codigo: string; nombre: string; descripcion: string; servicios: number };

/** Ficha pública de un servicio (11.3 y B.6). */
export type FichaServicio = {
  id: string;
  institucion: string;
  servicio: string;
  descripcion: string;
  tipoCanal: TipoCanal;
  telefono: string | null;
  enlace: string | null;
  horario: string | null;
  fuenteOriginal: string;
  fechaVerificacion: string;
  estado: Exclude<EstadoFuente, 'inactivo'>;
  esDemo: boolean;
  necesidades: { codigo: string; nombre: string }[];
};

export const obtenerNecesidades = () =>
  api.get<{ necesidades: Necesidad[] }>('/api/orientacion/necesidades');

export const obtenerServiciosDe = (codigo: string) =>
  api.get<{ necesidad: Necesidad; servicios: FichaServicio[] }>(
    `/api/orientacion/necesidades/${encodeURIComponent(codigo)}`,
  );

export const obtenerServicio = (id: string) =>
  api.get<{ servicio: FichaServicio }>(`/api/orientacion/servicios/${encodeURIComponent(id)}`);

export const obtenerCanalesDeAyuda = () =>
  api.get<{ canales: FichaServicio[] }>('/api/orientacion/ayuda');
