import type { Database } from '../../db/database.js';
import { esUuid } from '../../http/validacion.js';
import type { Rol } from '../seguridad/permisos.js';
import type { CodigoRango } from '../seguridad/rango-edad.js';

export type OpcionAvatar = { id: string; nombre: string; recurso: string };

/** Lo que cualquiera de la misma comunidad puede ver. Nunca edad, rango ni datos de contacto. */
export type PerfilPublico = {
  id: string;
  alias: string;
  intereses: string[];
  avatar: OpcionAvatar | null;
};

export type PerfilPropio = PerfilPublico & { rol: Rol };

const SELECT_PERFIL = `
  select u.id_usuario as id, u.alias, u.intereses_generales as intereses, u.rol,
         case when e.id_elemento is null then null
              else json_build_object('id', e.id_elemento, 'nombre', e.nombre, 'recurso', e.recurso_grafico)
         end as avatar
  from app.usuario u
  left join app.configuracion_avatar ca on ca.id_usuario = u.id_usuario
  left join app.elemento_avatar e on e.id_elemento = ca.id_personaje`;

const sinRol = ({ rol: _rol, ...perfil }: PerfilPropio): PerfilPublico => perfil;

export function crearRepositorioPerfil(db: Database) {
  return {
    async propio(idUsuario: string): Promise<PerfilPropio | null> {
      const { rows } = await db.query<PerfilPropio>(`${SELECT_PERFIL} where u.id_usuario = $1`, [
        idUsuario,
      ]);
      return rows[0] ?? null;
    },

    async opcionesAvatar(): Promise<OpcionAvatar[]> {
      const { rows } = await db.query<OpcionAvatar>(`
        select id_elemento as id, nombre, recurso_grafico as recurso
        from app.elemento_avatar
        where tipo = 'personaje' and estado = 'activo'
        order by id_elemento`);
      return rows;
    },

    async actualizar(
      idUsuario: string,
      datos: { alias: string; intereses: string[]; idAvatar: string },
    ): Promise<void> {
      // Una sola sentencia: alias, intereses y avatar se guardan juntos o no se guarda nada.
      await db.query(
        `with usuario as (
           update app.usuario set alias = $2, intereses_generales = $3
           where id_usuario = $1
           returning id_usuario
         )
         insert into app.configuracion_avatar (id_usuario, id_personaje)
         select id_usuario, $4 from usuario
         on conflict (id_usuario) do update set id_personaje = excluded.id_personaje`,
        [idUsuario, datos.alias, datos.intereses, datos.idAvatar],
      );
    },

    /** Búsqueda por alias, solo entre jóvenes activos del mismo rango (RF03). */
    async buscarEnRango(rango: CodigoRango, texto: string, limite = 20): Promise<PerfilPublico[]> {
      const patron = `%${texto.replace(/[\\%_]/g, '\\$&')}%`;
      const { rows } = await db.query<PerfilPropio>(
        `${SELECT_PERFIL}
         where u.rango_edad = $1 and u.rol = 'usuario' and u.estado = 'activo' and u.alias ilike $2
         order by u.alias
         limit $3`,
        [rango, patron, limite],
      );
      return rows.map(sinRol);
    },

    async publicoEnRango(rango: CodigoRango, idUsuario: string): Promise<PerfilPublico | null> {
      if (!esUuid(idUsuario)) return null;
      const { rows } = await db.query<PerfilPropio>(
        `${SELECT_PERFIL}
         where u.id_usuario = $2 and u.rango_edad = $1 and u.rol = 'usuario' and u.estado = 'activo'`,
        [rango, idUsuario],
      );
      return rows[0] ? sinRol(rows[0]) : null;
    },
  };
}

export type RepositorioPerfil = ReturnType<typeof crearRepositorioPerfil>;
