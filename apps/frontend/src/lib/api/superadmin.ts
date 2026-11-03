import type { EstadoUsuario, RolPersonal } from './administracion';
import { api } from './cliente';
import type { Rol } from './sesion';

/** Roles de administración que se gestionan en la sección Superadmin. */
export type RolAdministracion = Extract<Rol, 'admin_plataforma' | 'superadmin'>;

/**
 * Cuenta de administración (apps/backend/src/modules/superadmin). El nombre es el alias de la
 * cuenta. Nunca trae la contraseña ni su hash: solo si tiene una.
 */
export type CuentaAdministracion = {
  id: string;
  nombre: string;
  /** null en la administración antigua sin correo: entra con nametag hasta regularizarla. */
  correo: string | null;
  rol: RolAdministracion;
  estado: EstadoUsuario;
  fechaRegistro: string;
  tieneContrasena: boolean;
  sesionesAbiertas: number;
  ultimoAcceso: string | null;
};

export type DatosCuentaAdministracion = {
  nombre: string;
  correo: string;
  contrasena: string;
  confirmacion: string;
  rol: RolAdministracion;
};

const RUTA = '/api/superadmin/administradores';
const ruta = (id: string, resto = '') => `${RUTA}/${encodeURIComponent(id)}${resto}`;

export const listarAdministradores = () => api.get<{ cuentas: CuentaAdministracion[] }>(RUTA);

export const crearAdministrador = (datos: DatosCuentaAdministracion) =>
  api.post<{ cuenta: CuentaAdministracion }>(RUTA, datos);

/** Nombre y/o correo. Asignar un correo regulariza una administración antigua sin él. */
export const actualizarAdministrador = (
  id: string,
  datos: Partial<Pick<CuentaAdministracion, 'nombre'>> & { correo?: string },
) => api.patch<{ cuenta: CuentaAdministracion }>(ruta(id), datos);

/**
 * Cambia el rol. Pasar a un rol de personal revoca la administración: la cuenta sale de esta
 * lista (`cuenta: null`) y pasa a «Cuentas de personal».
 */
export const cambiarRolAdministrador = (id: string, rol: RolAdministracion | RolPersonal) =>
  api.patch<{ cuenta: CuentaAdministracion | null; rol: Rol; cambio: boolean }>(ruta(id, '/rol'), {
    rol,
  });

/** Desactivar cierra sus sesiones de inmediato; reactivar exige volver a entrar. */
export const cambiarEstadoAdministrador = (id: string, estado: 'activo' | 'suspendido') =>
  api.patch<{ cuenta: CuentaAdministracion; cambio: boolean }>(ruta(id, '/estado'), { estado });

/** Asigna una contraseña nueva y cierra todas las sesiones de la cuenta. */
export const restablecerContrasenaAdministrador = (
  id: string,
  datos: { contrasena: string; confirmacion: string },
) => api.post<{ cuenta: CuentaAdministracion }>(ruta(id, '/contrasena'), datos);
