import type { Database } from '../../db/database.js';
import { esUuid } from '../../http/validacion.js';
import type { Rol } from './permisos.js';

export type UsuarioRegistrado = {
  idUsuario: string;
  codigo: string;
  alias: string;
  rol: Rol;
  rangoEdad: string | null;
  estado: 'activo' | 'suspendido' | 'bloqueado';
};

export type UsuarioDemo = {
  codigo: string;
  alias: string;
  rol: Rol;
  comunidad: string | null;
  rango: string | null;
};

const COLUMNAS = `
  id_usuario as "idUsuario", codigo, alias, rol, rango_edad as "rangoEdad", estado`;

export function crearRepositorioUsuarios(db: Database) {
  return {
    async porId(idUsuario: string): Promise<UsuarioRegistrado | null> {
      if (!esUuid(idUsuario)) return null;
      const { rows } = await db.query<UsuarioRegistrado>(
        `select ${COLUMNAS} from app.usuario where id_usuario = $1`,
        [idUsuario],
      );
      return rows[0] ?? null;
    },

    async porCodigo(codigo: string): Promise<UsuarioRegistrado | null> {
      const { rows } = await db.query<UsuarioRegistrado>(
        `select ${COLUMNAS} from app.usuario where codigo = $1`,
        [codigo],
      );
      return rows[0] ?? null;
    },

    /** Solo para el selector del acceso de demostración. */
    async listarDemo(): Promise<UsuarioDemo[]> {
      const { rows } = await db.query<UsuarioDemo>(`
        select u.codigo, u.alias, u.rol, c.nombre as comunidad, r.etiqueta as rango
        from app.usuario u
        left join app.comunidad c on c.rango_edad = u.rango_edad
        left join app.rango_edad r on r.codigo = u.rango_edad
        where u.estado = 'activo'
        order by u.rol = 'usuario' desc, u.rango_edad nulls last, u.codigo`);
      return rows;
    },
  };
}

export type RepositorioUsuarios = ReturnType<typeof crearRepositorioUsuarios>;
