-- 0007 · Cuentas de personal (moderación y gestión de fuentes) con correo y contraseña.
-- No borra ni modifica datos existentes: solo agrega una columna opcional, su índice y dos
-- restricciones que las filas actuales ya cumplen (ninguna tiene correo).
--
--   * app.usuario.correo: identificador de acceso del personal que crea la administración desde
--     el panel. Se guarda normalizado (sin espacios y en minúsculas), así que el índice único lo
--     es también sin distinguir mayúsculas.
--   * Los jóvenes nunca tienen correo (minimización, sección 22): entran con su nametag.

alter table app.usuario add column if not exists correo text;

alter table app.usuario drop constraint if exists usuario_correo_formato;
alter table app.usuario add constraint usuario_correo_formato check (
  correo is null
  or (char_length(correo) <= 254
      and correo = lower(btrim(correo))
      and correo ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'));

alter table app.usuario drop constraint if exists usuario_correo_solo_personal;
alter table app.usuario add constraint usuario_correo_solo_personal
  check (correo is null or rol <> 'usuario');

create unique index if not exists usuario_correo_unico on app.usuario (correo);

comment on column app.usuario.correo is
  'Correo de acceso del personal (moderación, gestión de fuentes), en minúsculas. Null en jóvenes.';
