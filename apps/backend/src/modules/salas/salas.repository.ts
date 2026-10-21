import type { Database } from '../../db/database.js';
import type { OpcionAvatar } from '../perfil/perfil.repository.js';
import { leerObstaculos, type Escenario, type Posicion } from './salas.escenario.js';

export type EstadoSala = 'disponible' | 'llena' | 'vacia' | 'cerrada';

export type SalaResumen = {
  id: string;
  nombre: string;
  tematica: string;
  descripcion: string;
  reglas: string;
  capacidad: number;
  ocupacion: number;
  estado: EstadoSala;
};

export type SalaDetalle = SalaResumen & {
  idComunidad: string;
  /** Si esta instancia se cerró, la instancia abierta del mismo tema (si existe). */
  instanciaVigente: string | null;
};

export type Participante = { id: string; alias: string; avatar: OpcionAvatar | null };

export type ResultadoEntrada =
  { resultado: 'ok'; ocupacion: number } | { resultado: 'llena' | 'cerrada' };

const SELECT_SALA = `
  select s.id_sala as id, s.nombre, cat.nombre as tematica, s.descripcion, s.reglas,
         s.capacidad_maxima as capacidad, s.usuarios_actuales as ocupacion, s.estado,
         s.id_comunidad as "idComunidad"
  from app.sala s
  join app.categoria cat on cat.id_categoria = s.id_categoria`;

// Las marcas de tiempo de salas usan clock_timestamp() (hora real) y no now() (hora de inicio de
// la transacción): el cierre automático compara tiempos y debe funcionar también dentro de una.
export function crearRepositorioSalas(db: Database) {
  return {
    /** Salas abiertas de la comunidad (las instancias cerradas no se listan). */
    async listar(idComunidad: string): Promise<SalaResumen[]> {
      const { rows } = await db.query<SalaResumen & { idComunidad: string }>(
        `${SELECT_SALA}
         where s.id_comunidad = $1 and s.estado <> 'cerrada'
         order by cat.orden, s.nombre`,
        [idComunidad],
      );
      return rows.map(({ idComunidad: _comunidad, ...sala }) => sala);
    },

    /** Una sala de la comunidad indicada, cerrada o no. De otra comunidad: null. */
    async porId(idComunidad: string, idSala: string): Promise<SalaDetalle | null> {
      const { rows } = await db.query<SalaDetalle>(
        `select s.id_sala as id, s.nombre, cat.nombre as tematica, s.descripcion, s.reglas,
                s.capacidad_maxima as capacidad, s.usuarios_actuales as ocupacion, s.estado,
                s.id_comunidad as "idComunidad",
                (select v.id_sala from app.sala v
                 where s.estado = 'cerrada' and v.id_comunidad = s.id_comunidad
                   and v.nombre = s.nombre and v.estado <> 'cerrada') as "instanciaVigente"
         from app.sala s
         join app.categoria cat on cat.id_categoria = s.id_categoria
         where s.id_sala = $2 and s.id_comunidad = $1`,
        [idComunidad, idSala],
      );
      return rows[0] ?? null;
    },

    async escenario(idSala: string): Promise<Escenario | null> {
      const { rows } = await db.query<{
        ancho: number;
        alto: number;
        obstaculos: unknown;
        x: number;
        y: number;
      }>(
        `select ancho, alto, obstaculos, aparicion_x as x, aparicion_y as y
         from app.escenario_sala where id_sala = $1`,
        [idSala],
      );
      const fila = rows[0];
      if (!fila) return null;
      return {
        ancho: fila.ancho,
        alto: fila.alto,
        obstaculos: leerObstaculos(fila.obstaculos, fila.ancho, fila.alto),
        aparicion: { x: fila.x, y: fila.y },
      };
    },

    async participante(idUsuario: string): Promise<Participante> {
      const { rows } = await db.query<Participante>(
        `select u.id_usuario as id, u.alias,
                case when e.id_elemento is null then null
                     else json_build_object('id', e.id_elemento, 'nombre', e.nombre, 'recurso', e.recurso_grafico)
                end as avatar
         from app.usuario u
         left join app.configuracion_avatar ca on ca.id_usuario = u.id_usuario
         left join app.elemento_avatar e on e.id_elemento = ca.id_personaje
         where u.id_usuario = $1`,
        [idUsuario],
      );
      return rows[0]!;
    },

    /**
     * Ocupa un cupo de forma atómica: solo suma si la sala no está cerrada y tiene cupo.
     * El bloqueo de fila serializa entradas simultáneas y el CHECK de la tabla impide pasar de
     * la capacidad aunque algo fallara aquí (RF10).
     */
    async ocupar(idSala: string, idUsuario: string): Promise<ResultadoEntrada> {
      const { rows } = await db.query<{ ocupacion: number }>(
        `update app.sala
         set usuarios_actuales = usuarios_actuales + 1,
             estado = case when usuarios_actuales + 1 >= capacidad_maxima then 'llena' else 'disponible' end,
             vacia_desde = null,
             ultima_actividad = clock_timestamp()
         where id_sala = $1 and estado <> 'cerrada' and usuarios_actuales < capacidad_maxima
         returning usuarios_actuales as ocupacion`,
        [idSala],
      );
      if (!rows[0]) {
        const estado = await db.query<{ estado: EstadoSala }>(
          'select estado from app.sala where id_sala = $1',
          [idSala],
        );
        return { resultado: estado.rows[0]?.estado === 'cerrada' ? 'cerrada' : 'llena' };
      }
      // Cierra una participación que hubiera quedado abierta y registra la nueva.
      await db.query(
        `update app.participacion_sala set hora_salida = now()
         where id_sala = $1 and id_usuario = $2 and hora_salida is null`,
        [idSala, idUsuario],
      );
      await db.query('insert into app.participacion_sala (id_sala, id_usuario) values ($1, $2)', [
        idSala,
        idUsuario,
      ]);
      return { resultado: 'ok', ocupacion: rows[0].ocupacion };
    },

    /** Libera el cupo, cierra la participación y borra la posición (estado de sesión). */
    async liberar(idSala: string, idUsuario: string): Promise<number> {
      await db.query(
        `update app.participacion_sala set hora_salida = now()
         where id_sala = $1 and id_usuario = $2 and hora_salida is null`,
        [idSala, idUsuario],
      );
      await db.query(
        'delete from app.posicion_avatar_sala where id_sala = $1 and id_usuario = $2',
        [idSala, idUsuario],
      );
      const { rows } = await db.query<{ ocupacion: number }>(
        `update app.sala
         set usuarios_actuales = greatest(usuarios_actuales - 1, 0),
             estado = case when estado = 'cerrada' then estado
                           when usuarios_actuales - 1 <= 0 then 'vacia'
                           else 'disponible' end,
             vacia_desde = case when usuarios_actuales - 1 <= 0 then clock_timestamp() else null end,
             ultima_actividad = clock_timestamp()
         where id_sala = $1
         returning usuarios_actuales as ocupacion`,
        [idSala],
      );
      return rows[0]?.ocupacion ?? 0;
    },

    async guardarPosicion(idSala: string, idUsuario: string, { x, y }: Posicion): Promise<void> {
      await db.query(
        `insert into app.posicion_avatar_sala (id_sala, id_usuario, x, y)
         values ($1, $2, $3, $4)
         on conflict (id_sala, id_usuario)
         do update set x = excluded.x, y = excluded.y, fecha_actualizacion = now()`,
        [idSala, idUsuario, x, y],
      );
    },

    /**
     * Cierre automático (F13): cierra la instancia si sigue vacía desde hace `segundos` y, en la
     * misma sentencia, habilita una instancia nueva del mismo tema con el mismo escenario.
     * La instancia cerrada no vuelve a admitir entradas (TRL-08).
     */
    async cerrarSiVacia(
      idSala: string,
      segundos: number,
    ): Promise<{ cerrada: string | null; nueva: string | null; sigueVacia: boolean }> {
      const { rows } = await db.query<{ cerrada: string | null; nueva: string | null }>(
        `with cerrada as (
           update app.sala set estado = 'cerrada', fecha_cierre = clock_timestamp()
           where id_sala = $1 and estado = 'vacia' and usuarios_actuales = 0
             and vacia_desde <= clock_timestamp() - make_interval(secs => $2)
           returning id_sala, id_comunidad, id_categoria, nombre, descripcion, reglas, capacidad_maxima
         ), nueva as (
           insert into app.sala (id_comunidad, id_categoria, nombre, descripcion, reglas, capacidad_maxima)
           select id_comunidad, id_categoria, nombre, descripcion, reglas, capacidad_maxima from cerrada
           returning id_sala
         ), escenario as (
           insert into app.escenario_sala (id_sala, ancho, alto, obstaculos, aparicion_x, aparicion_y)
           select nueva.id_sala, e.ancho, e.alto, e.obstaculos, e.aparicion_x, e.aparicion_y
           from nueva, app.escenario_sala e
           where e.id_sala = $1
         )
         select (select id_sala from cerrada) as cerrada, (select id_sala from nueva) as nueva`,
        [idSala, segundos],
      );
      const { cerrada, nueva } = rows[0] ?? { cerrada: null, nueva: null };
      if (cerrada) return { cerrada, nueva, sigueVacia: false };
      const estado = await db.query<{ vacia: boolean }>(
        `select estado = 'vacia' and usuarios_actuales = 0 as vacia from app.sala where id_sala = $1`,
        [idSala],
      );
      return { cerrada: null, nueva: null, sigueVacia: estado.rows[0]?.vacia ?? false };
    },

    /**
     * Al arrancar el backend: nadie está conectado, así que se cierran las participaciones
     * abiertas y las salas con gente quedan vacías desde ahora. Devuelve las salas vacías y
     * cuántos segundos llevan así, para programar su cierre.
     */
    async reconciliar(): Promise<{ id: string; segundosVacia: number }[]> {
      await db.query(
        'update app.participacion_sala set hora_salida = now() where hora_salida is null',
      );
      await db.query('delete from app.posicion_avatar_sala');
      await db.query(
        `update app.sala
         set usuarios_actuales = 0, estado = 'vacia', vacia_desde = coalesce(vacia_desde, clock_timestamp())
         where estado in ('disponible', 'llena') and usuarios_actuales > 0`,
      );
      const { rows } = await db.query<{ id: string; segundosVacia: number }>(
        `select id_sala as id, extract(epoch from clock_timestamp() - vacia_desde)::float as "segundosVacia"
         from app.sala where estado = 'vacia'`,
      );
      return rows;
    },
  };
}

export type RepositorioSalas = ReturnType<typeof crearRepositorioSalas>;
