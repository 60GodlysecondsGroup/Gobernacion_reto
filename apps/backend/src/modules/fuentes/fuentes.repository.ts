import type { Database } from '../../db/database.js';
import type { EstadoFuente, FuenteCompleta } from './fuentes.esquemas.js';
import { ZONA_HORARIA } from './fuentes.esquemas.js';
import type { AccionBitacora, Cambios } from './fuentes.reglas.js';

export type NecesidadAsignada = { codigo: string; nombre: string };

/** Fuente tal como está en la base, con datos para gestión. */
export type FuenteRegistrada = Omit<FuenteCompleta, 'necesidades'> & {
  id: string;
  codigo: string;
  necesidades: NecesidadAsignada[];
  responsable: string | null;
  fechaActualizacion: string;
  diasDesdeVerificacion: number;
};

export type EntradaBitacora = {
  id: string;
  fecha: string;
  accion: AccionBitacora;
  estadoAnterior: EstadoFuente | null;
  estadoNuevo: EstadoFuente | null;
  observacion: string | null;
  cambios: Cambios;
  responsable: string | null;
};

export type NecesidadConConteo = {
  codigo: string;
  nombre: string;
  descripcion: string;
  servicios: number;
};

export type FiltroFuentes = {
  estados?: EstadoFuente[];
  necesidades?: string[];
  id?: string;
  codigo?: string;
};

const SELECT_FUENTE = `
  select f.id_fuente as id, f.codigo, f.institucion, f.nombre_servicio as servicio, f.descripcion,
         f.tipo_canal as "tipoCanal", f.telefono, f.enlace, f.horario,
         f.fuente_original as "fuenteOriginal",
         to_char(f.fecha_verificacion, 'YYYY-MM-DD') as "fechaVerificacion",
         ((now() at time zone '${ZONA_HORARIA}')::date - f.fecha_verificacion) as "diasDesdeVerificacion",
         f.estado, f.observaciones, f.es_demo as "esDemo", f.fecha_actualizacion as "fechaActualizacion",
         u.alias as responsable,
         coalesce((
           select json_agg(json_build_object('codigo', n.codigo, 'nombre', n.nombre) order by n.orden)
           from app.fuente_necesidad fn
           join app.necesidad_orientacion n on n.codigo = fn.codigo_necesidad
           where fn.id_fuente = f.id_fuente
         ), '[]'::json) as necesidades
  from app.fuente_institucional f
  left join app.usuario u on u.id_usuario = f.id_responsable`;

const columnasFuente = (fuente: FuenteCompleta) => [
  fuente.institucion,
  fuente.servicio,
  fuente.descripcion,
  fuente.tipoCanal,
  fuente.telefono,
  fuente.enlace,
  fuente.horario,
  fuente.fuenteOriginal,
  fuente.fechaVerificacion,
  fuente.estado,
  fuente.observaciones,
  fuente.esDemo,
];

export function crearRepositorioFuentes(db: Database) {
  return {
    async listar(filtro: FiltroFuentes = {}): Promise<FuenteRegistrada[]> {
      const { rows } = await db.query<FuenteRegistrada>(
        `${SELECT_FUENTE}
         where ($1::text[] is null or f.estado = any($1))
           and ($2::text[] is null or exists (
                 select 1 from app.fuente_necesidad x
                 where x.id_fuente = f.id_fuente and x.codigo_necesidad = any($2)))
           and ($3::uuid is null or f.id_fuente = $3)
           and ($4::text is null or f.codigo = $4)
         order by case f.estado when 'activo' then 0 when 'requiere_revision' then 1 else 2 end,
                  f.institucion, f.nombre_servicio`,
        [
          filtro.estados ?? null,
          filtro.necesidades ?? null,
          filtro.id ?? null,
          filtro.codigo ?? null,
        ],
      );
      return rows;
    },

    async resumenEstados(): Promise<Record<EstadoFuente, number>> {
      const { rows } = await db.query<{ estado: EstadoFuente; total: number }>(
        `select estado, count(*)::int as total from app.fuente_institucional group by estado`,
      );
      const resumen = { activo: 0, requiere_revision: 0, inactivo: 0 };
      for (const fila of rows) resumen[fila.estado] = fila.total;
      return resumen;
    },

    /** Necesidades con cuántos servicios visibles (activos o en revisión) tiene cada una. */
    async necesidades(): Promise<NecesidadConConteo[]> {
      const { rows } = await db.query<NecesidadConConteo>(`
        select n.codigo, n.nombre, n.descripcion,
               count(f.id_fuente) filter (where f.estado in ('activo', 'requiere_revision'))::int as servicios
        from app.necesidad_orientacion n
        left join app.fuente_necesidad fn on fn.codigo_necesidad = n.codigo
        left join app.fuente_institucional f on f.id_fuente = fn.id_fuente
        group by n.codigo, n.nombre, n.descripcion, n.orden
        order by n.orden`);
      return rows;
    },

    async bitacora(idFuente: string): Promise<EntradaBitacora[]> {
      const { rows } = await db.query<EntradaBitacora>(
        `select b.id_bitacora as id, b.fecha, b.accion, b.estado_anterior as "estadoAnterior",
                b.estado_nuevo as "estadoNuevo", b.observacion, b.cambios, u.alias as responsable
         from app.bitacora_fuente b
         left join app.usuario u on u.id_usuario = b.id_usuario_responsable
         where b.id_fuente = $1
         order by b.fecha desc`,
        [idFuente],
      );
      return rows;
    },

    /** Crea la fuente, sus necesidades y la entrada «crear» de la bitácora en una sola sentencia. */
    async crear(
      fuente: FuenteCompleta & { codigo: string },
      registro: { responsable: string | null; observacion: string | null },
    ): Promise<string> {
      const { rows } = await db.query<{ id: string }>(
        `with nueva as (
           insert into app.fuente_institucional (
             institucion, nombre_servicio, descripcion, tipo_canal, telefono, enlace, horario,
             fuente_original, fecha_verificacion, estado, observaciones, es_demo, codigo, id_responsable)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           returning id_fuente, estado
         ), necesidades as (
           insert into app.fuente_necesidad (id_fuente, codigo_necesidad)
           select id_fuente, unnest($15::text[]) from nueva
         ), registro as (
           insert into app.bitacora_fuente (id_fuente, id_usuario_responsable, accion, estado_nuevo, observacion)
           select id_fuente, $14, 'crear', estado, $16 from nueva
         )
         select id_fuente as id from nueva`,
        [
          ...columnasFuente(fuente),
          fuente.codigo,
          registro.responsable,
          fuente.necesidades,
          registro.observacion,
        ],
      );
      return rows[0]!.id;
    },

    /**
     * Guarda la versión completa de una fuente y su entrada de bitácora, atómicamente.
     * Solo actúa si la fuente sigue en `estadoEsperado` (evita pisar un cambio simultáneo).
     */
    async guardar(
      idFuente: string,
      fuente: FuenteCompleta,
      registro: {
        accion: AccionBitacora;
        responsable: string | null;
        observacion: string | null;
        cambios: Cambios;
        estadoEsperado: EstadoFuente;
      },
    ): Promise<boolean> {
      const { rows } = await db.query<{ filas: number }>(
        `with actual as (
           select id_fuente, estado from app.fuente_institucional
           where id_fuente = $13 and estado = $14
           for update
         ), editada as (
           update app.fuente_institucional f
           set institucion = $1, nombre_servicio = $2, descripcion = $3, tipo_canal = $4,
               telefono = $5, enlace = $6, horario = $7, fuente_original = $8,
               fecha_verificacion = $9, estado = $10, observaciones = $11, es_demo = $12,
               id_responsable = coalesce($15, f.id_responsable)
           from actual
           where f.id_fuente = actual.id_fuente
           returning f.id_fuente, actual.estado as estado_anterior, f.estado as estado_nuevo
         ), quitar as (
           delete from app.fuente_necesidad n using editada
           where n.id_fuente = editada.id_fuente and n.codigo_necesidad <> all($16::text[])
         ), agregar as (
           insert into app.fuente_necesidad (id_fuente, codigo_necesidad)
           select id_fuente, unnest($16::text[]) from editada
           on conflict do nothing
         ), registro as (
           insert into app.bitacora_fuente
             (id_fuente, id_usuario_responsable, accion, estado_anterior, estado_nuevo, observacion, cambios)
           select id_fuente, $15, $17, estado_anterior, estado_nuevo, $18, $19::jsonb from editada
         )
         select count(*)::int as filas from editada`,
        [
          ...columnasFuente(fuente),
          idFuente,
          registro.estadoEsperado,
          registro.responsable,
          fuente.necesidades,
          registro.accion,
          registro.observacion,
          JSON.stringify(registro.cambios),
        ],
      );
      return rows[0]!.filas === 1;
    },
  };
}

export type RepositorioFuentes = ReturnType<typeof crearRepositorioFuentes>;

/** Convierte la fila registrada a la forma editable (necesidades como códigos). */
export const aCompleta = (fuente: FuenteRegistrada): FuenteCompleta => ({
  institucion: fuente.institucion,
  servicio: fuente.servicio,
  descripcion: fuente.descripcion,
  tipoCanal: fuente.tipoCanal,
  telefono: fuente.telefono,
  enlace: fuente.enlace,
  horario: fuente.horario,
  fuenteOriginal: fuente.fuenteOriginal,
  necesidades: fuente.necesidades.map(
    (necesidad) => necesidad.codigo,
  ) as FuenteCompleta['necesidades'],
  observaciones: fuente.observaciones,
  esDemo: fuente.esDemo,
  estado: fuente.estado,
  fechaVerificacion: fuente.fechaVerificacion,
});
