import { api } from './cliente';

export type Comunidad = { id: string; nombre: string; descripcion: string; rango: string };

export type OpcionAvatar = { id: string; nombre: string; recurso: string };

export type PerfilPublico = {
  id: string;
  alias: string;
  intereses: string[];
  avatar: OpcionAvatar | null;
};

export const obtenerComunidadPropia = () => api.get<{ comunidad: Comunidad }>('/api/comunidad');

/** Acceso directo por id o código de rango. El backend responde 404 si no es la propia. */
export const obtenerComunidad = (referencia: string) =>
  api.get<{ comunidad: Comunidad }>(`/api/comunidades/${encodeURIComponent(referencia)}`);

export const buscarPerfiles = (texto: string) =>
  api.get<{ perfiles: PerfilPublico[] }>(`/api/perfiles?buscar=${encodeURIComponent(texto)}`);

export const obtenerPerfilPublico = (id: string) =>
  api.get<{ perfil: PerfilPublico }>(`/api/perfiles/${encodeURIComponent(id)}`);
