import { z } from 'zod';
import { ErrorApp, errores } from '../../http/errores.js';
import { esUuid, validar } from '../../http/validacion.js';
import {
  camposContrasenaNueva,
  conflictoDeCuenta,
  crearConCodigoNuevo,
  esquemaNombreCuenta,
  hashContrasenaNueva,
} from '../administracion/administracion.service.js';
import type { GestorSalas } from '../salas/salas.gestor.js';
import {
  ROLES_ADMINISTRACION,
  ROLES_PERSONAL,
  tienePermiso,
  type Rol,
  type RolAdministracion,
} from '../seguridad/permisos.js';
import { esquemaCorreo, type Sesion } from '../seguridad/sesion.service.js';
import type { CuentaAdministracion, RepositorioSuperadmin } from './superadmin.repository.js';

/** Cuánto pesa cada rol que se puede asignar desde aquí: bajar de nivel cierra las sesiones. */
const NIVEL: Partial<Record<Rol, number>> = {
  superadmin: 3,
  admin_plataforma: 2,
  moderador: 1,
  gestor_fuentes: 1,
};

const esquemaRolAdministracion = z.enum(ROLES_ADMINISTRACION, {
  error: 'Elige el rol: administración o superadministración.',
});

/**
 * Cuenta de administración nueva. `.strict()` rechaza cualquier otro campo (`estado`, `codigo`…)
 * y el rol solo puede ser de administración: por aquí no nace personal ni un joven.
 */
const esquemaCuentaNueva = z
  .object({
    nombre: esquemaNombreCuenta,
    correo: esquemaCorreo,
    ...camposContrasenaNueva,
    rol: esquemaRolAdministracion,
  })
  .strict();

const esquemaDatos = z
  .object({ nombre: esquemaNombreCuenta.optional(), correo: esquemaCorreo.optional() })
  .strict()
  .refine((datos) => Object.keys(datos).length > 0, 'Indica al menos un campo.');

/**
 * Rol nuevo: otro de administración, o uno de personal para revocar los privilegios de
 * administración sin borrar la cuenta (su contenido y su historial se conservan).
 */
const esquemaRol = z
  .object({
    rol: z.enum([...ROLES_ADMINISTRACION, ...ROLES_PERSONAL], {
      error: 'Elige un rol válido.',
    }),
  })
  .strict();

/** Desde aquí solo se activa o desactiva: el bloqueo es una medida de moderación sobre jóvenes. */
const esquemaEstado = z
  .object({
    estado: z.enum(['activo', 'suspendido'], { error: 'Elige activar o desactivar.' }),
  })
  .strict();

const esquemaContrasena = z.object(camposContrasenaNueva).strict();

const cambioConcurrente = () =>
  new ErrorApp(409, 'CAMBIO_CONCURRENTE', 'La cuenta cambió. Vuelve a cargarla.');

/** Errores de la base que tienen una explicación para quien usa el panel; si no, null. */
function traducirErrorBase(error: unknown): ErrorApp | null {
  const { code, constraint } = error as { code?: string; constraint?: string };
  if (code === '23514' && constraint === 'ultimo_superadmin_activo') {
    return new ErrorApp(
      409,
      'ULTIMO_SUPERADMIN',
      'La plataforma no puede quedar sin un superadministrador activo.',
    );
  }
  if (code === '23514' && constraint === 'usuario_superadmin_con_correo') {
    return new ErrorApp(
      409,
      'CORREO_REQUERIDO',
      'Asigna primero un correo a la cuenta: la superadministración solo entra con correo.',
      { campo: 'correo' },
    );
  }
  return conflictoDeCuenta(error);
}

async function conErroresDeBase<T>(trabajo: () => Promise<T>): Promise<T> {
  try {
    return await trabajo();
  } catch (error) {
    throw traducirErrorBase(error) ?? error;
  }
}

type Dependencias = {
  repositorio: RepositorioSuperadmin;
  salas: Pick<GestorSalas, 'retirarUsuario'>;
};

/**
 * Superadministración: gestión de las cuentas de administración de la plataforma. Cada operación
 * vuelve a comprobar el permiso (además de la ruta), nunca actúa sobre la propia cuenta y deja su
 * registro de auditoría. La base es la última barrera: actor vigente en cada sentencia y nunca
 * sin un superadmin activo.
 */
export function crearServicioSuperadmin({ repositorio, salas }: Dependencias) {
  function exigir(sesion: Sesion) {
    if (!tienePermiso(sesion.rol, 'gestionar_administradores')) throw errores.prohibido();
  }

  /** La cuenta de administración sobre la que se actúa, que nunca es la propia. */
  async function objetivo(sesion: Sesion, idUsuario: string): Promise<CuentaAdministracion> {
    exigir(sesion);
    const cuenta = esUuid(idUsuario) ? await repositorio.cuenta(idUsuario) : null;
    if (!cuenta) throw errores.noEncontrado();
    if (cuenta.id === sesion.idUsuario) {
      throw new ErrorApp(
        403,
        'PROHIBIDO',
        'No puedes cambiar tu propia cuenta desde aquí: pídeselo a otra persona con superadministración.',
      );
    }
    return cuenta;
  }

  async function releer(idUsuario: string) {
    return { cuenta: await repositorio.cuenta(idUsuario) };
  }

  return {
    async listar(sesion: Sesion) {
      exigir(sesion);
      return { cuentas: await repositorio.listar() };
    },

    async crear(sesion: Sesion, entrada: unknown) {
      exigir(sesion);
      const datos = validar(esquemaCuentaNueva, entrada);
      const hashContrasena = await hashContrasenaNueva(datos);
      const id = await crearConCodigoNuevo((codigo) =>
        repositorio.crear({
          actor: sesion.idUsuario,
          codigo,
          nombre: datos.nombre,
          correo: datos.correo,
          rol: datos.rol,
          hashContrasena,
        }),
      );
      if (!id) throw errores.prohibido();
      return releer(id);
    },

    /** Nombre y correo. Asignar un correo regulariza una administración antigua sin él. */
    async actualizarDatos(sesion: Sesion, idUsuario: string, entrada: unknown) {
      const cuenta = await objetivo(sesion, idUsuario);
      const datos = validar(esquemaDatos, entrada);
      const ok = await conErroresDeBase(() =>
        repositorio.actualizarDatos({ actor: sesion.idUsuario, idUsuario: cuenta.id, ...datos }),
      );
      if (!ok) throw cambioConcurrente();
      return releer(cuenta.id);
    },

    /**
     * Sube, baja o revoca el rol. Bajar de nivel cierra las sesiones de la cuenta; pasar a un
     * rol de personal la saca de esta lista (queda en «Cuentas de personal»).
     */
    async cambiarRol(sesion: Sesion, idUsuario: string, entrada: unknown) {
      const cuenta = await objetivo(sesion, idUsuario);
      const { rol: nuevo } = validar(esquemaRol, entrada);
      if (cuenta.rol === nuevo) return { cuenta, rol: nuevo, cambio: false };
      if (nuevo === 'superadmin' && !cuenta.correo) {
        throw traducirErrorBase({ code: '23514', constraint: 'usuario_superadmin_con_correo' })!;
      }
      const baja = (NIVEL[nuevo] ?? 0) < (NIVEL[cuenta.rol] ?? 0);
      const ok = await conErroresDeBase(() =>
        repositorio.cambiarRol({
          actor: sesion.idUsuario,
          idUsuario: cuenta.id,
          anterior: cuenta.rol as RolAdministracion,
          nuevo,
          revocarSesiones: baja,
        }),
      );
      if (!ok) throw cambioConcurrente();
      if (!tienePermiso(nuevo, 'acceder_salas')) {
        await salas.retirarUsuario(cuenta.id, 'Tu rol cambió: ya no tienes acceso a las salas.');
      }
      const { cuenta: actualizada } = await releer(cuenta.id);
      return { cuenta: actualizada, rol: nuevo, cambio: true };
    },

    async cambiarEstado(sesion: Sesion, idUsuario: string, entrada: unknown) {
      const cuenta = await objetivo(sesion, idUsuario);
      const { estado } = validar(esquemaEstado, entrada);
      if (cuenta.estado === estado) return { cuenta, cambio: false };
      const ok = await conErroresDeBase(() =>
        repositorio.cambiarEstado({
          actor: sesion.idUsuario,
          idUsuario: cuenta.id,
          anterior: cuenta.estado,
          nuevo: estado,
        }),
      );
      if (!ok) throw cambioConcurrente();
      if (estado !== 'activo') await salas.retirarUsuario(cuenta.id);
      return { ...(await releer(cuenta.id)), cambio: true };
    },

    /**
     * Asigna una contraseña nueva (la persona la recibe por un canal seguro) y cierra todas las
     * sesiones de la cuenta. La contraseña no se devuelve ni se registra.
     */
    async restablecerContrasena(sesion: Sesion, idUsuario: string, entrada: unknown) {
      const cuenta = await objetivo(sesion, idUsuario);
      const datos = validar(esquemaContrasena, entrada);
      const hashContrasena = await hashContrasenaNueva({ ...datos, nombre: cuenta.nombre });
      const ok = await repositorio.restablecerContrasena({
        actor: sesion.idUsuario,
        idUsuario: cuenta.id,
        hashContrasena,
      });
      if (!ok) throw cambioConcurrente();
      return releer(cuenta.id);
    },
  };
}

export type ServicioSuperadmin = ReturnType<typeof crearServicioSuperadmin>;
