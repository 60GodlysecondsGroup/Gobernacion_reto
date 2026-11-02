import type { Database } from '../../db/database.js';
import type { EstadoUsuario } from '../administracion/administracion.repository.js';
import { cteAuditoria, parametrosAuditoria } from '../auditoria/auditoria.js';
import { ROLES_ADMINISTRACION, type Rol, type RolAdministracion } from '../seguridad/permisos.js';

/**
 * Cuenta de administración tal como la ve la superadministración. El nombre es el alias de la
 * cuenta. Nunca incluye la contraseña ni su hash: solo si tiene una.
 */
export type CuentaAdministracion = {
  id: string;
  nombre: string;
  /** null en la administración antigua sin correo: solo entra con nametag hasta regularizarla. */
  correo: string | null;
  rol: RolAdministracion;
  estado: EstadoUsuario;
  fechaRegistro: string;
  tieneContrasena: boolean;
  /** Sesiones vigentes (no vencidas ni revocadas). */
  sesionesAbiertas: number;
  /** Último inicio de sesión que conserva la base, o null. */
  ultimoAcceso: string | null;
};

const SELECT_CUENTA = `
  select u.id_usuario as id, u.alias as nombre, u.correo, u.rol, u.estado,
         u.fecha_registro as "fechaRegistro",
         exists (select 1 from app.credencial c where c.id_usuario = u.id_usuario)
           as "tieneContrasena",
         (select count(*)::int from app.sesion s
          where s.id_usuario = u.id_usuario and s.fecha_revocacion is null
            and s.fecha_expiracion > now()) as "sesionesAbiertas",
         (select max(s.fecha_creacion) from app.sesion s where s.id_usuario = u.id_usuario)
           as "ultimoAcceso"`;

/**
 * Quien actúa debe seguir siendo superadmin activo en el momento de escribir, no solo al cargar
 * la sesión: si lo degradan o lo desactivan entre medias, la sentencia no cambia nada.
 */
const CTE_ACTOR = `actor as (
  select 1 from app.usuario where id_usuario = $1::uuid and rol = 'superadmin' and estado = 'activo'
)`;

const ENTIDAD = 'cuenta_administracion' as const;

/**
 * Cuentas de administración y superadministración. Cada cambio va en una sola sentencia con su
 * registro de auditoría (`cteAuditoria`). El parámetro $1 es siempre el actor.
 */
export function crearRepositorioSuperadmin(db: Database) {
  return {
    async listar(): Promise<CuentaAdministracion[]> {
      const { rows } = await db.query<CuentaAdministracion>(
        `${SELECT_CUENTA}
         from app.usuario u
         where u.rol = any($1::text[])
         order by u.rol = 'superadmin' desc, u.estado = 'activo' desc, lower(u.alias)`,
        [ROLES_ADMINISTRACION],
      );
      return rows;
    },

    /** Una cuenta de administración, o null si no existe o no es de administración. */
    async cuenta(idUsuario: string): Promise<CuentaAdministracion | null> {
      const { rows } = await db.query<CuentaAdministracion>(
        `${SELECT_CUENTA} from app.usuario u where u.id_usuario = $1 and u.rol = any($2::text[])`,
        [idUsuario, ROLES_ADMINISTRACION],
      );
      return rows[0] ?? null;
    },

    /**
     * Crea la cuenta y su credencial (solo el hash) con su registro. Nombre o correo repetidos
     * fallan por `usuario_alias_unico` o `usuario_correo_unico`. null si el actor ya no puede.
     */
    async crear(cuenta: {
      actor: string;
      codigo: string;
      nombre: string;
      correo: string;
      rol: RolAdministracion;
      hashContrasena: string;
    }): Promise<string | null> {
      const { rows } = await db.query<{ id: string }>(
        `with ${CTE_ACTOR},
         u as (
           insert into app.usuario (codigo, alias, rol, correo)
           select $5, $6, $7, $8 where exists (select 1 from actor)
           returning id_usuario
         ), credencial as (
           insert into app.credencial (id_usuario, hash_contrasena) select id_usuario, $9 from u
         ), ${cteAuditoria('u', 'id_usuario::text', 1)}
         select id_usuario as id from u`,
        [
          ...parametrosAuditoria({
            actor: cuenta.actor,
            accion: 'crear_cuenta_administracion',
            entidad: ENTIDAD,
            detalle: { rolNuevo: cuenta.rol },
          }),
          cuenta.codigo,
          cuenta.nombre,
          cuenta.rol,
          cuenta.correo,
          cuenta.hashContrasena,
        ],
      );
      return rows[0]?.id ?? null;
    },

    /**
     * Cambia nombre y/o correo. El registro guarda qué campos cambiaron, nunca sus valores (mismo
     * criterio que las cuentas de personal).
     */
    async actualizarDatos(cambio: {
      actor: string;
      idUsuario: string;
      nombre?: string;
      correo?: string;
    }): Promise<boolean> {
      const campos = [
        ...(cambio.nombre !== undefined ? ['nombre'] : []),
        ...(cambio.correo !== undefined ? ['correo'] : []),
      ];
      const { rows } = await db.query(
        `with ${CTE_ACTOR},
         cambio as (
           update app.usuario set alias = coalesce($5, alias), correo = coalesce($6, correo)
           where id_usuario = $7 and rol = any($8::text[]) and exists (select 1 from actor)
           returning id_usuario
         ), ${cteAuditoria('cambio', 'id_usuario::text', 1)}
         select 1 from cambio`,
        [
          ...parametrosAuditoria({
            actor: cambio.actor,
            accion: 'actualizar_cuenta_administracion',
            entidad: ENTIDAD,
            detalle: { campos },
          }),
          cambio.nombre ?? null,
          cambio.correo ?? null,
          cambio.idUsuario,
          ROLES_ADMINISTRACION,
        ],
      );
      return rows.length > 0;
    },

    /**
     * Cambia el rol de una cuenta de administración. Si el rol nuevo tiene menos privilegios
     * (`revocarSesiones`), se cierran todas sus sesiones. Dejar la plataforma sin superadmin activo
     * falla en la base (`ultimo_superadmin_activo`) y no cambia nada, tampoco el registro.
     */
    async cambiarRol(cambio: {
      actor: string;
      idUsuario: string;
      anterior: RolAdministracion;
      nuevo: Rol;
      revocarSesiones: boolean;
    }): Promise<boolean> {
      const { rows } = await db.query(
        `with ${CTE_ACTOR},
         cambio as (
           update app.usuario set rol = $5
           where id_usuario = $6 and rol = $7 and exists (select 1 from actor)
           returning id_usuario
         ), cierre as (
           update app.sesion s set fecha_revocacion = now()
           from cambio
           where $8 and s.id_usuario = cambio.id_usuario and s.fecha_revocacion is null
         ), ${cteAuditoria('cambio', 'id_usuario::text', 1)}
         select 1 from cambio`,
        [
          ...parametrosAuditoria({
            actor: cambio.actor,
            accion: (ROLES_ADMINISTRACION as readonly string[]).includes(cambio.nuevo)
              ? 'cambiar_rol_administracion'
              : 'revocar_privilegios_administracion',
            entidad: ENTIDAD,
            detalle: {
              rolAnterior: cambio.anterior,
              rolNuevo: cambio.nuevo,
              sesionesCerradas: cambio.revocarSesiones,
            },
          }),
          cambio.nuevo,
          cambio.idUsuario,
          cambio.anterior,
          cambio.revocarSesiones,
        ],
      );
      return rows.length > 0;
    },

    /**
     * Activa o desactiva una cuenta de administración. Desactivar revoca todas sus sesiones: al
     * reactivarla, una cookie anterior no vuelve a servir.
     */
    async cambiarEstado(cambio: {
      actor: string;
      idUsuario: string;
      anterior: EstadoUsuario;
      nuevo: EstadoUsuario;
    }): Promise<boolean> {
      const { rows } = await db.query(
        `with ${CTE_ACTOR},
         cambio as (
           update app.usuario set estado = $5
           where id_usuario = $6 and estado = $7 and rol = any($8::text[])
             and exists (select 1 from actor)
           returning id_usuario
         ), cierre as (
           update app.sesion s set fecha_revocacion = now()
           from cambio
           where $5 <> 'activo' and s.id_usuario = cambio.id_usuario and s.fecha_revocacion is null
         ), ${cteAuditoria('cambio', 'id_usuario::text', 1)}
         select 1 from cambio`,
        [
          ...parametrosAuditoria({
            actor: cambio.actor,
            accion: 'cambiar_estado_administracion',
            entidad: ENTIDAD,
            detalle: { estadoAnterior: cambio.anterior, estadoNuevo: cambio.nuevo },
          }),
          cambio.nuevo,
          cambio.idUsuario,
          cambio.anterior,
          ROLES_ADMINISTRACION,
        ],
      );
      return rows.length > 0;
    },

    /**
     * Define o reemplaza la contraseña (solo el hash) y cierra todas las sesiones de la cuenta:
     * quien la tuviera abierta debe entrar con la nueva. El registro no lleva el hash.
     */
    async restablecerContrasena(cambio: {
      actor: string;
      idUsuario: string;
      hashContrasena: string;
    }): Promise<boolean> {
      const { rows } = await db.query(
        `with ${CTE_ACTOR},
         guardada as (
           insert into app.credencial (id_usuario, hash_contrasena)
           select u.id_usuario, $5 from app.usuario u
           where u.id_usuario = $6 and u.rol = any($7::text[]) and exists (select 1 from actor)
           on conflict (id_usuario) do update set hash_contrasena = excluded.hash_contrasena
           returning id_usuario
         ), cierre as (
           update app.sesion s set fecha_revocacion = now()
           from guardada
           where s.id_usuario = guardada.id_usuario and s.fecha_revocacion is null
         ), ${cteAuditoria('guardada', 'id_usuario::text', 1)}
         select 1 from guardada`,
        [
          ...parametrosAuditoria({
            actor: cambio.actor,
            accion: 'restablecer_contrasena',
            entidad: ENTIDAD,
            detalle: { origen: 'superadmin' },
          }),
          cambio.hashContrasena,
          cambio.idUsuario,
          ROLES_ADMINISTRACION,
        ],
      );
      return rows.length > 0;
    },
  };
}

export type RepositorioSuperadmin = ReturnType<typeof crearRepositorioSuperadmin>;
