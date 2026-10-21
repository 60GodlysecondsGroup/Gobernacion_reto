-- 0003 · Comunidad: hilos, respuestas y reportes (Fase 4).

-- Un usuario no acumula reportes abiertos repetidos sobre el mismo contenido.
create unique index reporte_abierto_unico
  on app.reporte (id_usuario_reportante, tipo_contenido, id_contenido)
  where estado in ('pendiente', 'en_revision');

-- La descripción opcional de un reporte también es texto de usuario: pasa por el DLP (RF04).
alter table app.evento_dlp drop constraint evento_dlp_tipo_contenido_check;
alter table app.evento_dlp add constraint evento_dlp_tipo_contenido_check
  check (tipo_contenido in ('perfil', 'hilo', 'respuesta', 'sala', 'reporte'));

-- Listado de hilos de una comunidad filtrado por categoría.
create index hilo_comunidad_categoria on app.hilo (id_comunidad, id_categoria, fecha_creacion desc);
