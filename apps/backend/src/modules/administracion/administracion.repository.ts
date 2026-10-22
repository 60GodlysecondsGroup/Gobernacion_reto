import type { Database } from '../../db/database.js';
import { cteAuditoria, parametrosAuditoria } from '../auditoria/auditoria.js';
import type { Rol } from '../seguridad/permisos.js';
import { leerObstaculos, type Obstaculo, type Posicion } from '../salas/salas.escenario.js';

export const ESTADOS_USUARIO = ['activo', 'suspendido', 'bloqueado'] as const;
export type EstadoUsuario = (typeof ESTADOS_USUARIO)[number];

/**
 * Lo que la administración ve de una persona (F26, datos mínimos): alias, rol, comunidad,
 * estado e indicadores de moderación. Nunca edad, intereses, código de acceso ni contenido.
 */
export type UsuarioAdministrado = {
  id: string;
  alias: string;
  rol: Rol;
  comunidad: string | null;
  estado: EstadoUsuario;
  fechaRegistro: string;
  /** Reportes abiertos sobre su perfil o sus hilos y respuestas. */
  reportesAbiertos: number;
  /** Bloqueos del DLP en los últimos 30 días. */
  bloqueosDlp30d: number;
};

export type ComunidadAdministrada = {
  id: string;
  codigoRango: string;
  rango: string;
  nombre: string;
  descripcion: string;
  estado: 'activa' | 'inactiva';
  jovenes: number;
  hilos: number;
  salasAbiertas: number;
};

export type CategoriaAdministrada = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  orden: number;
  estado: 'activa' | 'inactiva';
  hilos: number;
  salasAbiertas: number;
};

export type SalaAdministrada = {
  id: string;
  nombre: string;
  descripcion: string;
  reglas: string;
  comunidad: { id: string; nombre: string; rango: string };
  categoria: { codigo: string; nombre: string };
  capacidad: number;
  ocupacion: number;
  estado: string;
  habilitada: boolean;
  escenario: { ancho: number; alto: number; obstaculos: Obstaculo[]; aparicion: Posicion };
};

export type ReglaDlpAdministrada = {
  id: string;
  codigo: string;
  descripcion: string;
  patron: string;
  accion: string;
  estado: 'activa' | 'inactiva';
  bloqueos30d: number;
};

export type CategoriaDlpAdministrada = {
  codigo: string;
  nombre: string;
  descripcion: string;
  reglas: ReglaDlpAdministrada[];
};

const SELECT_SALA = `
  select s.id_sala as id, s.nombre, s.descripcion, s.reglas,
         json_build_object('id', c.id_comunidad, 'nombre', c.nombre, 'rango', c.rango_edad) as comunidad,
         json_build_object('codigo', cat.codigo, 'nombre', cat.nombre) as categoria,
         s.capacidad_maxima as capacidad, s.usuarios_actuales as ocupacion, s.estado, s.habilitada,
         json_build_object('ancho', e.ancho, 'alto', e.alto, 'obstaculos', e.obstaculos,
                           'aparicion', json_build_object('x', e.aparicion_x, 'y', e.aparicion_y))
           as escenario
  from app.sala s
  join app.comunidad c on c.id_comunidad = s.id_comunidad
  join app.categoria cat on cat.id_categoria = s.id_categoria
  join app.escenario_sala e on e.id_sala = s.id_sala`;

const normalizarSala = (sala: SalaAdministrada): SalaAdministrada => ({
  ...sala,
  escenario: {
    ...sala.escenario,
    obstaculos: leerObstaculos(
      sala.escenario.obstaculos,
      sala.escenario.ancho,
      sala.escenario.alto,
    ),
  },
});

/**
 * Administración (F26–F29, F31). Cada cambio va en una sola sentencia con su registro de
 * auditoría (`cteAuditoria`): no hay acción administrativa sin registro.
 */
export function crearRepositorioAdministracion(db: Database) {
  return {
    async resumen() {
      const { rows } = await db.query<{
        usuarios: Record<string, number>;
        reportes: Record<string, number>;
        salas: { abiertas: number; deshabilitadas: number; personas: number };
        reglas: { activas: number; total: number };
        fuentes: Record<string, number>;
        dlp7d: number;
        contenidoOculto: number;
      }>(
        `select
           (select coalesce(json_object_agg(estado, total), '{}')
            from (select estado, count(*)::int total from app.usuario
                  where rol = 'usuario' group by estado) t) as usuarios,
           (select coalesce(json_object_agg(estado, total), '{}')
            from (select estado, count(*)::int total from app.reporte group by estado) t) as reportes,
           (select json_build_object(
              'abiertas', count(*) filter (where estado <> 'cerrada')::int,
              'deshabilitadas', count(*) filter (where estado <> 'cerrada' and not habilitada)::int,
              'personas', coalesce(sum(usuarios_actuales) filter (where estado <> 'cerrada'), 0)::int)
            from app.sala) as salas,
           (select json_build_object('activas', count(*) filter (where estado = 'activa')::int,
                                     'total', count(*)::int)
            from app.regla_dlp) as reglas,
           (select coalesce(json_object_agg(estado, total), '{}')
            from (select estado, count(*)::int total from app.fuente_institucional group by estado) t)
             as fuentes,
           (select count(*)::int from app.evento_dlp where fecha >= now() - interval '7 days') as "dlp7d",
           ((select count(*) from app.hilo where estado = 'oculto')
             + (select count(*) from app.respuesta where estado = 'oculta'))::int as "contenidoOculto"`,
      );
      return rows[0]!;
    },

    // ── Usuarios (F26) ─────────────────────────────────────────────────────────

    async listarUsuarios(filtro: {
      buscar?: string;
      rol?: Rol;
      estado?: EstadoUsuario;
      limite: number;
      desplazamiento: number;
    }): Promise<UsuarioAdministrado[]> {
      const patron = filtro.buscar ? `%${filtro.buscar.replace(/[\\%_]/g, '\\$&')}%` : null;
      const { rows } = await db.query<UsuarioAdministrado>(
        `select u.id_usuario as id, u.alias, u.rol, c.nombre as comunidad, u.estado,
                u.fecha_registro as "fechaRegistro",
                (select count(*)::int from app.reporte r
                 where r.estado in ('pendiente', 'en_revision')
                   and ((r.tipo_contenido = 'perfil' and r.id_contenido = u.id_usuario)
                     or (r.tipo_contenido = 'hilo' and r.id_contenido in
                           (select id_hilo from app.hilo where id_usuario = u.id_usuario))
                     or (r.tipo_contenido = 'respuesta' and r.id_contenido in
                           (select id_respuesta from app.respuesta where id_usuario = u.id_usuario))))
                  as "reportesAbiertos",
                (select count(*)::int from app.evento_dlp e
                 where e.id_usuario = u.id_usuario and e.resultado = 'bloqueado'
                   and e.fecha >= now() - interval '30 days') as "bloqueosDlp30d"
         from app.usuario u
         left join app.comunidad c on c.rango_edad = u.rango_edad
         where u.codigo not like 'Simulado\\_%'
           and ($1::text is null or u.alias ilike $1)
           and ($2::text is null or u.rol = $2)
           and ($3::text is null or u.estado = $3)
         order by u.rol = 'usuario' desc, u.rango_edad nulls last, lower(u.alias)
         limit $4 offset $5`,
        [patron, filtro.rol ?? null, filtro.estado ?? null, filtro.limite, filtro.desplazamiento],
      );
      return rows;
    },

    async usuario(idUsuario: string) {
      const { rows } = await db.query<{ id: string; rol: Rol; estado: EstadoUsuario }>(
        'select id_usuario as id, rol, estado from app.usuario where id_usuario = $1',
        [idUsuario],
      );
      return rows[0] ?? null;
    },

    /** Medida administrativa sobre una cuenta (suspender, bloquear, reactivar), con su registro. */
    async cambiarEstadoUsuario(cambio: {
      idUsuario: string;
      anterior: EstadoUsuario;
      nuevo: EstadoUsuario;
      actor: string;
      idReporte?: string;
    }): Promise<boolean> {
      const { rows } = await db.query(
        `with cambio as (
           update app.usuario set estado = $2
           where id_usuario = $1 and estado = $3
           returning id_usuario
         ), ${cteAuditoria('cambio', 'id_usuario::text', 4)}
         select 1 from cambio`,
        [
          cambio.idUsuario,
          cambio.nuevo,
          cambio.anterior,
          ...parametrosAuditoria({
            actor: cambio.actor,
            accion: 'cambiar_estado_usuario',
            entidad: 'usuario',
            detalle: {
              estadoAnterior: cambio.anterior,
              estadoNuevo: cambio.nuevo,
              ...(cambio.idReporte && { reporte: cambio.idReporte }),
            },
          }),
        ],
      );
      return rows.length > 0;
    },

    // ── Comunidades (F27) ──────────────────────────────────────────────────────

    async listarComunidades(): Promise<ComunidadAdministrada[]> {
      const { rows } = await db.query<ComunidadAdministrada>(
        `select c.id_comunidad as id, c.rango_edad as "codigoRango", r.etiqueta as rango, c.nombre,
                c.descripcion, c.estado,
                (select count(*)::int from app.usuario u
                 where u.rango_edad = c.rango_edad and u.rol = 'usuario') as jovenes,
                (select count(*)::int from app.hilo h
                 where h.id_comunidad = c.id_comunidad and h.estado <> 'oculto') as hilos,
                (select count(*)::int from app.sala s
                 where s.id_comunidad = c.id_comunidad and s.estado <> 'cerrada') as "salasAbiertas"
         from app.comunidad c
         join app.rango_edad r on r.codigo = c.rango_edad
         order by c.rango_edad`,
      );
      return rows;
    },

    /**
     * Edita nombre, descripción o estado de una comunidad. El rango de edad NO se puede cambiar:
     * no existe ninguna función para eliminar o mover las restricciones de edad (Fase 7, punto 6).
     */
    async actualizarComunidad(cambio: {
      id: string;
      datos: { nombre?: string; descripcion?: string; estado?: 'activa' | 'inactiva' };
      actor: string;
    }): Promise<boolean> {
      const { nombre, descripcion, estado } = cambio.datos;
      const { rows } = await db.query(
        `with cambio as (
           update app.comunidad c
           set nombre = coalesce($2, c.nombre), descripcion = coalesce($3, c.descripcion),
               estado = coalesce($4, c.estado)
           where c.id_comunidad = $1
           returning c.id_comunidad
         ), ${cteAuditoria('cambio', 'id_comunidad::text', 5)}
         select 1 from cambio`,
        [
          cambio.id,
          nombre ?? null,
          descripcion ?? null,
          estado ?? null,
          ...parametrosAuditoria({
            actor: cambio.actor,
            accion: 'actualizar_comunidad',
            entidad: 'comunidad',
            detalle: { campos: Object.keys(cambio.datos), ...(estado && { estadoNuevo: estado }) },
          }),
        ],
      );
      return rows.length > 0;
    },

    // ── Categorías (F28) ───────────────────────────────────────────────────────

    async listarCategorias(): Promise<CategoriaAdministrada[]> {
      const { rows } = await db.query<CategoriaAdministrada>(
        `select cat.id_categoria as id, cat.codigo, cat.nombre, cat.descripcion, cat.orden, cat.estado,
                (select count(*)::int from app.hilo h
                 where h.id_categoria = cat.id_categoria and h.estado <> 'oculto') as hilos,
                (select count(*)::int from app.sala s
                 where s.id_categoria = cat.id_categoria and s.estado <> 'cerrada') as "salasAbiertas"
         from app.categoria cat
         order by cat.orden, cat.nombre`,
      );
      return rows;
    },

    async crearCategoria(datos: {
      codigo: string;
      nombre: string;
      descripcion: string;
      actor: string;
    }): Promise<string | null> {
      const { rows } = await db.query<{ id: string }>(
        `with nueva as (
           insert into app.categoria (codigo, nombre, descripcion, orden)
           values ($1, $2, $3, (select coalesce(max(orden), 0) + 1 from app.categoria))
           on conflict do nothing
           returning id_categoria
         ), ${cteAuditoria('nueva', 'id_categoria::text', 4)}
         select id_categoria as id from nueva`,
        [
          datos.codigo,
          datos.nombre,
          datos.descripcion,
          ...parametrosAuditoria({
            actor: datos.actor,
            accion: 'crear_categoria',
            entidad: 'categoria',
            detalle: { codigo: datos.codigo },
          }),
        ],
      );
      return rows[0]?.id ?? null;
    },

    async actualizarCategoria(cambio: {
      id: string;
      datos: { nombre?: string; descripcion?: string; estado?: 'activa' | 'inactiva' };
      actor: string;
    }): Promise<boolean> {
      const { nombre, descripcion, estado } = cambio.datos;
      const { rows } = await db.query(
        `with cambio as (
           update app.categoria c
           set nombre = coalesce($2, c.nombre), descripcion = coalesce($3, c.descripcion),
               estado = coalesce($4, c.estado)
           where c.id_categoria = $1
           returning c.id_categoria
         ), ${cteAuditoria('cambio', 'id_categoria::text', 5)}
         select 1 from cambio`,
        [
          cambio.id,
          nombre ?? null,
          descripcion ?? null,
          estado ?? null,
          ...parametrosAuditoria({
            actor: cambio.actor,
            accion: 'actualizar_categoria',
            entidad: 'categoria',
            detalle: { campos: Object.keys(cambio.datos), ...(estado && { estadoNuevo: estado }) },
          }),
        ],
      );
      return rows.length > 0;
    },

    // ── Salas (F29) ────────────────────────────────────────────────────────────

    /** Instancias abiertas (no cerradas) de todas las comunidades, o de una. */
    async listarSalas(rango?: string): Promise<SalaAdministrada[]> {
      const { rows } = await db.query<SalaAdministrada>(
        `${SELECT_SALA}
         where s.estado <> 'cerrada' and ($1::text is null or c.rango_edad = $1)
         order by c.rango_edad, cat.orden, s.nombre`,
        [rango ?? null],
      );
      return rows.map(normalizarSala);
    },

    async sala(idSala: string): Promise<SalaAdministrada | null> {
      const { rows } = await db.query<SalaAdministrada>(`${SELECT_SALA} where s.id_sala = $1`, [
        idSala,
      ]);
      return rows[0] ? normalizarSala(rows[0]) : null;
    },

    async actualizarSala(cambio: {
      id: string;
      datos: { habilitada?: boolean; capacidad?: number; descripcion?: string; reglas?: string };
      actor: string;
    }): Promise<'ok' | 'no_encontrada' | 'capacidad_menor_que_ocupacion'> {
      const { habilitada, capacidad, descripcion, reglas } = cambio.datos;
      const { rows } = await db.query<{ id: string }>(
        `with cambio as (
           update app.sala s
           set habilitada = coalesce($2, s.habilitada),
               capacidad_maxima = coalesce($3, s.capacidad_maxima),
               descripcion = coalesce($4, s.descripcion),
               reglas = coalesce($5, s.reglas),
               estado = case
                 when s.estado = 'cerrada' then s.estado
                 when s.usuarios_actuales = 0 then s.estado
                 when s.usuarios_actuales >= coalesce($3, s.capacidad_maxima) then 'llena'
                 else 'disponible' end
           where s.id_sala = $1 and s.estado <> 'cerrada'
             and s.usuarios_actuales <= coalesce($3, s.capacidad_maxima)
           returning s.id_sala
         ), ${cteAuditoria('cambio', 'id_sala::text', 6)}
         select id_sala as id from cambio`,
        [
          cambio.id,
          habilitada ?? null,
          capacidad ?? null,
          descripcion ?? null,
          reglas ?? null,
          ...parametrosAuditoria({
            actor: cambio.actor,
            accion: 'actualizar_sala',
            entidad: 'sala',
            detalle: {
              campos: Object.keys(cambio.datos),
              ...(habilitada !== undefined && { habilitada }),
              ...(capacidad !== undefined && { capacidad }),
            },
          }),
        ],
      );
      if (rows[0]) return 'ok';
      const existe = await db.query<{ ocupacion: number }>(
        `select usuarios_actuales as ocupacion from app.sala
         where id_sala = $1 and estado <> 'cerrada'`,
        [cambio.id],
      );
      return existe.rows[0] ? 'capacidad_menor_que_ocupacion' : 'no_encontrada';
    },

    /** Configuración del escenario: área jugable fija, obstáculos y punto de aparición. */
    async actualizarEscenario(cambio: {
      idSala: string;
      obstaculos: Obstaculo[];
      aparicion: Posicion;
      actor: string;
    }): Promise<boolean> {
      const { rows } = await db.query(
        `with cambio as (
           update app.escenario_sala e
           set obstaculos = $2::jsonb, aparicion_x = $3, aparicion_y = $4
           from app.sala s
           where e.id_sala = $1 and s.id_sala = e.id_sala and s.estado <> 'cerrada'
             and s.usuarios_actuales = 0
           returning e.id_sala
         ), ${cteAuditoria('cambio', 'id_sala::text', 5)}
         select 1 from cambio`,
        [
          cambio.idSala,
          JSON.stringify(cambio.obstaculos),
          cambio.aparicion.x,
          cambio.aparicion.y,
          ...parametrosAuditoria({
            actor: cambio.actor,
            accion: 'actualizar_escenario',
            entidad: 'escenario',
            detalle: { obstaculos: cambio.obstaculos.length, aparicion: cambio.aparicion },
          }),
        ],
      );
      return rows.length > 0;
    },

    /**
     * Habilita la sala temática de una categoría en una comunidad (F10, F29). El nombre es el de
     * la categoría: no hay salas con nombres libres (14.1). Si ya hay una abierta, no crea otra.
     */
    async crearSala(datos: {
      rango: string;
      codigoCategoria: string;
      descripcion: string;
      reglas: string;
      actor: string;
    }): Promise<{ id: string } | 'ya_existe' | 'no_encontrada'> {
      const { rows } = await db.query<{ id: string }>(
        `with base as (
           select c.id_comunidad, cat.id_categoria, cat.nombre
           from app.comunidad c, app.categoria cat
           where c.rango_edad = $1 and cat.codigo = $2 and cat.estado = 'activa'
         ), nueva as (
           insert into app.sala (id_comunidad, id_categoria, nombre, descripcion, reglas)
           select id_comunidad, id_categoria, nombre, $3, $4 from base
           on conflict do nothing
           returning id_sala
         ), escenario as (
           insert into app.escenario_sala (id_sala, ancho, alto, obstaculos, aparicion_x, aparicion_y)
           select id_sala, 12, 8,
                  '[{"x":2,"y":1,"tipo":"planta"},{"x":9,"y":1,"tipo":"planta"},
                    {"x":5,"y":4,"tipo":"mesa"},{"x":6,"y":4,"tipo":"mesa"}]'::jsonb, 1, 6
           from nueva
         ), ${cteAuditoria('nueva', 'id_sala::text', 5)}
         select id_sala as id from nueva`,
        [
          datos.rango,
          datos.codigoCategoria,
          datos.descripcion,
          datos.reglas,
          ...parametrosAuditoria({
            actor: datos.actor,
            accion: 'crear_sala',
            entidad: 'sala',
            detalle: { comunidad: datos.rango, categoria: datos.codigoCategoria },
          }),
        ],
      );
      if (rows[0]) return rows[0];
      const base = await db.query(
        `select 1 from app.comunidad c, app.categoria cat
         where c.rango_edad = $1 and cat.codigo = $2 and cat.estado = 'activa'`,
        [datos.rango, datos.codigoCategoria],
      );
      return base.rows.length > 0 ? 'ya_existe' : 'no_encontrada';
    },

    // ── Reglas DLP (F31) ───────────────────────────────────────────────────────

    async listarReglasDlp(): Promise<CategoriaDlpAdministrada[]> {
      const { rows } = await db.query<CategoriaDlpAdministrada>(
        `select c.codigo, c.nombre, c.descripcion,
                coalesce(json_agg(json_build_object(
                  'id', r.id_regla, 'codigo', r.codigo, 'descripcion', r.descripcion,
                  'patron', r.patron, 'accion', r.accion, 'estado', r.estado,
                  'bloqueos30d', (select count(*)::int from app.evento_dlp e
                                  where e.id_regla = r.id_regla
                                    and e.fecha >= now() - interval '30 days'))
                  order by r.codigo) filter (where r.id_regla is not null), '[]') as reglas
         from app.categoria_dlp c
         left join app.regla_dlp r on r.categoria = c.codigo
         group by c.codigo, c.nombre, c.descripcion, c.orden
         order by c.orden`,
      );
      return rows;
    },

    /** Activa o desactiva una regla, o todas las de una categoría, con su registro. */
    async cambiarEstadoReglas(cambio: {
      filtro: { idRegla: string } | { categoria: string };
      estado: 'activa' | 'inactiva';
      actor: string;
    }): Promise<number> {
      const porRegla = 'idRegla' in cambio.filtro;
      const { rows } = await db.query<{ id: string }>(
        `with cambio as (
           update app.regla_dlp set estado = $2
           where ${porRegla ? 'id_regla = $1::uuid' : 'categoria = $1'} and estado <> $2
           returning id_regla, codigo
         ), ${cteAuditoria('cambio', 'codigo', 3)}
         select id_regla as id from cambio`,
        [
          porRegla
            ? (cambio.filtro as { idRegla: string }).idRegla
            : (cambio.filtro as { categoria: string }).categoria,
          cambio.estado,
          ...parametrosAuditoria({
            actor: cambio.actor,
            accion: cambio.estado === 'activa' ? 'activar_regla_dlp' : 'desactivar_regla_dlp',
            entidad: 'regla_dlp',
            detalle: porRegla
              ? { estadoNuevo: cambio.estado }
              : {
                  estadoNuevo: cambio.estado,
                  categoria: (cambio.filtro as { categoria: string }).categoria,
                },
          }),
        ],
      );
      return rows.length;
    },

    async existeRegla(idRegla: string): Promise<boolean> {
      const { rows } = await db.query('select 1 from app.regla_dlp where id_regla = $1', [idRegla]);
      return rows.length > 0;
    },

    async existeCategoriaDlp(codigo: string): Promise<boolean> {
      const { rows } = await db.query('select 1 from app.categoria_dlp where codigo = $1', [
        codigo,
      ]);
      return rows.length > 0;
    },
  };
}

export type RepositorioAdministracion = ReturnType<typeof crearRepositorioAdministracion>;
