import type { Database } from './database.js';

/**
 * Cuentas sintéticas de prueba que crea `db/seed/usuarios_prueba.sql`. Deben coincidir con ese
 * archivo. La cuenta de administración (Admin_001) NO está aquí: se conserva siempre.
 */
export const CODIGOS_USUARIOS_PRUEBA = [
  'Usuario_001',
  'Usuario_002',
  'Usuario_003',
  'Usuario_004',
  'Usuario_005',
  'Moderador_001',
  'Gestor_001',
] as const;

/**
 * Una cuenta es de prueba solo si cumple TODO:
 *  - su código es uno de CODIGOS_USUARIOS_PRUEBA o `Simulado_NNN` (npm run salas:simular);
 *  - no tiene contraseña (nunca se registró ni se le definió una: no es de una persona);
 *  - no es de administración ni de superadministración de la plataforma.
 * No se decide por el alias ni por la apariencia.
 */
const CONDICION_PRUEBA = `
  (u.codigo = any($1::text[]) or u.codigo ~ '^Simulado_[0-9]{3}$')
  and not exists (select 1 from app.credencial c where c.id_usuario = u.id_usuario)
  and u.rol not in ('admin_plataforma', 'superadmin')`;

export type CuentaDePrueba = {
  id: string;
  codigo: string;
  alias: string;
  rol: string;
  rango: string | null;
  estado: string;
  hilos: number;
  respuestas: number;
  /** Respuestas de OTRAS cuentas dentro de los hilos de esta (se borran con el hilo). */
  respuestasAjenasEnSusHilos: number;
  reportesHechos: number;
  reportesSobreSuContenido: number;
  participaciones: number;
  eventosDlp: number;
  /** Motivo por el que no se puede borrar sin perder trazabilidad, o null. */
  bloqueo: string | null;
};

export type CuentaConservada = {
  codigo: string;
  alias: string;
  rol: string;
  estado: string;
  tieneContrasena: boolean;
  tieneAvatar: boolean;
};

export type InventarioUsuariosPrueba = {
  candidatas: CuentaDePrueba[];
  administracion: CuentaConservada[];
  /** Cuentas que no son de prueba ni de administración (p. ej. registradas): no se tocan. */
  otrasCuentas: number;
};

const SQL_CANDIDATAS = `
  with prueba as (select u.* from app.usuario u where ${CONDICION_PRUEBA}),
  sus_hilos as (select h.id_hilo, h.id_usuario from app.hilo h join prueba p using (id_usuario)),
  sus_respuestas as (
    select r.id_respuesta, r.id_usuario from app.respuesta r join prueba p using (id_usuario)
  )
  select p.id_usuario as id, p.codigo, p.alias, p.rol, p.rango_edad as rango, p.estado,
    (select count(*) from sus_hilos h where h.id_usuario = p.id_usuario)::int as hilos,
    (select count(*) from sus_respuestas r where r.id_usuario = p.id_usuario)::int as respuestas,
    (select count(*) from app.respuesta r join sus_hilos h using (id_hilo)
      where h.id_usuario = p.id_usuario and r.id_usuario not in (select id_usuario from prueba)
    )::int as "respuestasAjenasEnSusHilos",
    (select count(*) from app.reporte r where r.id_usuario_reportante = p.id_usuario)::int
      as "reportesHechos",
    (select count(*) from app.reporte r
      where (r.tipo_contenido = 'perfil' and r.id_contenido = p.id_usuario)
         or (r.tipo_contenido = 'hilo' and r.id_contenido in
               (select id_hilo from sus_hilos h where h.id_usuario = p.id_usuario))
         or (r.tipo_contenido = 'respuesta' and r.id_contenido in
               (select id_respuesta from sus_respuestas x where x.id_usuario = p.id_usuario))
    )::int as "reportesSobreSuContenido",
    (select count(*) from app.participacion_sala s where s.id_usuario = p.id_usuario)::int
      as participaciones,
    (select count(*) from app.evento_dlp e where e.id_usuario = p.id_usuario)::int as "eventosDlp",
    case
      when exists (select 1 from app.registro_auditoria a where a.id_usuario_actor = p.id_usuario)
        then 'Figura como autora en el registro de auditoría (solo inserción).'
      when exists (select 1 from app.bitacora_fuente b where b.id_usuario_responsable = p.id_usuario)
        then 'Figura como responsable en la bitácora de fuentes (solo inserción).'
      when exists (select 1 from app.participacion_sala s
                   where s.id_usuario = p.id_usuario and s.hora_salida is null)
        then 'Está dentro de una sala en este momento.'
    end as bloqueo
  from prueba p
  order by p.codigo`;

/** Qué se borraría y qué se conserva. Solo lee. */
export async function inventariarUsuariosPrueba(db: Database): Promise<InventarioUsuariosPrueba> {
  const codigos = [...CODIGOS_USUARIOS_PRUEBA];
  const candidatas = await db.query<CuentaDePrueba>(SQL_CANDIDATAS, [codigos]);
  const administracion = await db.query<CuentaConservada>(
    `select u.codigo, u.alias, u.rol, u.estado,
            exists (select 1 from app.credencial c where c.id_usuario = u.id_usuario)
              as "tieneContrasena",
            exists (select 1 from app.configuracion_avatar a where a.id_usuario = u.id_usuario)
              as "tieneAvatar"
     from app.usuario u where u.rol in ('admin_plataforma', 'superadmin') order by u.codigo`,
  );
  const otras = await db.query<{ total: number }>(
    `select count(*)::int as total from app.usuario u
     where u.rol not in ('admin_plataforma', 'superadmin') and not (${CONDICION_PRUEBA})`,
    [codigos],
  );
  return {
    candidatas: candidatas.rows,
    administracion: administracion.rows,
    otrasCuentas: otras.rows[0]?.total ?? 0,
  };
}

export type ResultadoLimpieza = {
  cuentas: number;
  hilos: number;
  respuestas: number;
  reportes: number;
  participaciones: number;
  /** Eventos DLP conservados como estadística, ahora sin autor. */
  eventosDlpAnonimizados: number;
};

/**
 * Borra las cuentas de prueba sin bloqueo y lo que depende de ellas. Debe ejecutarse dentro de
 * una transacción (el script la abre): todo o nada. Vuelve a aplicar los criterios aquí mismo, así
 * que nunca borra una cuenta con contraseña ni de administración.
 *
 * Se borran: sus hilos (con las respuestas que tengan), sus respuestas, los reportes que hizo o
 * que apuntan a su contenido, y sus participaciones cerradas en salas. Su avatar, credencial,
 * sesiones y posición en salas caen con la cuenta. Los eventos DLP se conservan sin autor.
 */
export async function eliminarUsuariosPrueba(db: Database): Promise<ResultadoLimpieza> {
  const codigos = [...CODIGOS_USUARIOS_PRUEBA];
  const { rows } = await db.query<ResultadoLimpieza>(
    `with prueba as (select u.id_usuario from app.usuario u where ${CONDICION_PRUEBA}
       and not exists (select 1 from app.registro_auditoria a where a.id_usuario_actor = u.id_usuario)
       and not exists (select 1 from app.bitacora_fuente b where b.id_usuario_responsable = u.id_usuario)
       and not exists (select 1 from app.participacion_sala s
                       where s.id_usuario = u.id_usuario and s.hora_salida is null)
     ),
     sus_hilos as (select id_hilo from app.hilo where id_usuario in (select id_usuario from prueba)),
     respuestas_afectadas as (
       select id_respuesta from app.respuesta
       where id_usuario in (select id_usuario from prueba) or id_hilo in (select id_hilo from sus_hilos)
     ),
     reportes as (
       delete from app.reporte r
       where r.id_usuario_reportante in (select id_usuario from prueba)
          or (r.tipo_contenido = 'perfil' and r.id_contenido in (select id_usuario from prueba))
          or (r.tipo_contenido = 'hilo' and r.id_contenido in (select id_hilo from sus_hilos))
          or (r.tipo_contenido = 'respuesta'
              and r.id_contenido in (select id_respuesta from respuestas_afectadas))
       returning 1
     ),
     revisor as (
       update app.reporte set id_revisor = null
       where id_revisor in (select id_usuario from prueba) returning 1
     ),
     respuestas as (
       delete from app.respuesta
       where id_respuesta in (select id_respuesta from respuestas_afectadas) returning 1
     ),
     dlp as (
       update app.evento_dlp set id_usuario = null
       where id_usuario in (select id_usuario from prueba) returning 1
     ),
     fuentes as (
       update app.fuente_institucional set id_responsable = null
       where id_responsable in (select id_usuario from prueba) returning 1
     ),
     participaciones as (
       delete from app.participacion_sala
       where id_usuario in (select id_usuario from prueba) returning 1
     )
     select (select count(*) from prueba)::int as cuentas,
            (select count(*) from sus_hilos)::int as hilos,
            (select count(*) from respuestas)::int as respuestas,
            (select count(*) from reportes)::int as reportes,
            (select count(*) from participaciones)::int as participaciones,
            (select count(*) from dlp)::int as "eventosDlpAnonimizados"`,
    [codigos],
  );
  // Hilos y cuentas se borran después: sus filas dependientes ya no existen.
  await db.query(
    `delete from app.hilo h using app.usuario u
     where h.id_usuario = u.id_usuario and ${CONDICION_PRUEBA}
       and not exists (select 1 from app.registro_auditoria a where a.id_usuario_actor = u.id_usuario)
       and not exists (select 1 from app.bitacora_fuente b where b.id_usuario_responsable = u.id_usuario)
       and not exists (select 1 from app.participacion_sala s
                       where s.id_usuario = u.id_usuario and s.hora_salida is null)`,
    [codigos],
  );
  await db.query(
    `delete from app.usuario u
     where ${CONDICION_PRUEBA}
       and not exists (select 1 from app.registro_auditoria a where a.id_usuario_actor = u.id_usuario)
       and not exists (select 1 from app.bitacora_fuente b where b.id_usuario_responsable = u.id_usuario)
       and not exists (select 1 from app.participacion_sala s where s.id_usuario = u.id_usuario)`,
    [codigos],
  );
  return rows[0]!;
}
