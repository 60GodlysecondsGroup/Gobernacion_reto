-- Cuentas sintéticas de PRUEBA (Anexo B.7 + Fase 2) y su contenido de demostración.
-- Solo para la base local de desarrollo y de pruebas automatizadas (npm run db:local,
-- npm run db:reset:local, npm run test:db). NUNCA se cargan en la base compartida.
-- Se carga después de datos_base.sql, que ya creó comunidades, salas y la cuenta Admin_001.
--
-- Ninguna de estas cuentas tiene contraseña: no sirven para iniciar sesión en la interfaz. Las
-- pruebas les abren la sesión directamente (test/apoyo.ts). Los códigos deben coincidir con
-- CODIGOS_USUARIOS_PRUEBA (src/db/usuarios-prueba.ts), que usa la limpieza de la base compartida.
--
-- Al menos uno por rango de edad y uno por rol. Usuario_001 · LunaDemo · comunidad 13–15 es el
-- usuario de B.7. El personal no tiene rango.

insert into app.usuario (codigo, alias, rol, rango_edad, intereses_generales) values
  ('Usuario_001', 'LunaDemo', 'usuario', 'B', '{lectura, música}'),
  ('Usuario_002', 'SolDemo', 'usuario', 'B', '{dibujo}'),
  ('Usuario_003', 'RioDemo', 'usuario', 'A', '{juegos de mesa}'),
  ('Usuario_004', 'NubeDemo', 'usuario', 'C', '{fotografía}'),
  ('Usuario_005', 'MarDemo', 'usuario', 'D', '{deporte}'),
  ('Moderador_001', 'ModeradorDemo', 'moderador', null, '{}'),
  ('Gestor_001', 'GestorDemo', 'gestor_fuentes', null, '{}');

-- La misma fórmula de datos_base.sql, numerando todas las cuentas por código: cada una conserva
-- su apariencia de siempre. Solo para las que aún no tienen avatar.
insert into app.configuracion_avatar (id_usuario, id_personaje, id_cabello, id_rasgos, id_prenda, id_accesorio)
select id_usuario,
       (array['tono-arena', 'tono-miel', 'tono-canela', 'tono-cacao'])[1 + n % 4],
       (array['cabello-largo', 'cabello-corto', 'cabello-rizado', 'cabello-recogido'])[1 + n % 4],
       (array['rasgos-sonrisa', 'rasgos-pecas', 'rasgos-tranquilo', 'rasgos-mejillas'])[1 + (n + 1) % 4],
       (array['prenda-buzo', 'prenda-camiseta', 'prenda-rayas', 'prenda-chaqueta'])[1 + (n + 2) % 4],
       (array['accesorio-audifonos', null, 'accesorio-gafas', null, 'accesorio-gorra'])[1 + n % 5]
from (select id_usuario, (row_number() over (order by codigo))::int as n from app.usuario) as u
where not exists (select 1 from app.configuracion_avatar ca where ca.id_usuario = u.id_usuario);

-- Superadministración de prueba (sin contraseña, como las demás): las pruebas la necesitan para
-- que siempre quede un superadmin activo (disparador de 0009). Se conserva como la administración:
-- no está en CODIGOS_USUARIOS_PRUEBA y la limpieza nunca la borra. Va después de la fórmula de
-- avatares para no cambiar la apariencia de las demás cuentas.
with nueva as (
  insert into app.usuario (codigo, alias, rol, rango_edad, intereses_generales, correo) values
    ('Superadmin_001', 'SuperadminDemo', 'superadmin', null, '{}', 'superadmin.demo@prueba.test')
  returning id_usuario
)
insert into app.configuracion_avatar (id_usuario, id_personaje, id_cabello, id_rasgos, id_prenda, id_accesorio)
select id_usuario, 'tono-canela', 'cabello-recogido', 'rasgos-tranquilo', 'prenda-chaqueta', 'accesorio-gafas'
from nueva;

-- Hilos sintéticos (Fase 4): uno o dos por comunidad, para que cada inicio tenga contenido y
-- se pueda comprobar el aislamiento. Textos ficticios, sin datos personales.
insert into app.hilo (id_usuario, id_comunidad, id_categoria, titulo, contenido, fecha_creacion)
select u.id_usuario, c.id_comunidad, cat.id_categoria, h.titulo, h.contenido,
       now() - h.antiguedad
from (values
  ('Usuario_002', 'vida-academica', '¿Cómo organizan su tiempo para estudiar?',
   'Esta semana tengo varias tareas y me cuesta repartir el tiempo. ¿Qué les funciona a ustedes?',
   interval '2 days'),
  ('Usuario_001', 'cambios-nuevas-etapas', 'Me cuesta adaptarme a los cambios de este año',
   'Cambiaron varios horarios y profesores, y todavía me siento un poco perdido. ¿A alguien más le pasó?',
   interval '5 hours'),
  ('Usuario_003', 'relaciones-convivencia', '¿Cómo hacer nuevos amigos en el descanso?',
   'Llegué hace poco y en el descanso casi siempre estoy solo. ¿Qué podría intentar?',
   interval '1 day'),
  ('Usuario_004', 'bienestar-cotidiano', 'Ideas para empezar el día con calma',
   '¿Qué hacen en la mañana para empezar con buena energía? Yo estoy probando salir a caminar un rato.',
   interval '3 hours'),
  ('Usuario_005', 'orientacion', '¿Dónde encuentro información sobre orientación vocacional?',
   'Estoy pensando qué estudiar y quisiera saber qué opciones de orientación existen.',
   interval '6 hours')
) as h (codigo, categoria, titulo, contenido, antiguedad)
join app.usuario u on u.codigo = h.codigo
join app.comunidad c on c.rango_edad = u.rango_edad
join app.categoria cat on cat.codigo = h.categoria;

insert into app.respuesta (id_hilo, id_usuario, contenido, fecha_creacion)
select hi.id_hilo, u.id_usuario, r.contenido, now() - r.antiguedad
from (values
  ('¿Cómo organizan su tiempo para estudiar?', 'Usuario_001',
   'A mí me sirve hacer una lista corta cada mañana y empezar por lo más fácil.', interval '1 day')
) as r (titulo, codigo, contenido, antiguedad)
join app.hilo hi on hi.titulo = r.titulo
join app.usuario u on u.codigo = r.codigo;

-- Respuesta sintética que el DLP no detecta (no contiene datos personales ni de contacto), pero
-- incumple las reglas de convivencia. Sirve para demostrar la segunda capa de protección: el
-- reporte de una persona y la revisión del moderador (sección 17.1, TRL-11).
insert into app.respuesta (id_hilo, id_usuario, contenido, fecha_creacion)
select hi.id_hilo, u.id_usuario,
       'Tus preguntas siempre son aburridas, mejor no escribas más aquí.', now() - interval '2 hours'
from app.hilo hi, app.usuario u
where hi.titulo = 'Me cuesta adaptarme a los cambios de este año' and u.codigo = 'Usuario_002';

-- Reportes sintéticos pendientes (Fase 7), para que el panel de moderación tenga casos que revisar.
insert into app.reporte
  (id_usuario_reportante, id_comunidad, tipo_contenido, id_contenido, categoria, descripcion, fecha_reporte)
select luna.id_usuario, c.id_comunidad, 'respuesta', r.id_respuesta, 'acoso', null,
       now() - interval '90 minutes'
from app.usuario luna
join app.comunidad c on c.rango_edad = luna.rango_edad
join app.respuesta r on r.contenido like 'Tus preguntas siempre son aburridas%'
where luna.codigo = 'Usuario_001';

insert into app.reporte
  (id_usuario_reportante, id_comunidad, tipo_contenido, id_contenido, categoria, descripcion, fecha_reporte)
select sol.id_usuario, c.id_comunidad, 'sala', s.id_sala, 'contenido_inapropiado',
       'Hubo varios mensajes fuera del tema de la sala.', now() - interval '40 minutes'
from app.usuario sol
join app.comunidad c on c.rango_edad = sol.rango_edad
join app.sala s on s.id_comunidad = c.id_comunidad and s.nombre = 'Vida académica'
where sol.codigo = 'Usuario_002';
