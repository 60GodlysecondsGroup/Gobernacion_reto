import { api } from './cliente';
import type { PerfilPublico } from './comunidad';
import type { Rol } from './sesion';

export type PerfilPropio = PerfilPublico & { rol: Rol };

/** El avatar se edita aparte, en «Mi avatar» (`lib/api/avatar.ts`). */
export type CambiosPerfil = { alias: string; intereses: string[] };

export const obtenerPerfilPropio = () => api.get<{ perfil: PerfilPropio }>('/api/perfil');

export const guardarPerfil = (cambios: CambiosPerfil) =>
  api.put<{ perfil: PerfilPropio }>('/api/perfil', cambios);
