import type { Database } from '../../db/database.js';
import { esUuid } from '../../http/validacion.js';
import type { ConfiguracionAvatar } from '../avatar/avatar.repository.js';
import type { Rol } from './permisos.js';
import type { CodigoRango } from './rango-edad.js';

export type UsuarioRegistrado = {
  idUsuario: string;
  codigo: string;
  alias: string;
  rol: Rol;
  rangoEdad: string | null;
  estado: 'activo' | 'suspendido' | 'bloqueado';
};

/** Datos de una cuenta nueva. El rol no se recibe: el registro solo crea jóvenes (`usuario`). */
export type CuentaNueva = {
  codigo: string;
  alias: string;
  rango: CodigoRango;
  intereses: string[];
  hashContrasena: string;
  avatar: ConfiguracionAvatar;
};

const COLUMNAS = `
  u.id_usuario as "idUsuario", u.codigo, u.alias, u.rol, u.rango_edad as "rangoEdad", u.estado`;

export function crearRepositorioUsuarios(db: Database) {
  return {
    async porId(idUsuario: string): Promise<UsuarioRegistrado | null> {
      if (!esUuid(idUsuario)) return null;
      const { rows } = await db.query<UsuarioRegistrado>(
        `select ${COLUMNAS} from app.usuario u where u.id_usuario = $1`,
        [idUsuario],
      );
      return rows[0] ?? null;
    },

    /**
     * Cuenta por nametag (sin distinguir mayúsculas) y el hash de su contraseña, o null si no hay
     * una cuenta con ese nametag. `hash` es null si la cuenta no tiene contraseña.
     * Solo lo usa el inicio de sesión: el hash nunca sale del backend.
     */
    async paraIniciarSesion(
      alias: string,
    ): Promise<{ usuario: UsuarioRegistrado; hash: string | null } | null> {
      const { rows } = await db.query<UsuarioRegistrado & { hash: string | null }>(
        `select ${COLUMNAS}, c.hash_contrasena as hash
         from app.usuario u left join app.credencial c on c.id_usuario = u.id_usuario
         where lower(u.alias) = lower($1)`,
        [alias],
      );
      const fila = rows[0];
      if (!fila) return null;
      const { hash, ...usuario } = fila;
      return { usuario, hash };
    },

    /**
     * Crea la cuenta, su contraseña y su avatar en una sola sentencia: o se guarda todo o nada.
     * Un nametag repetido falla por el índice único `usuario_alias_unico`, también si dos
     * registros llegan a la vez.
     */
    async registrar(cuenta: CuentaNueva): Promise<UsuarioRegistrado> {
      const { avatar } = cuenta;
      const { rows } = await db.query<UsuarioRegistrado>(
        `with nuevo as (
           insert into app.usuario (codigo, alias, rol, rango_edad, intereses_generales)
           values ($1, $2, 'usuario', $3, $4)
           returning *
         ),
         credencial as (
           insert into app.credencial (id_usuario, hash_contrasena)
           select id_usuario, $5 from nuevo
         ),
         avatar as (
           insert into app.configuracion_avatar
             (id_usuario, id_personaje, id_cabello, id_rasgos, id_prenda, id_accesorio)
           select id_usuario, $6, $7, $8, $9, $10 from nuevo
         )
         select ${COLUMNAS} from nuevo u`,
        [
          cuenta.codigo,
          cuenta.alias,
          cuenta.rango,
          cuenta.intereses,
          cuenta.hashContrasena,
          avatar.personaje,
          avatar.cabello,
          avatar.rasgos,
          avatar.prenda,
          avatar.accesorio,
        ],
      );
      return rows[0]!;
    },

    /**
     * Define o reemplaza la contraseña de una cuenta y deja constancia en el registro de
     * auditoría (sin el hash). Solo la usa `npm run admin:contrasena`: no hay ruta HTTP.
     */
    async guardarContrasena(
      idUsuario: string,
      hashContrasena: string,
    ): Promise<'creada' | 'reemplazada'> {
      const { rows } = await db.query<{ reemplazada: boolean }>(
        `with previa as (select 1 from app.credencial where id_usuario = $1),
         guardada as (
           insert into app.credencial (id_usuario, hash_contrasena) values ($1, $2)
           on conflict (id_usuario) do update set hash_contrasena = excluded.hash_contrasena
           returning id_usuario
         ),
         registro as (
           insert into app.registro_auditoria (id_usuario_actor, accion, entidad, id_entidad, detalle)
           select null, case when exists (select 1 from previa)
                             then 'restablecer_contrasena' else 'establecer_contrasena' end,
                  'usuario', id_usuario::text, '{"origen": "consola"}'::jsonb
           from guardada
         )
         select exists (select 1 from previa) as reemplazada`,
        [idUsuario, hashContrasena],
      );
      return rows[0]?.reemplazada ? 'reemplazada' : 'creada';
    },

    /** Rangos de edad del catálogo, para el formulario de registro. */
    async rangos(): Promise<{ codigo: CodigoRango; etiqueta: string }[]> {
      const { rows } = await db.query<{ codigo: CodigoRango; etiqueta: string }>(
        'select codigo, etiqueta from app.rango_edad order by codigo',
      );
      return rows;
    },
  };
}

export type RepositorioUsuarios = ReturnType<typeof crearRepositorioUsuarios>;
