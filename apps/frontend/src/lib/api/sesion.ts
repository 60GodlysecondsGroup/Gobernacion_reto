import type { ConfiguracionAvatar, ElementoAvatar } from './avatar';
import { api } from './cliente';

export type Rol = 'usuario' | 'moderador' | 'admin_plataforma' | 'gestor_fuentes' | 'superadmin';

/** Roles de administración: sus cuentas solo se gestionan en la sección Superadmin. */
export const esRolAdministracion = (rol: string) =>
  rol === 'admin_plataforma' || rol === 'superadmin';

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
  | 'gestionar_personal'
  | 'consultar_reglas_dlp'
  | 'gestionar_reglas_dlp'
  | 'gestionar_fuentes'
  | 'configurar_comunidades'
  | 'consultar_registros_administrativos'
  | 'usar_asistente_admin'
  | 'gestionar_administradores'
  | 'usar_asistente_usuario';

export type SesionPublica = {
  id: string;
  alias: string;
  rol: Rol;
  comunidad: { id: string; nombre: string } | null;
  permisos: Permiso[];
};

export type CodigoRango = 'A' | 'B' | 'C' | 'D';
export type RangoEdad = { codigo: CodigoRango; etiqueta: string };

/** «Iniciar con mi Avatar» — cuenta existente: nametag (alias) y contraseña. */
export type DatosInicio = { alias: string; contrasena: string; recordar: boolean };

/** Acceso del equipo (personal y administración con correo): correo y contraseña. */
export type DatosInicioPersonal = { correo: string; contrasena: string; recordar: boolean };

/** «Iniciar con mi Avatar» — cuenta nueva. La cuenta siempre nace como joven (rol `usuario`). */
export type DatosRegistro = DatosInicio & {
  rango: CodigoRango;
  intereses: string[];
  avatar: ConfiguracionAvatar;
};

export const NOMBRES_ROL: Record<Rol, string> = {
  usuario: 'Joven',
  moderador: 'Moderación',
  admin_plataforma: 'Administración',
  gestor_fuentes: 'Gestión de fuentes',
  superadmin: 'Superadministración',
};

export const obtenerSesion = () => api.get<{ usuario: SesionPublica | null }>('/api/sesion');

/** El token de sesión llega solo en una cookie HttpOnly: el JavaScript nunca lo ve. */
export const iniciarSesion = (datos: DatosInicio) =>
  api.post<{ usuario: SesionPublica }>('/api/sesion', datos);

/** Misma sesión y cookie que el acceso con nametag; solo cambia el identificador. */
export const iniciarSesionPersonal = (datos: DatosInicioPersonal) =>
  api.post<{ usuario: SesionPublica }>('/api/sesion/personal', datos);

export const registrarse = (datos: DatosRegistro) =>
  api.post<{ usuario: SesionPublica }>('/api/sesion/registro', datos);

/**
 * Paso 1 del registro: se resuelve si el nametag está libre y falla con `ALIAS_EN_USO` (campo
 * `alias`) si ya lo tiene alguien. El registro final lo vuelve a comprobar.
 */
export const comprobarAlias = (alias: string) =>
  api.post<null>('/api/sesion/registro/alias', { alias });

/** Rangos de edad y catálogo de avatar: públicos, para el formulario de registro. */
export const obtenerOpcionesRegistro = () =>
  api.get<{ rangos: RangoEdad[]; catalogo: ElementoAvatar[] }>('/api/sesion/registro');

/** Cierra la sesión en el servidor (la revoca) y borra la cookie. */
export const cerrarSesion = () => api.delete<null>('/api/sesion');
