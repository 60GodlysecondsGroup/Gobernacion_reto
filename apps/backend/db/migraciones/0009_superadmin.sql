-- 0009 · Superadministración: rol `superadmin` y protección del último superadministrador.
-- No borra ni modifica datos existentes: amplía la lista de roles, agrega una restricción que las
-- filas actuales ya cumplen (no hay ningún superadmin) y un disparador.
--
--   * `superadmin` gestiona las cuentas de administración de la plataforma (crear, editar,
--     activar, desactivar, restablecer la contraseña, cambiar o revocar el rol). Tiene además
--     todos los permisos de `admin_plataforma`; la matriz vive en el backend (permisos.ts).
--   * Un superadmin siempre tiene correo: entra solo por «Acceso del equipo», nunca con nametag.
--   * Nunca puede quedar la plataforma sin un superadmin activo una vez que existe uno: el
--     disparador lo impide aunque dos cambios lleguen a la vez.
--   * El primer superadmin NO se crea aquí (no hay credenciales en las migraciones): lo inicializa
--     quien opera el servidor con `npm run superadmin:inicializar` (README, «Superadministración»).

alter table app.usuario drop constraint if exists usuario_rol_check;
alter table app.usuario add constraint usuario_rol_check check (
  rol in ('usuario', 'moderador', 'admin_plataforma', 'gestor_fuentes', 'superadmin'));

alter table app.usuario drop constraint if exists usuario_superadmin_con_correo;
alter table app.usuario add constraint usuario_superadmin_con_correo
  check (rol <> 'superadmin' or correo is not null);

comment on column app.usuario.correo is
  'Correo de acceso del personal, la administración y la superadministración, en minúsculas. Null en jóvenes.';

-- Si un cambio deja sin superadmin activo a una plataforma que tenía al menos uno, se rechaza.
-- El candado de transacción serializa los cambios que quitan un superadmin: el segundo espera al
-- primero y, al contar, ya ve su resultado (en read committed cada consulta toma una foto nueva).
create or replace function app.proteger_ultimo_superadmin() returns trigger
language plpgsql as $$
begin
  if old.rol <> 'superadmin' or old.estado <> 'activo' then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.rol = 'superadmin' and new.estado = 'activo' then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtext('app.ultimo_superadmin'));
  if not exists (
    select 1 from app.usuario where rol = 'superadmin' and estado = 'activo'
  ) then
    raise exception 'La plataforma no puede quedar sin un superadministrador activo.'
      using errcode = 'check_violation', constraint = 'ultimo_superadmin_activo';
  end if;
  return null;
end $$;

drop trigger if exists usuario_ultimo_superadmin on app.usuario;
create trigger usuario_ultimo_superadmin after update of rol, estado or delete on app.usuario
  for each row execute function app.proteger_ultimo_superadmin();

-- Mismo criterio que 0001: la API pública de Supabase no debe tocar estas funciones.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function app.proteger_ultimo_superadmin() from anon, authenticated;
  end if;
end $$;
