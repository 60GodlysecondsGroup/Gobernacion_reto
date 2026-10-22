-- 0005 · Moderación y administración (Fase 7).
-- No borra ni reescribe datos existentes: solo agrega columnas con valor por defecto, índices
-- y restricciones nuevas compatibles con lo que ya hay.
--
-- Es idempotente: si una base ya tiene alguna de estas piezas (p. ej. agregada a mano), la
-- reutiliza, pero antes comprueba que sea compatible y, si no lo es, falla sin cambiar nada.

-- F29: la administración puede deshabilitar una sala sin borrarla. Una sala deshabilitada no se
-- lista para jóvenes ni admite entradas. Al cerrarse por inactividad, la instancia nueva hereda
-- este valor (la decisión del administrador se conserva).
do $$
declare
  col record;
begin
  select data_type, is_nullable into col from information_schema.columns
   where table_schema = 'app' and table_name = 'sala' and column_name = 'habilitada';
  if found and (col.data_type <> 'boolean' or col.is_nullable <> 'NO') then
    raise exception 'app.sala.habilitada ya existe como % (nulos: %); se esperaba boolean not null',
      col.data_type, col.is_nullable;
  end if;
end $$;
alter table app.sala add column if not exists habilitada boolean not null default true;
alter table app.sala alter column habilitada set default true;

-- F30: resultado de la revisión. Solo un valor de una lista cerrada: no hay notas libres, para no
-- acumular texto con posibles datos personales (minimización, sección 22).
do $$
declare
  tipo text;
begin
  select data_type into tipo from information_schema.columns
   where table_schema = 'app' and table_name = 'reporte' and column_name = 'resolucion';
  if found and tipo <> 'text' then
    raise exception 'app.reporte.resolucion ya existe como %; se esperaba text', tipo;
  end if;
end $$;
alter table app.reporte add column if not exists resolucion text;
alter table app.reporte drop constraint if exists reporte_resolucion_valida;
alter table app.reporte add constraint reporte_resolucion_valida check (resolucion in (
  'sin_accion', 'contenido_oculto', 'usuario_suspendido', 'sala_deshabilitada'));

-- Lista de reportes por estado y fecha, y búsqueda de reportes de un mismo contenido.
create index if not exists reporte_contenido on app.reporte (tipo_contenido, id_contenido);

-- Registro de acciones administrativas (punto 7 de la Fase 7): consultas por entidad y actor.
create index if not exists registro_auditoria_entidad on app.registro_auditoria (entidad, fecha desc);

-- Las acciones registradas usan una lista conocida: así el registro se puede leer y filtrar.
alter table app.registro_auditoria drop constraint if exists registro_auditoria_accion_formato;
alter table app.registro_auditoria add constraint registro_auditoria_accion_formato
  check (accion ~ '^[a-z_]{3,60}$');

-- Hora real de cada acción (no la del inicio de la transacción), para ordenar varias acciones
-- seguidas, igual que la bitácora de fuentes.
alter table app.registro_auditoria alter column fecha set default clock_timestamp();
