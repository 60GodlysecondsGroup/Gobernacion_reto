-- 0004 · Avatar personalizado (Fase 6).

-- Orden de presentación de cada elemento dentro de su tipo en «Mi avatar».
alter table app.elemento_avatar add column orden smallint not null default 0;

-- El recurso gráfico es siempre una clave de un dibujo propio hecho por código: nunca una URL,
-- una ruta ni una imagen (RF21).
alter table app.elemento_avatar add constraint elemento_avatar_recurso_clave
  check (recurso_grafico ~ '^[a-z0-9-]{2,40}$');

-- Cada capa de la configuración debe apuntar a un elemento de su mismo tipo: un cabello en
-- «cabello», una prenda en «prenda»… Las claves foráneas solo garantizan que el elemento exista.
create function app.verificar_configuracion_avatar() returns trigger
language plpgsql as $$
declare
  capa record;
begin
  for capa in
    select * from (values
      ('personaje', new.id_personaje),
      ('cabello', new.id_cabello),
      ('rasgo', new.id_rasgos),
      ('prenda', new.id_prenda),
      ('accesorio', new.id_accesorio)
    ) as capas (tipo, id_elemento)
    where id_elemento is not null
  loop
    if not exists (
      select 1 from app.elemento_avatar
      where id_elemento = capa.id_elemento and tipo = capa.tipo
    ) then
      raise exception 'El elemento % no es de tipo %', capa.id_elemento, capa.tipo
        using errcode = '23514';
    end if;
  end loop;
  new.fecha_actualizacion := now();
  return new;
end;
$$;

create trigger configuracion_avatar_tipos
  before insert or update on app.configuracion_avatar
  for each row execute function app.verificar_configuracion_avatar();
