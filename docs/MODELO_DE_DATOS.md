# Modelo de datos

Este es el modelo definitivo del prototipo. Convierte el modelo conceptual B.4 del Documento Maestro en tablas de PostgreSQL, dentro del esquema `app`.

- Fuente: las migraciones de [`db/migraciones/`](../apps/backend/db/migraciones/), de `0001_esquema_inicial.sql` a `0005_moderacion_administracion.sql`.
- Datos de demostración: [`datos_demo.sql`](../apps/backend/db/seed/datos_demo.sql), [`reglas_dlp.json`](../apps/backend/db/seed/reglas_dlp.json) y [`fuentes_institucionales.json`](../apps/backend/db/seed/fuentes_institucionales.json).

**Cambios de la migración 0005 (Fase 7):** no borra ni reescribe datos; solo agrega columnas con valor por defecto, índices y restricciones.

- `sala.habilitada` (boolean, por defecto `true`): la administración puede deshabilitar una sala sin borrarla (F29). Una sala deshabilitada no se lista para jóvenes y su `UPDATE` de ocupación exige `habilitada`. Al cerrarse por inactividad, la instancia nueva hereda el valor.
- `reporte.resolucion`: resultado de la revisión, de una lista cerrada (`sin_accion`, `contenido_oculto`, `usuario_suspendido`, `sala_deshabilitada`). No hay notas libres, para no acumular texto con posibles datos personales.
- Índices `reporte_contenido` y `registro_auditoria_entidad` para el panel.
- `registro_auditoria.accion` con formato `^[a-z_]{3,60}$` y `fecha` con `clock_timestamp()` (orden real de varias acciones en una transacción).

**Cambios de la migración 0004 (Fase 6):** `elemento_avatar.orden`, el CHECK que impide URL en `recurso_grafico` y el disparador que exige que cada capa del avatar apunte a un elemento de su tipo.

**Cambios de la migración 0003 (Fase 4):**

- `reporte_abierto_unico`: índice único parcial que impide que un usuario tenga dos reportes abiertos (pendientes o en revisión) sobre el mismo contenido.
- `evento_dlp.tipo_contenido` admite `reporte`: el detalle opcional de un reporte también pasa por el DLP.
- `hilo_comunidad_categoria`: índice para listar hilos de una comunidad por categoría.

**Cambios de la migración 0002 (Fase 3):**

- `necesidad_orientacion.descripcion`: texto breve y neutral de cada tema del navegador.
- `fuente_institucional.codigo`: clave estable y única que usa el archivo de carga.
- `bitacora_fuente.cambios` (jsonb): `{campo: {antes, despues}}` de cada modificación. Además, `fecha` pasa a usar `clock_timestamp()` para ordenar varios cambios hechos en una misma transacción.

No existen campos de salud, diagnóstico, evaluación psicológica ni edad exacta.

## Entidades de B.4

| Entidad B.4          | Tabla                  | Notas                                                                                                                                                                                              |
| -------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| USUARIO              | `usuario`              | Agrega `rol` (A.2) y `codigo` (identificador sintético legible). Solo `rango_edad`, nunca la edad. El usuario joven debe tener rango. El alias es único sin distinguir mayúsculas.                 |
| COMUNIDAD            | `comunidad`            | `rango_edad` es único: un rango corresponde a una comunidad y viceversa.                                                                                                                           |
| CATEGORIA            | `categoria`            | Agrega `codigo` (un slug estable) y `orden`.                                                                                                                                                       |
| HILO                 | `hilo`                 | Título de 3 a 120 caracteres, contenido de hasta 5000. Estados: activo, oculto, cerrado.                                                                                                           |
| RESPUESTA            | `respuesta`            | Estados: publicada, bloqueada, oculta. Un mensaje que el DLP bloquea no se guarda.                                                                                                                 |
| SALA                 | `sala`                 | Agrega `id_categoria` (RF09) y `vacia_desde` (el contador de F13). Cada fila es una instancia: una sala cerrada no se reabre y se crea otra del mismo tema.                                        |
| PARTICIPACION_SALA   | `participacion_sala`   | Un usuario no puede tener dos participaciones abiertas en la misma sala.                                                                                                                           |
| ESCENARIO_SALA       | `escenario_sala`       | Cuadrícula `ancho × alto`, `obstaculos` como objetos `{x, y, tipo}` (Fase 5; `tipo` elige el mueble dibujado) y punto de aparición dentro del área. Al cerrarse una instancia se copia a la nueva. |
| POSICION_AVATAR_SALA | `posicion_avatar_sala` | La clave es `(id_sala, id_usuario)`. Es estado de sesión.                                                                                                                                          |
| CONFIGURACION_AVATAR | `configuracion_avatar` | Solo claves foráneas al catálogo; el personaje base es obligatorio. Un disparador (0004) exige que cada capa apunte a un elemento de su tipo.                                                      |
| ELEMENTO_AVATAR      | `elemento_avatar`      | Catálogo cerrado. `recurso_grafico` es la clave de un recurso dibujado por código, nunca una URL (un CHECK lo garantiza desde 0004). Incluye `origen`, `licencia` y `orden` (0004).                |
| REPORTE              | `reporte`              | Agrega `id_comunidad`, `id_revisor` y `resolucion` (0005). Estados de F30: pendiente, en_revision, resuelto, descartado.                                                                           |
| REGLA_DLP            | `regla_dlp`            | `patron` es una expresión regular. Su `categoria` apunta a `categoria_dlp`.                                                                                                                        |
| EVENTO_DLP           | `evento_dlp`           | Solo metadatos. No guarda el texto del mensaje (B.5).                                                                                                                                              |
| FUENTE_INSTITUCIONAL | `fuente_institucional` | `fecha_verificacion` es obligatoria. Agrega `es_demo` (para mostrar «DATO DE DEMOSTRACIÓN») e `id_responsable`. El enlace debe empezar por http(s).                                                |
| BITACORA_FUENTE      | `bitacora_fuente`      | Solo inserción. Acciones: crear, actualizar, marcar_revision, verificar, desactivar.                                                                                                               |

## Tablas añadidas

| Tabla                   | Para qué                                                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rango_edad`            | Catálogo fijo A (10–12), B (13–15), C (16–17) y D (18–22). Se crea en la migración, no en el seed.                                                   |
| `categoria_dlp`         | Las seis categorías de protección de 16.1 y B.5.                                                                                                     |
| `necesidad_orientacion` | Las seis necesidades del navegador de orientación (F04). Son categorías de búsqueda, no de evaluación.                                               |
| `fuente_necesidad`      | Relaciona cada fuente con las necesidades en las que aparece.                                                                                        |
| `registro_auditoria`    | Acciones administrativas: quién, qué y cuándo (Fase 7). Solo inserción. Cada acción se escribe en la misma sentencia SQL que el cambio que registra. |
| `migraciones`           | Migraciones aplicadas. La gestiona el ejecutor de migraciones.                                                                                       |

## Reglas que garantiza la base de datos

El backend es la barrera principal. Estas reglas son una defensa adicional:

| Regla                                    | Mecanismo                                                                                                                           |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Segmentación por edad (RF01, RF02, RF23) | El disparador `verificar_segmentacion` rechaza, con error `42501`, que un usuario joven publique o entre a salas de otra comunidad. |
| Máximo 10 participantes (RF10)           | `CHECK (capacidad_maxima between 1 and 10)` y `CHECK (usuarios_actuales between 0 and capacidad_maxima)`.                           |
| Trazabilidad de fuentes (TRL-12)         | `bitacora_fuente` y `registro_auditoria` rechazan UPDATE y DELETE.                                                                  |
| Sin edad exacta                          | No existe la columna. Una prueba de integración lo verifica.                                                                        |
| Avatar sin texto libre (RF21, RF22)      | La configuración solo admite claves del catálogo.                                                                                   |
| Fuente con fecha de verificación (B.6)   | `fecha_verificacion not null`.                                                                                                      |
| Fecha de actualización                   | Un disparador la actualiza en todas las tablas que tienen `fecha_actualizacion`.                                                    |
| Acceso                                   | El esquema `app` no se expone por la API pública de Supabase. `anon` y `authenticated` no tienen permisos.                          |
