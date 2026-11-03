-- 0013 · Dirección y ubicación geográfica de las fuentes institucionales (atención presencial).
--
-- `direccion`: la dirección escrita tal como la indica la fuente oficial (opcional). Sirve aunque
-- no haya coordenadas: la ficha la muestra y ofrece buscarla en Google Maps, sin inventar un punto.
--
-- Ubicación en el mapa (opcional, toda o nada):
--   `latitud`, `longitud`: el punto del establecimiento (WGS84, grados decimales).
--   `place_id`: identificador del lugar en Google, si se eligió de la búsqueda de lugares.
--   `direccion_ubicacion`: la dirección que corresponde a ese punto (la que se muestra junto al
--   mapa, para que mapa y dirección digan lo mismo).
-- No se guardan respuestas completas de Google ni nada sobre las personas usuarias: la plataforma
-- nunca conoce ni almacena su ubicación; la ruta la calcula Google Maps en su propio servicio.
--
-- Compatibilidad: todas las columnas admiten null. Las fuentes ya registradas quedan sin dirección
-- ni ubicación y siguen funcionando igual.

alter table app.fuente_institucional
  add column if not exists direccion text,
  add column if not exists latitud double precision,
  add column if not exists longitud double precision,
  add column if not exists place_id text,
  add column if not exists direccion_ubicacion text;

alter table app.fuente_institucional
  add constraint fuente_direccion_largo
    check (direccion is null or char_length(direccion) between 5 and 200),
  add constraint fuente_latitud_rango check (latitud is null or latitud between -90 and 90),
  add constraint fuente_longitud_rango check (longitud is null or longitud between -180 and 180),
  add constraint fuente_place_id_formato
    -- Largo aparte: las expresiones regulares de PostgreSQL no admiten repeticiones de más de 255.
    check (place_id is null or (place_id ~ '^[A-Za-z0-9_-]+$' and char_length(place_id) between 10 and 300)),
  add constraint fuente_direccion_ubicacion_largo
    check (direccion_ubicacion is null or char_length(direccion_ubicacion) between 5 and 300),
  -- Latitud y longitud van siempre en pareja, con su dirección; el place_id solo con un punto.
  add constraint fuente_ubicacion_completa check (
    (latitud is null and longitud is null and place_id is null and direccion_ubicacion is null)
    or (latitud is not null and longitud is not null and direccion_ubicacion is not null)
  );
