import type { Database } from '../../db/database.js';
import { cteAuditoria, parametrosAuditoria } from '../auditoria/auditoria.js';

export type ResumenCategoria = { categoria: string; nombre: string; total: number };

export type IncidenciaDlp = {
  fecha: string;
  categoria: string;
  nombreCategoria: string;
  tipoContenido: string;
  regla: string | null;
  accion: string;
  resultado: string;
};

export const ESTADOS_REPORTE = ['pendiente', 'en_revision', 'resuelto', 'descartado'] as const;
export type EstadoReporte = (typeof ESTADOS_REPORTE)[number];

export const RESOLUCIONES = [
  'sin_accion',
  'contenido_oculto',
  'usuario_suspendido',
  'sala_deshabilitada',
] as const;
export type Resolucion = (typeof RESOLUCIONES)[number];

export type TipoReportado = 'hilo' | 'respuesta' | 'perfil' | 'sala';

export type ReporteResumen = {
  id: string;
  tipoContenido: TipoReportado;
  motivo: string;
  estado: EstadoReporte;
  resolucion: Resolucion | null;
  fecha: string;
  fechaRevision: string | null;
  comunidad: string | null;
  tieneDetalle: boolean;
};

/** Autor del contenido: solo lo necesario para moderar (alias, rol y estado de la cuenta). */
export type AutorModeracion = { id: string; alias: string; rol: string; estado: string };

export type ContenidoReportado =
  | {
      tipo: 'hilo';
      id: string;
      titulo: string;
      contenido: string;
      estado: string;
      fecha: string;
      autor: AutorModeracion;
    }
  | {
      tipo: 'respuesta';
      id: string;
      contenido: string;
      estado: string;
      fecha: string;
      hilo: { id: string; titulo: string; estado: string };
      autor: AutorModeracion;
    }
  | { tipo: 'perfil'; id: string; alias: string; intereses: string[]; autor: AutorModeracion }
  | {
      tipo: 'sala';
      id: string;
      nombre: string;
      estado: string;
      habilitada: boolean;
      ocupacion: number;
      capacidad: number;
    };

export type ReporteDetalle = ReporteResumen & {
  /** Detalle opcional que escribió quien reportó (ya pasó por el DLP). */
  descripcion: string | null;
  /** Otros reportes abiertos sobre el mismo contenido (sin decir de quién). */
  otrosAbiertos: number;
  revisor: string | null;
  contenido: ContenidoReportado | null;
};

const SELECT_REPORTE = `
  select r.id_reporte as id, r.tipo_contenido as "tipoContenido", r.categoria as motivo,
         r.estado, r.resolucion, r.fecha_reporte as fecha, r.fecha_revision as "fechaRevision",
         c.nombre as comunidad, (r.descripcion is not null) as "tieneDetalle"
  from app.reporte r
  left join app.comunidad c on c.id_comunidad = r.id_comunidad`;

const AUTOR = `json_build_object('id', u.id_usuario, 'alias', u.alias, 'rol', u.rol, 'estado', u.estado)`;

/**
 * Contenido asociado a un reporte. El moderador ve el contenido reportado y el alias del autor;
 * nunca la identidad de quien reportó, la edad ni otros datos privados (Fase 7, punto 5).
 */
const CONTENIDO: Record<TipoReportado, string> = {
  hilo: `select 'hilo' as tipo, h.id_hilo as id, h.titulo, h.contenido, h.estado,
                h.fecha_creacion as fecha, ${AUTOR} as autor
         from app.hilo h join app.usuario u on u.id_usuario = h.id_usuario
         where h.id_hilo = $1`,
  respuesta: `select 'respuesta' as tipo, r.id_respuesta as id, r.contenido, r.estado,
                     r.fecha_creacion as fecha,
                     json_build_object('id', h.id_hilo, 'titulo', h.titulo, 'estado', h.estado) as hilo,
                     ${AUTOR} as autor
              from app.respuesta r
              join app.hilo h on h.id_hilo = r.id_hilo
              join app.usuario u on u.id_usuario = r.id_usuario
              where r.id_respuesta = $1`,
  perfil: `select 'perfil' as tipo, u.id_usuario as id, u.alias,
                  u.intereses_generales as intereses, ${AUTOR} as autor
           from app.usuario u where u.id_usuario = $1`,
  sala: `select 'sala' as tipo, s.id_sala as id, s.nombre, s.estado, s.habilitada,
                s.usuarios_actuales as ocupacion, s.capacidad_maxima as capacidad
         from app.sala s where s.id_sala = $1`,
};

export function crearRepositorioModeracion(db: Database) {
  return {
    /**
     * Incidencias DLP (F35) agregadas por categoría, por día y por tipo de contenido, y las más
     * recientes. Por minimización no se incluye quién escribió ni, por diseño, el texto: nunca
     * se guardó.
     */
    async incidenciasDlp(dias: number) {
      const [resumen, recientes, porDia, porTipo] = await Promise.all([
        db.query<ResumenCategoria>(
          `select c.codigo as categoria, c.nombre, count(e.id_evento)::int as total
           from app.categoria_dlp c
           left join app.evento_dlp e
             on e.categoria = c.codigo and e.fecha >= now() - make_interval(days => $1)
           group by c.codigo, c.nombre, c.orden
           order by c.orden`,
          [dias],
        ),
        db.query<IncidenciaDlp>(
          `select e.fecha, e.categoria, c.nombre as "nombreCategoria",
                  e.tipo_contenido as "tipoContenido", r.codigo as regla, e.accion, e.resultado
           from app.evento_dlp e
           join app.categoria_dlp c on c.codigo = e.categoria
           left join app.regla_dlp r on r.id_regla = e.id_regla
           where e.fecha >= now() - make_interval(days => $1)
           order by e.fecha desc
           limit 50`,
          [dias],
        ),
        // Una fila por día del periodo (también los días sin eventos), en hora de Colombia.
        db.query<{ dia: string; total: number }>(
          `select to_char(d.dia, 'YYYY-MM-DD') as dia, count(e.id_evento)::int as total
           from generate_series(
                  (now() at time zone 'America/Bogota')::date - ($1::int - 1),
                  (now() at time zone 'America/Bogota')::date,
                  interval '1 day') as d(dia)
           left join app.evento_dlp e
             on (e.fecha at time zone 'America/Bogota')::date = d.dia::date
           group by d.dia
           order by d.dia`,
          [dias],
        ),
        db.query<{ tipoContenido: string; total: number }>(
          `select e.tipo_contenido as "tipoContenido", count(*)::int as total
           from app.evento_dlp e
           where e.fecha >= now() - make_interval(days => $1)
           group by e.tipo_contenido
           order by total desc`,
          [dias],
        ),
      ]);
      return {
        dias,
        resumen: resumen.rows,
        recientes: recientes.rows,
        porDia: porDia.rows,
        porTipo: porTipo.rows,
      };
    },

    /** Reportes por estado (F30): primero los pendientes, después en revisión, después cerrados. */
    async listarReportes(filtro: {
      estado?: EstadoReporte;
      limite: number;
      desplazamiento: number;
    }): Promise<ReporteResumen[]> {
      const { rows } = await db.query<ReporteResumen>(
        `${SELECT_REPORTE}
         where ($1::text is null or r.estado = $1)
         order by case r.estado when 'pendiente' then 0 when 'en_revision' then 1 else 2 end,
                  r.fecha_reporte desc, r.id_reporte
         limit $2 offset $3`,
        [filtro.estado ?? null, filtro.limite, filtro.desplazamiento],
      );
      return rows;
    },

    async conteoReportes(): Promise<Record<EstadoReporte, number>> {
      const { rows } = await db.query<{ estado: EstadoReporte; total: number }>(
        `select estado, count(*)::int as total from app.reporte group by estado`,
      );
      const conteo = { pendiente: 0, en_revision: 0, resuelto: 0, descartado: 0 };
      for (const fila of rows) conteo[fila.estado] = fila.total;
      return conteo;
    },

    async reporte(idReporte: string): Promise<ReporteDetalle | null> {
      const { rows } = await db.query<Omit<ReporteDetalle, 'contenido'> & { idContenido: string }>(
        `select x.*, r.descripcion, r.id_contenido as "idContenido", rv.alias as revisor,
                (select count(*)::int from app.reporte o
                 where o.tipo_contenido = r.tipo_contenido and o.id_contenido = r.id_contenido
                   and o.id_reporte <> r.id_reporte
                   and o.estado in ('pendiente', 'en_revision')) as "otrosAbiertos"
         from (${SELECT_REPORTE} where r.id_reporte = $1) x
         join app.reporte r on r.id_reporte = x.id
         left join app.usuario rv on rv.id_usuario = r.id_revisor`,
        [idReporte],
      );
      const fila = rows[0];
      if (!fila) return null;
      const { idContenido, ...reporte } = fila;
      const contenido = await db.query<ContenidoReportado>(CONTENIDO[fila.tipoContenido], [
        idContenido,
      ]);
      return { ...reporte, contenido: contenido.rows[0] ?? null };
    },

    /** Datos mínimos del reporte para decidir una acción. */
    async objetivo(idReporte: string) {
      const { rows } = await db.query<{
        estado: EstadoReporte;
        tipoContenido: TipoReportado;
        idContenido: string;
        idAutor: string | null;
      }>(
        `select r.estado, r.tipo_contenido as "tipoContenido", r.id_contenido as "idContenido",
                case r.tipo_contenido
                  when 'hilo' then (select id_usuario from app.hilo where id_hilo = r.id_contenido)
                  when 'respuesta' then (select id_usuario from app.respuesta
                                         where id_respuesta = r.id_contenido)
                  when 'perfil' then r.id_contenido
                end as "idAutor"
         from app.reporte r where r.id_reporte = $1`,
        [idReporte],
      );
      return rows[0] ?? null;
    },

    /**
     * Cambia el estado de un reporte solo si sigue en el estado leído (sin pisar a otro
     * moderador) y lo registra en la auditoría en la misma sentencia.
     */
    async cambiarEstadoReporte(cambio: {
      idReporte: string;
      anterior: EstadoReporte;
      nuevo: EstadoReporte;
      resolucion: Resolucion | null | undefined;
      actor: string;
    }): Promise<boolean> {
      const cierra = cambio.nuevo === 'resuelto' || cambio.nuevo === 'descartado';
      const { rows } = await db.query(
        `with cambio as (
           update app.reporte
           set estado = $2,
               resolucion = case when $4::boolean then $5 else resolucion end,
               id_revisor = $6::uuid,
               fecha_revision = case when $10::boolean then now() else null end
           where id_reporte = $1 and estado = $3
           returning id_reporte
         ), ${cteAuditoria('cambio', 'id_reporte::text', 6)}
         select 1 from cambio`,
        [
          cambio.idReporte,
          cambio.nuevo,
          cambio.anterior,
          cambio.resolucion !== undefined,
          cambio.resolucion ?? null,
          ...parametrosAuditoria({
            actor: cambio.actor,
            accion: 'cambiar_estado_reporte',
            entidad: 'reporte',
            detalle: {
              estadoAnterior: cambio.anterior,
              estadoNuevo: cambio.nuevo,
              ...(cambio.resolucion !== undefined && { resolucion: cambio.resolucion }),
            },
          }),
          cierra,
        ],
      );
      return rows.length > 0;
    },

    /**
     * Anota la resolución de un reporte tras una acción y, si estaba pendiente, lo pasa a
     * «En revisión»: la acción ya es una revisión en curso.
     */
    async anotarResolucion(idReporte: string, resolucion: Resolucion, actor: string) {
      await db.query(
        `update app.reporte
         set resolucion = $2, id_revisor = $3,
             estado = case when estado = 'pendiente' then 'en_revision' else estado end
         where id_reporte = $1`,
        [idReporte, resolucion, actor],
      );
    },

    /**
     * Oculta o restaura un hilo o una respuesta (acción administrativa permitida). Un hilo
     * oculto deja de mostrarse en la comunidad; la respuesta oculta, también.
     */
    async cambiarVisibilidad(cambio: {
      tipo: 'hilo' | 'respuesta';
      id: string;
      ocultar: boolean;
      actor: string;
      idReporte: string;
    }): Promise<boolean> {
      const tabla = cambio.tipo === 'hilo' ? 'app.hilo' : 'app.respuesta';
      const columna = cambio.tipo === 'hilo' ? 'id_hilo' : 'id_respuesta';
      // Un hilo cerrado también se puede ocultar; al restaurarlo vuelve a «activo».
      const [desde, hacia] = {
        hilo: cambio.ocultar ? [['activo', 'cerrado'], 'oculto'] : [['oculto'], 'activo'],
        respuesta: cambio.ocultar ? [['publicada'], 'oculta'] : [['oculta'], 'publicada'],
      }[cambio.tipo] as [string[], string];
      const { rows } = await db.query(
        `with cambio as (
           update ${tabla} set estado = $3
           where ${columna} = $1 and estado = any($2::text[])
           returning ${columna} as id
         ), ${cteAuditoria('cambio', 'id::text', 4)}
         select 1 from cambio`,
        [
          cambio.id,
          desde,
          hacia,
          ...parametrosAuditoria({
            actor: cambio.actor,
            accion: cambio.ocultar ? 'ocultar_contenido' : 'restaurar_contenido',
            entidad: cambio.tipo,
            detalle: { estadoNuevo: hacia, reporte: cambio.idReporte },
          }),
        ],
      );
      return rows.length > 0;
    },
  };
}

export type RepositorioModeracion = ReturnType<typeof crearRepositorioModeracion>;
