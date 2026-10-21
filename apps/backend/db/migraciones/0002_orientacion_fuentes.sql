-- 0002 · Orientación y fuentes institucionales (Fase 3).

-- Texto breve y neutral para cada necesidad del navegador (F04). No evalúa ni diagnostica.
alter table app.necesidad_orientacion add column descripcion text not null default '';

update app.necesidad_orientacion set descripcion = case codigo
  when 'bienestar' then 'Información para cuidar tu bienestar en el día a día.'
  when 'hablar_con_alguien' then 'Canales institucionales donde puedes conversar con una persona.'
  when 'situacion_preocupa' then 'Dónde buscar orientación sobre algo que te inquieta.'
  when 'amigo_preocupa' then 'Dónde orientar a un amigo o compañero que te preocupa.'
  when 'lineas_ayuda' then 'Líneas y canales de ayuda de instituciones, con su fuente.'
  when 'informacion_institucional' then 'Servicios, horarios y canales oficiales de las instituciones.'
end;

-- Clave estable de cada fuente: permite que el archivo de carga actualice sin duplicar.
alter table app.fuente_institucional add column codigo text;

update app.fuente_institucional
set codigo = 'fuente-' || substr(id_fuente::text, 1, 8)
where codigo is null;

alter table app.fuente_institucional
  alter column codigo set not null,
  add constraint fuente_codigo_unico unique (codigo),
  add constraint fuente_codigo_formato check (codigo ~ '^[a-z0-9-]{3,60}$');

-- Bitácora (F33): qué campos cambiaron, con su valor anterior y nuevo (datos institucionales
-- públicos, nunca datos de usuarios). La hora exacta ordena varios cambios de una transacción.
alter table app.bitacora_fuente
  add column cambios jsonb not null default '{}' check (jsonb_typeof(cambios) = 'object'),
  alter column fecha set default clock_timestamp();
