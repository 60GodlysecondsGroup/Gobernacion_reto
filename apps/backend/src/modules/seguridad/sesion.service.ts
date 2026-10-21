import { ErrorApp } from '../../http/errores.js';
import type { RepositorioComunidades } from '../comunidad/comunidad.repository.js';
import { permisosDe, type Permiso, type Rol } from './permisos.js';
import type { CodigoRango, ProveedorRangoEdad } from './rango-edad.js';
import { crearToken, verificarToken } from './sesion.token.js';
import type { RepositorioUsuarios, UsuarioRegistrado } from './usuarios.repository.js';

/** Identidad autenticada de una solicitud. La comunidad se deriva SIEMPRE de `rango`. */
export type Sesion = {
  idUsuario: string;
  alias: string;
  rol: Rol;
  rango: CodigoRango | null;
};

/** Lo que el frontend recibe de su propia sesión. Nunca incluye edad exacta. */
export type SesionPublica = {
  id: string;
  alias: string;
  rol: Rol;
  comunidad: { id: string; nombre: string } | null;
  permisos: Permiso[];
};

type Dependencias = {
  usuarios: RepositorioUsuarios;
  comunidades: RepositorioComunidades;
  proveedorRango: ProveedorRangoEdad;
  secreto: string;
  duracionMs: number;
};

export function crearServicioSesion({
  usuarios,
  comunidades,
  proveedorRango,
  secreto,
  duracionMs,
}: Dependencias) {
  async function aSesion(usuario: UsuarioRegistrado): Promise<Sesion> {
    const rango = await proveedorRango.determinarRango(usuario);
    return { idUsuario: usuario.idUsuario, alias: usuario.alias, rol: usuario.rol, rango };
  }

  return {
    /** Sesión vigente a partir del token de la cookie, o null. Una cuenta no activa no tiene sesión. */
    async resolver(token: string): Promise<Sesion | null> {
      const idUsuario = verificarToken(token, secreto);
      if (!idUsuario) return null;
      const usuario = await usuarios.porId(idUsuario);
      if (!usuario || usuario.estado !== 'activo') return null;
      return aSesion(usuario);
    },

    /** Acceso de demostración: entra como un usuario sintético del seed. */
    async iniciarDemo(codigo: string): Promise<{ token: string; sesion: Sesion }> {
      const usuario = await usuarios.porCodigo(codigo);
      if (!usuario || usuario.estado !== 'activo') {
        throw new ErrorApp(404, 'USUARIO_DEMO_NO_ENCONTRADO', 'No existe ese usuario de prueba.');
      }
      return {
        token: crearToken(usuario.idUsuario, secreto, duracionMs),
        sesion: await aSesion(usuario),
      };
    },

    async describir(sesion: Sesion): Promise<SesionPublica> {
      const comunidad = sesion.rango ? await comunidades.porRango(sesion.rango) : null;
      return {
        id: sesion.idUsuario,
        alias: sesion.alias,
        rol: sesion.rol,
        comunidad: comunidad ? { id: comunidad.id, nombre: comunidad.nombre } : null,
        permisos: permisosDe(sesion.rol),
      };
    },

    listarUsuariosDemo: () => usuarios.listarDemo(),
  };
}

export type ServicioSesion = ReturnType<typeof crearServicioSesion>;
