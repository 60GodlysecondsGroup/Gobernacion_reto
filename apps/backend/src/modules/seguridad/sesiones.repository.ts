import type { Database } from '../../db/database.js';
import { esUuid } from '../../http/validacion.js';
import type { UsuarioRegistrado } from './usuarios.repository.js';

/** Sesiones del servidor (app.sesion): permiten cerrar sesión de verdad, no solo borrar la cookie. */
export function crearRepositorioSesiones(db: Database) {
  return {
    async abrir(idUsuario: string, duracionMs: number, persistente: boolean): Promise<string> {
      const { rows } = await db.query<{ id: string }>(
        `insert into app.sesion (id_usuario, persistente, fecha_expiracion)
         values ($1, $2, now() + make_interval(secs => $3::double precision / 1000))
         returning id_sesion as id`,
        [idUsuario, persistente, duracionMs],
      );
      return rows[0]!.id;
    },

    /** Dueño de una sesión vigente (existe, no venció, no fue revocada), o null. */
    async usuarioDe(idSesion: string): Promise<UsuarioRegistrado | null> {
      if (!esUuid(idSesion)) return null;
      const { rows } = await db.query<UsuarioRegistrado>(
        `select u.id_usuario as "idUsuario", u.codigo, u.alias, u.rol,
                u.rango_edad as "rangoEdad", u.estado
         from app.sesion s join app.usuario u on u.id_usuario = s.id_usuario
         where s.id_sesion = $1 and s.fecha_revocacion is null and s.fecha_expiracion > now()`,
        [idSesion],
      );
      return rows[0] ?? null;
    },

    async revocar(idSesion: string): Promise<void> {
      if (!esUuid(idSesion)) return;
      await db.query(
        `update app.sesion set fecha_revocacion = now()
         where id_sesion = $1 and fecha_revocacion is null`,
        [idSesion],
      );
    },

    /** Cierra todas las sesiones abiertas de una cuenta (p. ej. al cambiar su contraseña). */
    async revocarTodas(idUsuario: string): Promise<number> {
      const { rowCount } = await db.query(
        `update app.sesion set fecha_revocacion = now()
         where id_usuario = $1 and fecha_revocacion is null and fecha_expiracion > now()`,
        [idUsuario],
      );
      return rowCount ?? 0;
    },

    /** Borra sesiones vencidas o revocadas hace más de un día: ya no sirven para nada. */
    async purgar(): Promise<void> {
      await db.query(
        `delete from app.sesion
         where fecha_expiracion < now() - interval '1 day'
            or fecha_revocacion < now() - interval '1 day'`,
      );
    },
  };
}

export type RepositorioSesiones = ReturnType<typeof crearRepositorioSesiones>;
