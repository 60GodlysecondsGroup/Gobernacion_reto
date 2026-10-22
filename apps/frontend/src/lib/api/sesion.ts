import { api } from './cliente';

export type Rol = 'usuario' | 'moderador' | 'admin_plataforma' | 'gestor_fuentes';

/** Permisos de la matriz A.2 (apps/backend/src/modules/seguridad/permisos.ts). */
export type Permiso =
  | 'consultar_orientacion'
  | 'editar_perfil_propio'
  | 'ver_comunidad_propia'
  | 'crear_hilo'
  | 'responder_hilo'
  | 'acceder_salas'
  | 'personalizar_avatar_propio'
  | 'crear_sala_tematica'
  | 'reportar_contenido'
  | 'revisar_reportes'
  | 'revisar_incidencias_dlp'
  | 'gestionar_usuarios'
  | 'consultar_reglas_dlp'
  | 'gestionar_reglas_dlp'
  | 'gestionar_fuentes'
  | 'configurar_comunidades'
  | 'consultar_registros_administrativos'
  | 'usar_asistente_admin'
  | 'usar_asistente_usuario';

export type SesionPublica = {
  id: string;
  alias: string;
  rol: Rol;
  comunidad: { id: string; nombre: string } | null;
  permisos: Permiso[];
};

export type UsuarioDemo = {
  codigo: string;
  alias: string;
  rol: Rol;
  comunidad: string | null;
  rango: string | null;
};

export const NOMBRES_ROL: Record<Rol, string> = {
  usuario: 'Joven',
  moderador: 'Moderación',
  admin_plataforma: 'Administración',
  gestor_fuentes: 'Gestión de fuentes',
};

export const obtenerSesion = () => api.get<{ usuario: SesionPublica | null }>('/api/sesion');

export const iniciarSesionDemo = (codigo: string) =>
  api.post<{ usuario: SesionPublica }>('/api/sesion', { codigo });

export const cerrarSesion = () => api.delete<null>('/api/sesion');

export const listarUsuariosDemo = () =>
  api.get<{ usuarios: UsuarioDemo[] }>('/api/sesion/usuarios-demo');
