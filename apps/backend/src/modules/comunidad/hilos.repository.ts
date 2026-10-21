import type { Database } from '../../db/database.js';
import type { OpcionAvatar } from '../perfil/perfil.repository.js';

/** Autor de un contenido: solo alias y avatar (F09). Nunca edad, rango ni datos de contacto. */
export type Autor = { id: string; alias: string; avatar: OpcionAvatar | null };

export type CategoriaForo = { codigo: string; nombre: string; descripcion: string; hilos: number };

export type HiloResumen = {
  id: string;
  titulo: string;
  extracto: string;
  estado: 'activo' | 'cerrado';
  fecha: string;
  ultimaActividad: string;
  respuestas: number;
  categoria: { codigo: string; nombre: string };
  autor: Autor;
};

export type HiloDetalle = Omit<HiloResumen, 'extracto' | 'respuestas' | 'ultimaActividad'> & {
  contenido: string;
};

export type Respuesta = { id: string; contenido: string; fecha: string; autor: Autor };

const AUTOR = `json_build_object(
  'id', u.id_usuario, 'alias', u.alias,
  'avatar', case when e.id_elemento is null then null
                 else json_build_object('id', e.id_elemento, 'nombre', e.nombre, 'recurso', e.recurso_grafico)
            end)`;

const UNIR_AUTOR = `
  join app.usuario u on u.id_usuario = %AUTOR%
  left join app.configuracion_avatar ca on ca.id_usuario = u.id_usuario
  left join app.elemento_avatar e on e.id_elemento = ca.id_personaje`;

const unirAutor = (columna: string) => UNIR_AUTOR.replace('%AUTOR%', columna);

const CATEGORIA = `json_build_object('codigo', cat.codigo, 'nombre', cat.nombre)`;

/**
 * Hilos y respuestas. Toda consulta recibe la comunidad de la sesión y filtra por ella:
 * un hilo de otra comunidad simplemente no existe para quien consulta (RF02).
 */
export function crearRepositorioHilos(db: Database) {
  return {
    async categorias(idComunidad: string): Promise<CategoriaForo[]> {
      const { rows } = await db.query<CategoriaForo>(
        `select cat.codigo, cat.nombre, cat.descripcion,
                count(h.id_hilo) filter (where h.estado <> 'oculto')::int as hilos
         from app.categoria cat
         left join app.hilo h on h.id_categoria = cat.id_categoria and h.id_comunidad = $1
         where cat.estado = 'activa'
         group by cat.id_categoria
         order by cat.orden`,
        [idComunidad],
      );
      return rows;
    },

    async idCategoriaActiva(codigo: string): Promise<string | null> {
      const { rows } = await db.query<{ id: string }>(
        `select id_categoria as id from app.categoria where codigo = $1 and estado = 'activa'`,
        [codigo],
      );
      return rows[0]?.id ?? null;
    },

    /** Hilos visibles de la comunidad, por última actividad. Pide uno de más para saber si hay más. */
    async listar(
      idComunidad: string,
      filtro: { categoria?: string; buscar?: string; limite: number; desplazamiento: number },
    ): Promise<HiloResumen[]> {
      const patron = filtro.buscar ? `%${filtro.buscar.replace(/[\\%_]/g, '\\$&')}%` : null;
      const { rows } = await db.query<HiloResumen>(
        `select h.id_hilo as id, h.titulo, left(h.contenido, 180) as extracto, h.estado,
                h.fecha_creacion as fecha,
                greatest(h.fecha_creacion, max(r.fecha_creacion)) as "ultimaActividad",
                count(r.id_respuesta)::int as respuestas,
                ${CATEGORIA} as categoria,
                ${AUTOR} as autor
         from app.hilo h
         join app.categoria cat on cat.id_categoria = h.id_categoria
         ${unirAutor('h.id_usuario')}
         left join app.respuesta r on r.id_hilo = h.id_hilo and r.estado = 'publicada'
         where h.id_comunidad = $1 and h.estado <> 'oculto'
           and ($2::text is null or cat.codigo = $2)
           and ($3::text is null or h.titulo ilike $3 or h.contenido ilike $3)
         group by h.id_hilo, cat.codigo, cat.nombre, u.id_usuario, e.id_elemento
         order by "ultimaActividad" desc, h.id_hilo
         limit $4 offset $5`,
        [idComunidad, filtro.categoria ?? null, patron, filtro.limite, filtro.desplazamiento],
      );
      return rows;
    },

    async porId(idComunidad: string, idHilo: string): Promise<HiloDetalle | null> {
      const { rows } = await db.query<HiloDetalle>(
        `select h.id_hilo as id, h.titulo, h.contenido, h.estado, h.fecha_creacion as fecha,
                ${CATEGORIA} as categoria, ${AUTOR} as autor
         from app.hilo h
         join app.categoria cat on cat.id_categoria = h.id_categoria
         ${unirAutor('h.id_usuario')}
         where h.id_hilo = $2 and h.id_comunidad = $1 and h.estado <> 'oculto'`,
        [idComunidad, idHilo],
      );
      return rows[0] ?? null;
    },

    async respuestas(idHilo: string): Promise<Respuesta[]> {
      const { rows } = await db.query<Respuesta>(
        `select r.id_respuesta as id, r.contenido, r.fecha_creacion as fecha, ${AUTOR} as autor
         from app.respuesta r
         ${unirAutor('r.id_usuario')}
         where r.id_hilo = $1 and r.estado = 'publicada'
         order by r.fecha_creacion, r.id_respuesta`,
        [idHilo],
      );
      return rows;
    },

    async crear(hilo: {
      idUsuario: string;
      idComunidad: string;
      idCategoria: string;
      titulo: string;
      contenido: string;
    }): Promise<string> {
      const { rows } = await db.query<{ id: string }>(
        `insert into app.hilo (id_usuario, id_comunidad, id_categoria, titulo, contenido)
         values ($1, $2, $3, $4, $5)
         returning id_hilo as id`,
        [hilo.idUsuario, hilo.idComunidad, hilo.idCategoria, hilo.titulo, hilo.contenido],
      );
      return rows[0]!.id;
    },

    async responder(respuesta: {
      idHilo: string;
      idUsuario: string;
      contenido: string;
    }): Promise<string> {
      const { rows } = await db.query<{ id: string }>(
        `insert into app.respuesta (id_hilo, id_usuario, contenido)
         values ($1, $2, $3)
         returning id_respuesta as id`,
        [respuesta.idHilo, respuesta.idUsuario, respuesta.contenido],
      );
      return rows[0]!.id;
    },
  };
}

export type RepositorioHilos = ReturnType<typeof crearRepositorioHilos>;
