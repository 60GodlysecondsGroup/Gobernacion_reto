import type { Database } from '../../db/database.js';
import { esUuid } from '../../http/validacion.js';
import { sqlApariencia, type Apariencia } from '../avatar/avatar.repository.js';
import type { Rol } from '../seguridad/permisos.js';
import type { CodigoRango } from '../seguridad/rango-edad.js';

/** Lo que cualquiera de la misma comunidad puede ver. Nunca edad, rango ni datos de contacto. */
export type PerfilPublico = {
  id: string;
  alias: string;
  intereses: string[];
  avatar: Apariencia | null;
};

export type PerfilPropio = PerfilPublico & { rol: Rol };

const SELECT_PERFIL = `
  select u.id_usuario as id, u.alias, u.intereses_generales as intereses, u.rol,
         ${sqlApariencia('u.id_usuario')} as avatar
  from app.usuario u`;

const sinRol = ({ rol: _rol, ...perfil }: PerfilPropio): PerfilPublico => perfil;

export function crearRepositorioPerfil(db: Database) {
  return {
    async propio(idUsuario: string): Promise<PerfilPropio | null> {
      const { rows } = await db.query<PerfilPropio>(`${SELECT_PERFIL} where u.id_usuario = $1`, [
        idUsuario,
      ]);
      return rows[0] ?? null;
    },

    async actualizar(
      idUsuario: string,
      datos: { alias: string; intereses: string[] },
    ): Promise<void> {
      await db.query(
        'update app.usuario set alias = $2, intereses_generales = $3 where id_usuario = $1',
        [idUsuario, datos.alias, datos.intereses],
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
