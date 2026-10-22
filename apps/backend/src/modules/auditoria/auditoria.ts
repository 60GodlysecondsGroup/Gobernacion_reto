import type { Database } from '../../db/database.js';

/**
 * Registro mínimo de acciones administrativas (Fase 7, punto 7): quién, qué, sobre qué y cuándo.
 * `app.registro_auditoria` es de solo inserción (un disparador impide modificarlo o borrarlo).
 * El detalle nunca lleva contenido escrito por usuarios: solo estados y valores de configuración.
 * El mecanismo de auditoría definitivo sigue pendiente (DECISIONES.md).
 */

export const ENTIDADES_AUDITORIA = [
  'reporte',
  'hilo',
  'respuesta',
  'usuario',
  'sala',
  'escenario',
  'categoria',
  'comunidad',
  'regla_dlp',
] as const;
export type EntidadAuditoria = (typeof ENTIDADES_AUDITORIA)[number];

export type EntradaAuditoria = {
  actor: string;
  accion: string;
  entidad: EntidadAuditoria;
  idEntidad: string | null;
  detalle?: Record<string, unknown>;
};

export type RegistroAuditoria = {
  id: number;
  fecha: string;
  accion: string;
  entidad: string;
  idEntidad: string | null;
  detalle: Record<string, unknown>;
  actor: { id: string | null; alias: string | null; rol: string | null };
};

/**
 * Fragmento de CTE que inserta el registro solo si la sentencia principal cambió algo.
 * Se usa dentro de un `with cambio as (update … returning …)`: acción y registro van en la
 * misma sentencia SQL, así que no puede quedar una acción sin su registro ni al revés.
 *
 *   with cambio as (...), ${cteAuditoria('cambio', 'id_entidad::text', 5)} select * from cambio
 *
 * Usa los parámetros $n (actor), $n+1 (acción), $n+2 (entidad) y $n+3 (detalle jsonb).
 */
export function cteAuditoria(origen: string, columnaId: string, n: number): string {
  return `registro as (
    insert into app.registro_auditoria (id_usuario_actor, accion, entidad, id_entidad, detalle)
    select $${n}::uuid, $${n + 1}, $${n + 2}, ${columnaId}, $${n + 3}::jsonb from ${origen}
  )`;
}

/** Los cuatro parámetros que espera `cteAuditoria`, en orden. */
export const parametrosAuditoria = (entrada: Omit<EntradaAuditoria, 'idEntidad'>) => [
  entrada.actor,
  entrada.accion,
  entrada.entidad,
  JSON.stringify(entrada.detalle ?? {}),
];

export function crearRepositorioAuditoria(db: Database) {
  return {
    /** Registro aislado, para acciones que no cambian una sola fila. */
    async registrar(entrada: EntradaAuditoria): Promise<void> {
      await db.query(
        `insert into app.registro_auditoria (id_usuario_actor, accion, entidad, id_entidad, detalle)
         values ($1, $2, $3, $4, $5::jsonb)`,
        [
          entrada.actor,
          entrada.accion,
          entrada.entidad,
          entrada.idEntidad,
          JSON.stringify(entrada.detalle ?? {}),
        ],
      );
    },

    async listar(filtro: {
      entidades: readonly string[];
      entidad?: string;
      limite: number;
      desplazamiento: number;
    }): Promise<RegistroAuditoria[]> {
      const { rows } = await db.query<RegistroAuditoria>(
        `select r.id_registro::int as id, r.fecha, r.accion, r.entidad, r.id_entidad as "idEntidad",
                r.detalle,
                json_build_object('id', u.id_usuario, 'alias', u.alias, 'rol', u.rol) as actor
         from app.registro_auditoria r
         left join app.usuario u on u.id_usuario = r.id_usuario_actor
         where r.entidad = any($1::text[]) and ($2::text is null or r.entidad = $2)
         order by r.fecha desc, r.id_registro desc
         limit $3 offset $4`,
        [filtro.entidades, filtro.entidad ?? null, filtro.limite, filtro.desplazamiento],
      );
      return rows;
    },
  };
}

export type RepositorioAuditoria = ReturnType<typeof crearRepositorioAuditoria>;
