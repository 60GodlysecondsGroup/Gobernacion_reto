-- 0001 · Esquema inicial del prototipo (Fase 1).
-- Modelo de datos definitivo derivado del modelo conceptual B.4 del Documento Maestro.
--
-- Principios aplicados:
--   * Solo datos sintéticos. No existen campos de salud, diagnóstico ni edad exacta:
--     el usuario solo tiene un rango (A–D).
--   * La segmentación por edad se impone en el backend y, como defensa adicional,
--     también aquí (disparador app.verificar_segmentacion).
--   * Estados como texto + CHECK: legibles y fáciles de ampliar en migraciones posteriores.
--   * Todo vive en el esquema "app", que la API pública de Supabase no expone.
--     El backend es el único que accede a los datos.
--
-- El esquema "app" y la tabla app.migraciones los crea el ejecutor de migraciones.

-- ─── Utilidades ──────────────────────────────────────────────────────────────

create function app.actualizar_fecha_actualizacion() returns trigger
language plpgsql as $$
begin
  new.fecha_actualizacion := now();
  return new;
end $$;

-- Tablas de trazabilidad: solo admiten inserciones.
create function app.impedir_modificacion() returns trigger
language plpgsql as $$
begin
  raise exception 'La tabla app.% es de solo inserción (trazabilidad).', tg_table_name
    using errcode = 'insufficient_privilege';
end $$;

-- ─── Catálogos del sistema (constantes del modelo, no datos de demo) ─────────

create table app.rango_edad (
  codigo      char(1) primary key check (codigo in ('A', 'B', 'C', 'D')),
  edad_minima smallint not null,
  edad_maxima smallint not null,
  etiqueta    text not null unique,
  check (edad_minima <= edad_maxima)
);

insert into app.rango_edad (codigo, edad_minima, edad_maxima, etiqueta) values
  ('A', 10, 12, '10–12 años'),
  ('B', 13, 15, '13–15 años'),
  ('C', 16, 17, '16–17 años'),
  ('D', 18, 22, '18–22 años');

-- Categorías de protección del DLP (secciones 16.1 y B.5).
create table app.categoria_dlp (
  codigo      text primary key,
  nombre      text not null unique,
  descripcion text not null,
  orden       smallint not null
);

insert into app.categoria_dlp (codigo, nombre, descripcion, orden) values
  ('contacto', 'Datos de contacto',
   'Teléfonos, correos, códigos de contacto, identificadores externos y enlaces.', 1),
  ('redes_externas', 'Redes sociales y plataformas externas',
   'Instagram, TikTok, WhatsApp, Discord, Telegram y similares, y expresiones para llevar la conversación fuera.', 2),
  ('ubicacion', 'Ubicación',
   'Direcciones, barrios, lugares exactos y puntos de encuentro.', 3),
  ('identidad', 'Identidad personal',
   'Nombres completos, documentos y solicitudes de datos personales.', 4),
  ('edad', 'Edad exacta',
   'Publicar o solicitar la edad exacta.', 5),
  ('publicidad_comercio', 'Publicidad y comercio',
   'Ventas, promociones, solicitudes de dinero y promoción de aplicaciones externas.', 6);

-- Necesidades del navegador de orientación (F04). Son categorías de búsqueda, no de evaluación.
create table app.necesidad_orientacion (
  codigo text primary key,
  nombre text not null unique,
  orden  smallint not null
);

insert into app.necesidad_orientacion (codigo, nombre, orden) values
  ('bienestar', 'Bienestar', 1),
  ('hablar_con_alguien', 'Quiero hablar con alguien', 2),
  ('situacion_preocupa', 'Me preocupa una situación', 3),
  ('amigo_preocupa', 'Me preocupa un amigo', 4),
  ('lineas_ayuda', 'Líneas y canales de ayuda', 5),
  ('informacion_institucional', 'Información institucional', 6);

-- ─── Comunidades y usuarios ──────────────────────────────────────────────────

-- Cada comunidad pertenece a un único rango y cada rango tiene una sola comunidad.
create table app.comunidad (
  id_comunidad        uuid primary key default gen_random_uuid(),
  rango_edad          char(1) not null unique references app.rango_edad (codigo),
  nombre              text not null unique,
  descripcion         text not null default '',
  estado              text not null default 'activa' check (estado in ('activa', 'inactiva')),
  fecha_creacion      timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now()
);

-- Roles del Anexo A.2. El usuario joven siempre tiene rango; el personal puede no tenerlo.
create table app.usuario (
  id_usuario          uuid primary key default gen_random_uuid(),
  codigo              text not null unique,
  alias               text not null check (char_length(alias) between 3 and 30),
  rol                 text not null default 'usuario'
                      check (rol in ('usuario', 'moderador', 'admin_plataforma', 'gestor_fuentes')),
  rango_edad          char(1) references app.rango_edad (codigo),
  intereses_generales text[] not null default '{}' check (cardinality(intereses_generales) <= 10),
  estado              text not null default 'activo' check (estado in ('activo', 'suspendido', 'bloqueado')),
  fecha_registro      timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now(),
  constraint usuario_joven_con_rango check (rol <> 'usuario' or rango_edad is not null)
);

comment on column app.usuario.codigo is 'Identificador sintético legible (p. ej. Usuario_001).';
comment on column app.usuario.rango_edad is 'Solo el rango. La edad exacta nunca se almacena.';

create unique index usuario_alias_unico on app.usuario (lower(alias));
create index usuario_rango on app.usuario (rango_edad);

-- ─── Avatar (catálogo cerrado; sin texto libre ni imágenes cargadas) ────────

create table app.elemento_avatar (
  id_elemento         text primary key check (id_elemento ~ '^[a-z0-9-]{2,40}$'),
  tipo                text not null check (tipo in ('personaje', 'cabello', 'rasgo', 'prenda', 'accesorio')),
  nombre              text not null,
  recurso_grafico     text not null,
  origen              text not null,
  licencia            text not null,
  estado              text not null default 'activo' check (estado in ('activo', 'inactivo')),
  fecha_creacion      timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now()
);

comment on column app.elemento_avatar.recurso_grafico is
  'Clave del recurso gráfico propio dibujado por código. Nunca una URL ni una imagen subida.';

create table app.configuracion_avatar (
  id_usuario          uuid primary key references app.usuario (id_usuario) on delete cascade,
  id_personaje        text not null references app.elemento_avatar (id_elemento),
  id_cabello          text references app.elemento_avatar (id_elemento),
  id_rasgos           text references app.elemento_avatar (id_elemento),
  id_prenda           text references app.elemento_avatar (id_elemento),
  id_accesorio        text references app.elemento_avatar (id_elemento),
  fecha_actualizacion timestamptz not null default now()
);

-- ─── Comunidad: foros e hilos ────────────────────────────────────────────────

create table app.categoria (
  id_categoria        uuid primary key default gen_random_uuid(),
  codigo              text not null unique check (codigo ~ '^[a-z0-9-]{2,60}$'),
  nombre              text not null unique,
  descripcion         text not null default '',
  orden               smallint not null default 0,
  estado              text not null default 'activa' check (estado in ('activa', 'inactiva')),
  fecha_creacion      timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now()
);

create table app.hilo (
  id_hilo             uuid primary key default gen_random_uuid(),
  id_usuario          uuid not null references app.usuario (id_usuario),
  id_comunidad        uuid not null references app.comunidad (id_comunidad),
  id_categoria        uuid not null references app.categoria (id_categoria),
  titulo              text not null check (char_length(titulo) between 3 and 120),
  contenido           text not null check (char_length(contenido) between 1 and 5000),
  estado              text not null default 'activo' check (estado in ('activo', 'oculto', 'cerrado')),
  fecha_creacion      timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now()
);

create index hilo_comunidad_fecha on app.hilo (id_comunidad, fecha_creacion desc);

create table app.respuesta (
  id_respuesta        uuid primary key default gen_random_uuid(),
  id_hilo             uuid not null references app.hilo (id_hilo) on delete cascade,
  id_usuario          uuid not null references app.usuario (id_usuario),
  contenido           text not null check (char_length(contenido) between 1 and 5000),
  estado              text not null default 'publicada' check (estado in ('publicada', 'bloqueada', 'oculta')),
  fecha_creacion      timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now()
);

create index respuesta_hilo_fecha on app.respuesta (id_hilo, fecha_creacion);

-- ─── Salas temáticas ─────────────────────────────────────────────────────────

-- Cada fila es una instancia de sala. Una instancia cerrada no se reabre (TRL-08).
create table app.sala (
  id_sala             uuid primary key default gen_random_uuid(),
  id_comunidad        uuid not null references app.comunidad (id_comunidad),
  id_categoria        uuid not null references app.categoria (id_categoria),
  nombre              text not null,
  descripcion         text not null default '',
  reglas              text not null default '',
  capacidad_maxima    smallint not null default 10 check (capacidad_maxima between 1 and 10),
  usuarios_actuales   smallint not null default 0,
  estado              text not null default 'disponible'
                      check (estado in ('disponible', 'llena', 'vacia', 'cerrada')),
  ultima_actividad    timestamptz,
  vacia_desde         timestamptz,
  fecha_cierre        timestamptz,
  fecha_creacion      timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now(),
  -- RF10: nunca más participantes que la capacidad (máximo 10), garantizado por la base.
  constraint sala_ocupacion_valida check (usuarios_actuales between 0 and capacidad_maxima),
  constraint sala_cierre_coherente check ((estado = 'cerrada') = (fecha_cierre is not null))
);

comment on column app.sala.vacia_desde is 'Inicio del contador de cierre automático (F13).';

create unique index sala_nombre_abierta on app.sala (id_comunidad, nombre) where estado <> 'cerrada';
create index sala_comunidad on app.sala (id_comunidad);

create table app.participacion_sala (
  id_participacion uuid primary key default gen_random_uuid(),
  id_sala          uuid not null references app.sala (id_sala) on delete cascade,
  id_usuario       uuid not null references app.usuario (id_usuario),
  hora_entrada     timestamptz not null default now(),
  hora_salida      timestamptz,
  check (hora_salida is null or hora_salida >= hora_entrada)
);

-- Un usuario no puede estar dos veces a la vez en la misma sala.
create unique index participacion_activa_unica on app.participacion_sala (id_sala, id_usuario)
  where hora_salida is null;

-- Área jugable en cuadrícula; obstaculos = arreglo JSON de celdas [[x, y], ...].
create table app.escenario_sala (
  id_escenario        uuid primary key default gen_random_uuid(),
  id_sala             uuid not null unique references app.sala (id_sala) on delete cascade,
  ancho               smallint not null check (ancho between 4 and 64),
  alto                smallint not null check (alto between 4 and 64),
  obstaculos          jsonb not null default '[]' check (jsonb_typeof(obstaculos) = 'array'),
  aparicion_x         smallint not null default 0,
  aparicion_y         smallint not null default 0,
  fecha_creacion      timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now(),
  check (aparicion_x between 0 and ancho - 1 and aparicion_y between 0 and alto - 1)
);

-- Estado de sesión: posición actual de cada avatar dentro de una sala activa.
create table app.posicion_avatar_sala (
  id_sala             uuid not null references app.sala (id_sala) on delete cascade,
  id_usuario          uuid not null references app.usuario (id_usuario) on delete cascade,
  x                   smallint not null check (x >= 0),
  y                   smallint not null check (y >= 0),
  fecha_actualizacion timestamptz not null default now(),
  primary key (id_sala, id_usuario)
);

-- ─── Moderación: reportes y DLP ──────────────────────────────────────────────

create table app.reporte (
  id_reporte            uuid primary key default gen_random_uuid(),
  id_usuario_reportante uuid not null references app.usuario (id_usuario),
  id_comunidad          uuid references app.comunidad (id_comunidad),
  tipo_contenido        text not null check (tipo_contenido in ('hilo', 'respuesta', 'perfil', 'sala')),
  id_contenido          uuid not null,
  categoria             text not null check (categoria in (
                          'informacion_personal', 'acoso', 'contenido_inapropiado',
                          'contacto_externo', 'publicidad', 'otro')),
  descripcion           text check (char_length(descripcion) <= 500),
  -- Estados de gestión de F30.
  estado                text not null default 'pendiente'
                        check (estado in ('pendiente', 'en_revision', 'resuelto', 'descartado')),
  id_revisor            uuid references app.usuario (id_usuario),
  fecha_reporte         timestamptz not null default now(),
  fecha_revision        timestamptz
);

create index reporte_estado_fecha on app.reporte (estado, fecha_reporte desc);

create table app.regla_dlp (
  id_regla            uuid primary key default gen_random_uuid(),
  codigo              text not null unique,
  categoria           text not null references app.categoria_dlp (codigo),
  descripcion         text not null default '',
  patron              text not null,
  accion              text not null default 'bloquear' check (accion in ('bloquear', 'advertir', 'registrar')),
  estado              text not null default 'activa' check (estado in ('activa', 'inactiva')),
  fecha_creacion      timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now()
);

comment on column app.regla_dlp.patron is 'Expresión regular evaluada sin distinguir mayúsculas.';

-- B.5: nunca se guarda el texto del mensaje bloqueado, solo metadatos del evento.
create table app.evento_dlp (
  id_evento      uuid primary key default gen_random_uuid(),
  id_usuario     uuid references app.usuario (id_usuario),
  tipo_contenido text not null check (tipo_contenido in ('perfil', 'hilo', 'respuesta', 'sala')),
  categoria      text not null references app.categoria_dlp (codigo),
  id_regla       uuid references app.regla_dlp (id_regla) on delete set null,
  accion         text not null check (accion in ('bloquear', 'advertir', 'registrar')),
  resultado      text not null check (resultado in ('bloqueado', 'advertido', 'registrado')),
  fecha          timestamptz not null default now()
);

create index evento_dlp_fecha on app.evento_dlp (fecha desc);
create index evento_dlp_categoria on app.evento_dlp (categoria, fecha desc);

-- ─── Orientación: fuentes institucionales ────────────────────────────────────

create table app.fuente_institucional (
  id_fuente           uuid primary key default gen_random_uuid(),
  institucion         text not null,
  nombre_servicio     text not null,
  descripcion         text not null,
  tipo_canal          text not null check (tipo_canal in ('telefono', 'web', 'presencial', 'chat', 'otro')),
  telefono            text check (telefono ~ '^[0-9 +()-]{3,20}$'),
  enlace              text check (enlace ~* '^https?://'),
  horario             text,
  fuente_original     text not null,
  -- B.6: ninguna fuente se publica sin fecha de verificación.
  fecha_verificacion  date not null,
  estado              text not null check (estado in ('activo', 'requiere_revision', 'inactivo')),
  observaciones       text,
  -- Registros de demostración que deben mostrarse como «DATO DE DEMOSTRACIÓN».
  es_demo             boolean not null default false,
  id_responsable      uuid references app.usuario (id_usuario),
  fecha_creacion      timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now()
);

create index fuente_estado on app.fuente_institucional (estado);

create table app.fuente_necesidad (
  id_fuente        uuid not null references app.fuente_institucional (id_fuente) on delete cascade,
  codigo_necesidad text not null references app.necesidad_orientacion (codigo),
  primary key (codigo_necesidad, id_fuente)
);

create table app.bitacora_fuente (
  id_bitacora            uuid primary key default gen_random_uuid(),
  id_fuente              uuid not null references app.fuente_institucional (id_fuente),
  id_usuario_responsable uuid references app.usuario (id_usuario),
  accion                 text not null
                         check (accion in ('crear', 'actualizar', 'marcar_revision', 'verificar', 'desactivar')),
  estado_anterior        text check (estado_anterior in ('activo', 'requiere_revision', 'inactivo')),
  estado_nuevo           text check (estado_nuevo in ('activo', 'requiere_revision', 'inactivo')),
  observacion            text,
  fecha                  timestamptz not null default now()
);

create index bitacora_fuente_fecha on app.bitacora_fuente (id_fuente, fecha desc);

-- ─── Auditoría administrativa (mecanismo mínimo; el definitivo sigue pendiente) ─

create table app.registro_auditoria (
  id_registro      bigint generated always as identity primary key,
  id_usuario_actor uuid references app.usuario (id_usuario),
  accion           text not null,
  entidad          text not null,
  id_entidad       text,
  detalle          jsonb not null default '{}',
  fecha            timestamptz not null default now()
);

create index registro_auditoria_fecha on app.registro_auditoria (fecha desc);

-- ─── Disparadores ────────────────────────────────────────────────────────────

-- fecha_actualizacion automática en todas las tablas que la tienen.
do $$
declare
  tabla text;
begin
  for tabla in
    select table_name from information_schema.columns
    where table_schema = 'app' and column_name = 'fecha_actualizacion'
  loop
    execute format(
      'create trigger %I before update on app.%I for each row execute function app.actualizar_fecha_actualizacion()',
      tabla || '_fecha_actualizacion', tabla);
  end loop;
end $$;

create trigger bitacora_fuente_solo_insercion before update or delete on app.bitacora_fuente
  for each row execute function app.impedir_modificacion();
create trigger registro_auditoria_solo_insercion before update or delete on app.registro_auditoria
  for each row execute function app.impedir_modificacion();

-- Segmentación por edad (RF01, RF02, RF23): un usuario joven solo puede crear contenido o
-- participar en salas de la comunidad de su rango. El personal (moderación, administración)
-- queda exento aquí; sus permisos los controla el backend.
create function app.verificar_segmentacion() returns trigger
language plpgsql as $$
declare
  v_rol             text;
  v_rango_usuario   char(1);
  v_rango_comunidad char(1);
begin
  select rol, rango_edad into v_rol, v_rango_usuario
  from app.usuario where id_usuario = new.id_usuario;

  if tg_table_name = 'hilo' then
    select rango_edad into v_rango_comunidad
    from app.comunidad where id_comunidad = new.id_comunidad;
  elsif tg_table_name = 'respuesta' then
    select c.rango_edad into v_rango_comunidad
    from app.hilo h join app.comunidad c on c.id_comunidad = h.id_comunidad
    where h.id_hilo = new.id_hilo;
  else
    select c.rango_edad into v_rango_comunidad
    from app.sala s join app.comunidad c on c.id_comunidad = s.id_comunidad
    where s.id_sala = new.id_sala;
  end if;

  if v_rol = 'usuario' and v_rango_usuario is distinct from v_rango_comunidad then
    raise exception 'Segmentación por edad: el recurso no pertenece a la comunidad del usuario.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

create trigger hilo_segmentacion before insert or update on app.hilo
  for each row execute function app.verificar_segmentacion();
create trigger respuesta_segmentacion before insert or update on app.respuesta
  for each row execute function app.verificar_segmentacion();
create trigger participacion_sala_segmentacion before insert or update on app.participacion_sala
  for each row execute function app.verificar_segmentacion();
create trigger posicion_avatar_sala_segmentacion before insert or update on app.posicion_avatar_sala
  for each row execute function app.verificar_segmentacion();

-- ─── Privilegios ─────────────────────────────────────────────────────────────

-- En Supabase, los roles de la API pública (anon, authenticated) no deben tocar este esquema.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on schema app from anon, authenticated;
    revoke all on all tables in schema app from anon, authenticated;
    revoke all on all sequences in schema app from anon, authenticated;
    revoke all on all functions in schema app from anon, authenticated;
  end if;
end $$;
