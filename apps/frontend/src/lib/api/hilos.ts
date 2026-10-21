import { api } from './cliente';
import type { OpcionAvatar } from './comunidad';

/** Autor de un contenido: solo alias y avatar. */
export type Autor = { id: string; alias: string; avatar: OpcionAvatar | null };

export type CategoriaForo = { codigo: string; nombre: string; descripcion: string; hilos: number };

export type HiloResumen = {
  id: string;
  titulo: string;
  extracto: string;
  estado: 'activo' | 'cerrado';
  fecha: string;
  ultimaActividad: string;
  respuestas: number;
  categoria: { codigo: string; nombre: string };
  autor: Autor;
};

export type HiloDetalle = {
  id: string;
  titulo: string;
  contenido: string;
  estado: 'activo' | 'cerrado';
  fecha: string;
  categoria: { codigo: string; nombre: string };
  autor: Autor;
};

export type Respuesta = { id: string; contenido: string; fecha: string; autor: Autor };

export type DetalleHilo = { hilo: HiloDetalle; respuestas: Respuesta[] };

export const obtenerCategorias = () =>
  api.get<{ categorias: CategoriaForo[] }>('/api/comunidad/categorias');

export function listarHilos(filtro: { categoria?: string; buscar?: string; pagina: number }) {
  const parametros = new URLSearchParams({ pagina: String(filtro.pagina) });
  if (filtro.categoria) parametros.set('categoria', filtro.categoria);
  if (filtro.buscar) parametros.set('buscar', filtro.buscar);
  return api.get<{ hilos: HiloResumen[]; pagina: number; hayMas: boolean }>(
    `/api/comunidad/hilos?${parametros}`,
  );
}

export const obtenerHilo = (id: string) =>
  api.get<DetalleHilo>(`/api/comunidad/hilos/${encodeURIComponent(id)}`);

export const crearHilo = (datos: { categoria: string; titulo: string; contenido: string }) =>
  api.post<DetalleHilo>('/api/comunidad/hilos', datos);

export const responderHilo = (id: string, contenido: string) =>
  api.post<DetalleHilo>(`/api/comunidad/hilos/${encodeURIComponent(id)}/respuestas`, {
    contenido,
  });
