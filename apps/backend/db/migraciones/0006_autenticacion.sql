-- 0006 · Autenticación real: registro, contraseña y sesiones revocables.
-- No borra ni modifica datos existentes: solo agrega dos tablas.
--
--   * app.credencial: el hash de la contraseña de cada cuenta, aparte de app.usuario para que
--     ninguna consulta de perfiles, hilos o salas pueda arrastrarlo por error. Una cuenta sin
--     credencial (datos sintéticos, personas simuladas) no puede iniciar sesión.
--   * app.sesion: cada inicio de sesión. La cookie lleva el id firmado; cerrar sesión la revoca
--     aquí y el token deja de servir aunque alguien conserve una copia.

create table app.credencial (
  id_usuario          uuid primary key references app.usuario (id_usuario) on delete cascade,
  -- Formato propio `scrypt$N$r$p$sal$hash` (base64url). Nunca la contraseña en claro.
  hash_contrasena     text not null check (hash_contrasena ~ '^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$'),
  fecha_creacion      timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now()
);

comment on table app.credencial is
  'Hash scrypt de la contraseña. Solo lo lee el inicio de sesión; nunca sale del backend.';

create trigger credencial_fecha_actualizacion before update on app.credencial
  for each row execute function app.actualizar_fecha_actualizacion();

create table app.sesion (
  id_sesion        uuid primary key default gen_random_uuid(),
  id_usuario       uuid not null references app.usuario (id_usuario) on delete cascade,
  -- true si la persona eligió «Recordarme» (cookie persistente y vigencia larga).
  persistente      boolean not null default false,
  fecha_creacion   timestamptz not null default now(),
  fecha_expiracion timestamptz not null,
  fecha_revocacion timestamptz,
  check (fecha_expiracion > fecha_creacion)
);

create index sesion_usuario_vigente on app.sesion (id_usuario) where fecha_revocacion is null;
create index sesion_expiracion on app.sesion (fecha_expiracion);

comment on table app.sesion is
  'Sesiones abiertas. El token de la cookie solo es válido si su fila existe, no venció y no fue revocada.';

-- Mismo criterio que 0001: la API pública de Supabase no debe tocar estas tablas.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on app.credencial, app.sesion from anon, authenticated;
  end if;
end $$;

comment on column app.usuario.codigo is
  'Identificador interno legible: Usuario_001… en los datos sintéticos, Cuenta_XXXXXXXXXX en las cuentas registradas.';
