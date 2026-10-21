import { api } from './cliente';
import type { OpcionAvatar, PerfilPublico } from './comunidad';
import type { Rol } from './sesion';

export type PerfilPropio = PerfilPublico & { rol: Rol };

export type CambiosPerfil = { alias: string; intereses: string[]; avatar: string };

export const obtenerPerfilPropio = () =>
  api.get<{ perfil: PerfilPropio; opcionesAvatar: OpcionAvatar[] }>('/api/perfil');

export const guardarPerfil = (cambios: CambiosPerfil) =>
  api.put<{ perfil: PerfilPropio }>('/api/perfil', cambios);
