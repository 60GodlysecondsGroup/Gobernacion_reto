-- Datos sintéticos de demostración (Anexo B.7).
-- Ningún registro corresponde a personas, conversaciones ni instituciones reales.
-- Este archivo REINICIA los datos: vacía las tablas y vuelve a cargarlas.
-- Los catálogos del sistema (rangos, categorías DLP, necesidades) viven en las migraciones.
-- Las reglas DLP (reglas_dlp.json) y las fuentes institucionales (fuentes_institucionales.json)
-- se cargan después, desde sus archivos.

truncate
  app.registro_auditoria, app.bitacora_fuente, app.fuente_necesidad, app.fuente_institucional,
  app.evento_dlp, app.regla_dlp, app.reporte,
  app.posicion_avatar_sala, app.escenario_sala, app.participacion_sala, app.sala,
  app.respuesta, app.hilo, app.configuracion_avatar, app.elemento_avatar,
  app.usuario, app.categoria, app.comunidad
restart identity;

-- Comunidades: una por rango de edad, aisladas entre sí (sección 8).
insert into app.comunidad (rango_edad, nombre, descripcion) values
  ('A', 'Comunidad A', 'Espacio protegido para el rango de 10 a 12 años.'),
  ('B', 'Comunidad B', 'Espacio protegido para el rango de 13 a 15 años.'),
  ('C', 'Comunidad C', 'Espacio protegido para el rango de 16 a 17 años.'),
  ('D', 'Comunidad D', 'Espacio protegido para el rango de 18 a 22 años.');

-- Categorías temáticas de foros y salas (B.4).
insert into app.categoria (codigo, nombre, descripcion, orden) values
  ('bienestar-cotidiano', 'Bienestar cotidiano', 'Hábitos y rutinas que ayudan en el día a día.', 1),
  ('vida-academica', 'Vida académica', 'Estudio, colegio, universidad y organización del tiempo.', 2),
  ('relaciones-convivencia', 'Relaciones y convivencia', 'Amistades, familia y convivencia con otras personas.', 3),
  ('cambios-nuevas-etapas', 'Cambios y nuevas etapas', 'Adaptarse a cambios de colegio, de ciudad o de etapa.', 4),
  ('orientacion', 'Orientación', 'Dudas sobre dónde encontrar información y canales de apoyo.', 5);

-- Usuarios sintéticos (B.7 + Fase 2): al menos uno por rango de edad y uno por rol.
-- Usuario_001 · LunaDemo · comunidad 13–15 es el usuario de B.7. El personal no tiene rango.
insert into app.usuario (codigo, alias, rol, rango_edad, intereses_generales) values
  ('Usuario_001', 'LunaDemo', 'usuario', 'B', '{lectura, música}'),
  ('Usuario_002', 'SolDemo', 'usuario', 'B', '{dibujo}'),
  ('Usuario_003', 'RioDemo', 'usuario', 'A', '{juegos de mesa}'),
  ('Usuario_004', 'NubeDemo', 'usuario', 'C', '{fotografía}'),
  ('Usuario_005', 'MarDemo', 'usuario', 'D', '{deporte}'),
  ('Moderador_001', 'ModeradorDemo', 'moderador', null, '{}'),
  ('Admin_001', 'AdminDemo', 'admin_plataforma', null, '{}'),
  ('Gestor_001', 'GestorDemo', 'gestor_fuentes', null, '{}');

-- Catálogo de avatar (F36, RF21, RF27, RF28): cerrado, gratuito y sin opciones ligadas a la edad.
-- Cada recurso es una clave de un dibujo original hecho por código en el frontend
-- (apps/frontend/src/components/avatar/capas.ts), con estética pixel art propia. No hay imágenes ni URLs.
insert into app.elemento_avatar (id_elemento, tipo, nombre, recurso_grafico, origen, licencia, orden)
select id, tipo, nombre, id,
       'Propio del equipo: pixel art dibujado por código (SVG)', 'Propia del proyecto', orden
from (values
  ('tono-arena', 'personaje', 'Tono arena', 1),
  ('tono-miel', 'personaje', 'Tono miel', 2),
  ('tono-canela', 'personaje', 'Tono canela', 3),
  ('tono-cacao', 'personaje', 'Tono cacao', 4),
  ('cabello-corto', 'cabello', 'Corto', 1),
  ('cabello-largo', 'cabello', 'Largo', 2),
  ('cabello-rizado', 'cabello', 'Rizado', 3),
  ('cabello-recogido', 'cabello', 'Recogido', 4),
  ('rasgos-sonrisa', 'rasgo', 'Sonrisa', 1),
  ('rasgos-tranquilo', 'rasgo', 'Tranquilo', 2),
  ('rasgos-pecas', 'rasgo', 'Pecas', 3),
  ('rasgos-mejillas', 'rasgo', 'Mejillas', 4),
  ('prenda-camiseta', 'prenda', 'Camiseta azul', 1),
  ('prenda-buzo', 'prenda', 'Buzo verde', 2),
  ('prenda-chaqueta', 'prenda', 'Chaqueta coral', 3),
  ('prenda-rayas', 'prenda', 'Camiseta de rayas', 4),
  ('accesorio-gafas', 'accesorio', 'Gafas', 1),
  ('accesorio-gorra', 'accesorio', 'Gorra', 2),
  ('accesorio-audifonos', 'accesorio', 'Audífonos', 3)
) as catalogo (id, tipo, nombre, orden);

-- Una apariencia distinta para cada usuario sintético, combinando el catálogo.
insert into app.configuracion_avatar (id_usuario, id_personaje, id_cabello, id_rasgos, id_prenda, id_accesorio)
select id_usuario,
       (array['tono-arena', 'tono-miel', 'tono-canela', 'tono-cacao'])[1 + n % 4],
       (array['cabello-largo', 'cabello-corto', 'cabello-rizado', 'cabello-recogido'])[1 + n % 4],
       (array['rasgos-sonrisa', 'rasgos-pecas', 'rasgos-tranquilo', 'rasgos-mejillas'])[1 + (n + 1) % 4],
       (array['prenda-buzo', 'prenda-camiseta', 'prenda-rayas', 'prenda-chaqueta'])[1 + (n + 2) % 4],
       (array['accesorio-audifonos', null, 'accesorio-gafas', null, 'accesorio-gorra'])[1 + n % 5]
from (select id_usuario, (row_number() over (order by codigo))::int as n from app.usuario) as u;

-- Salas temáticas predefinidas (F10, RF09): las mismas cinco en cada comunidad, cada una con su
-- escenario de 12 × 8 celdas. Los obstáculos son datos: {x, y, tipo} (planta, mesa, sofa, cojin,
-- estante, caja). Los usuarios no crean salas ni eligen nombres. «Bienestar cotidiano» de la
-- comunidad B es la sala de B.7.
with temas (nombre, categoria, descripcion, obstaculos) as (values
  ('Bienestar cotidiano', 'bienestar-cotidiano',
   'Para conversar sobre hábitos y rutinas que ayudan en el día a día.',
   '[{"x":2,"y":1,"tipo":"planta"},{"x":9,"y":1,"tipo":"planta"},{"x":4,"y":4,"tipo":"cojin"},
     {"x":5,"y":4,"tipo":"mesa"},{"x":6,"y":4,"tipo":"mesa"},{"x":7,"y":4,"tipo":"cojin"},
     {"x":10,"y":6,"tipo":"planta"}]'),
  ('Vida académica', 'vida-academica',
   'Para hablar de estudio, tareas y organización del tiempo.',
   '[{"x":1,"y":0,"tipo":"estante"},{"x":2,"y":0,"tipo":"estante"},{"x":3,"y":0,"tipo":"estante"},
     {"x":6,"y":2,"tipo":"mesa"},{"x":7,"y":2,"tipo":"mesa"},{"x":6,"y":5,"tipo":"mesa"},
     {"x":7,"y":5,"tipo":"mesa"},{"x":10,"y":1,"tipo":"planta"}]'),
  ('Relaciones y convivencia', 'relaciones-convivencia',
   'Para conversar sobre amistades, familia y convivencia.',
   '[{"x":3,"y":2,"tipo":"sofa"},{"x":4,"y":2,"tipo":"sofa"},{"x":5,"y":2,"tipo":"sofa"},
     {"x":4,"y":4,"tipo":"mesa"},{"x":8,"y":5,"tipo":"sofa"},{"x":9,"y":5,"tipo":"sofa"},
     {"x":10,"y":1,"tipo":"planta"}]'),
  ('Cambios y nuevas etapas', 'cambios-nuevas-etapas',
   'Para compartir cómo vivimos los cambios de colegio, de ciudad o de etapa.',
   '[{"x":2,"y":2,"tipo":"caja"},{"x":3,"y":2,"tipo":"caja"},{"x":2,"y":3,"tipo":"caja"},
     {"x":6,"y":0,"tipo":"estante"},{"x":7,"y":0,"tipo":"estante"},{"x":8,"y":4,"tipo":"caja"},
     {"x":9,"y":4,"tipo":"caja"},{"x":10,"y":1,"tipo":"planta"}]'),
  ('Hablar con alguien', 'orientacion',
   'Un espacio tranquilo para conversar con personas de tu comunidad. Si buscas apoyo de una institución, usa «Necesito ayuda».',
   '[{"x":3,"y":3,"tipo":"sofa"},{"x":3,"y":4,"tipo":"sofa"},{"x":5,"y":3,"tipo":"mesa"},
     {"x":5,"y":4,"tipo":"mesa"},{"x":7,"y":3,"tipo":"sofa"},{"x":7,"y":4,"tipo":"sofa"},
     {"x":1,"y":1,"tipo":"planta"},{"x":10,"y":1,"tipo":"planta"}]')
),
salas as (
  insert into app.sala (id_comunidad, id_categoria, nombre, descripcion, reglas)
  select c.id_comunidad, cat.id_categoria, t.nombre, t.descripcion,
         'Trata a todos con respeto. No compartas datos personales, de contacto, ubicaciones ni redes sociales. Los mensajes se revisan antes de mostrarse. Puedes salir cuando quieras.'
  from app.comunidad c
  cross join temas t
  join app.categoria cat on cat.codigo = t.categoria
  returning id_sala, nombre
)
insert into app.escenario_sala (id_sala, ancho, alto, obstaculos, aparicion_x, aparicion_y)
select s.id_sala, 12, 8, t.obstaculos::jsonb, 1, 6
from salas s
join temas t on t.nombre = s.nombre;

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

-- Las fuentes institucionales de demostración se cargan después, desde fuentes_institucionales.json.
