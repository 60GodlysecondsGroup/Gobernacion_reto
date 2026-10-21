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

-- Personajes base provisionales (el catálogo completo llega en la Fase 6). Recursos originales.
insert into app.elemento_avatar (id_elemento, tipo, nombre, recurso_grafico, origen, licencia) values
  ('base-azul', 'personaje', 'Personaje base azul (provisional)', 'base-azul',
   'Propio del equipo, dibujado por código', 'Propia del proyecto'),
  ('base-verde', 'personaje', 'Personaje base verde (provisional)', 'base-verde',
   'Propio del equipo, dibujado por código', 'Propia del proyecto'),
  ('base-coral', 'personaje', 'Personaje base coral (provisional)', 'base-coral',
   'Propio del equipo, dibujado por código', 'Propia del proyecto');

insert into app.configuracion_avatar (id_usuario, id_personaje)
select id_usuario,
       (array['base-azul', 'base-verde', 'base-coral'])[1 + (row_number() over (order by codigo))::int % 3]
from app.usuario;

-- Sala temática de B.7 en la comunidad B.
insert into app.sala (id_comunidad, id_categoria, nombre, descripcion, reglas)
select c.id_comunidad, cat.id_categoria, 'Bienestar cotidiano',
       'Sala para conversar sobre hábitos y rutinas que ayudan en el día a día.',
       'Trata a todos con respeto. No compartas datos personales, de contacto ni redes sociales. Puedes salir cuando quieras.'
from app.comunidad c
join app.categoria cat on cat.codigo = 'bienestar-cotidiano'
where c.rango_edad = 'B';

-- Las fuentes institucionales de demostración se cargan después, desde fuentes_institucionales.json.
