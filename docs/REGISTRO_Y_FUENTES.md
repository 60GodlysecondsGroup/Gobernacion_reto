# Registro de retroalimentación, cambios y fuentes

**Proyecto:** Comunidad Protegida · prototipo para Villavicencio  
**Fecha de corte y verificación documental:** 2026-10-22  
**Alcance:** registro de decisiones y cambios que pueden rastrearse en el repositorio, y fuentes institucionales consultadas. El prototipo es una demostración con datos sintéticos; no es un servicio oficial ni presta atención clínica.

## Cómo se registró la retroalimentación

En el repositorio no se encontró una bitácora de entrevistas, encuestas, pruebas con jóvenes ni comentarios textuales de usuarios. Por eso, este documento no atribuye opiniones a participantes. La retroalimentación trazable disponible son requisitos del producto, decisiones consignadas en `DECISIONES.md`, documentación funcional y evidencia de validación controlada en `EVIDENCIAS/`. Los cambios siguientes resumen esas decisiones y el estado visible del producto al corte.

| Observación / requisito registrado | Cambio realizado | Evidencia en el repositorio |
| --- | --- | --- |
| La orientación debe mostrar la procedencia y vigencia de la información; no se deben presentar contactos ficticios como reales. | Se creó un directorio de orientación con estado, fuente original y fecha de verificación. Los registros actuales llevan `esDemo: true`, se rotulan como datos de demostración y no activan llamadas o enlaces. Se añadió gestión, revisión, desactivación y bitácora de cambios. | `apps/backend/db/seed/fuentes_institucionales.json`, `docs/FUENTES.md`, `apps/backend/src/modules/fuentes/`, `EVIDENCIAS/capturas/TRL-09-ficha-con-fuente-y-fecha.png`, `TRL-10-necesito-ayuda.png`, `TRL-12-bitacora-fuente.png`. |
| La comunidad debe preservar privacidad y separar espacios por grupos de edad. | Se implementaron comunidades separadas, permisos, sesión de demostración y validaciones de acceso en la API. La selección de usuario es sintética y no verifica edad real. | `DECISIONES.md` (secciones de acceso y rango de edad), `docs/MODELO_DE_DATOS.md`, `EVIDENCIAS/MATRIZ.md`. |
| Los aportes de texto y las interacciones comunitarias necesitan controles y moderación. | Se añadieron reglas DLP, reportes, acciones de moderación, administración de salas y registro de auditoría. Las validaciones registradas se hicieron con datos sintéticos. | `README.md` (funciones y comandos), `EVIDENCIAS/MATRIZ.md`, `EVIDENCIAS/RESTRICCIONES.md`. |
| La personalización debe evitar que se carguen fotos o contenido libre de terceros. | Se creó un catálogo cerrado de capas de avatar con recursos dibujados por código; el backend valida identificadores del catálogo y no ofrece carga de imágenes. | `apps/frontend/src/components/avatar/capas.ts`, `apps/backend/db/seed/datos_demo.sql`, `DECISIONES.md` (decisiones de avatar), capturas `AV-01` a `AV-12`. |
| La interfaz debe ser clara, adaptable y usable con movimiento reducido, y debe evitar una apariencia institucional o clínica. | Se adoptó la marca original «Refugio», navegación adaptable, estados comunes, tipografías locales y movimiento reducido. Los datos de demo y límites del producto se hacen explícitos. | `DECISIONES.md` (rediseño de interfaz), `README.md`, `apps/frontend/public/marca/`, `apps/frontend/src/app/fuentes/`. |
| Las funciones de IA deben limitarse y proteger la clave del proveedor. | Se añadió un asistente administrativo con consultas agregadas y uno de orientación con contexto acotado; las claves permanecen en backend. Algunos mensajes se envían al servicio OpenAI cuando se consulta el asistente. | `README.md` (secciones de asistentes), `apps/backend/src/modules/asistente/`, `apps/backend/src/modules/asistente-usuario/`. |

Las validaciones declaradas en la matriz son pruebas controladas del prototipo. No demuestran eficacia clínica, seguridad para despliegue real ni aceptación por parte de la población objetivo. Antes de cualquier piloto deben incorporarse retroalimentación real, autorizada y documentada, y revisión de los responsables institucionales.

## Fuentes institucionales verificadas

Consultadas en sitios oficiales el **2026-10-22**. La verificación confirma que las páginas oficiales consultadas publican la información resumida; no confirma una llamada de prueba ni sustituye la verificación operativa antes de activar un canal en el producto.

| Entidad / recurso | Información que publica la fuente | Verificación y uso previsto |
| --- | --- | --- |
| Instituto Colombiano de Bienestar Familiar (ICBF), [Línea 141](https://www.icbf.gov.co/linea-141) | Línea nacional gratuita de protección, emergencia y orientación para niñas, niños y adolescentes; el sitio indica disponibilidad 24 horas. | **Verificada 2026-10-22.** Fuente oficial nacional pertinente para el público joven. Aún no está cargada en los datos del prototipo; requiere aprobación del responsable del producto antes de incorporarla. |
| Ministerio de Salud y Protección Social, [Línea 106](https://www.minsalud.gov.co/salud/publica/salud-mental/Paginas/linea-106.aspx) | Orientación nacional en salud mental; el sitio indica llamada desde fijo o celular, gratuidad, confidencialidad y operación 24/7, e incluye directorio territorial. | **Verificada 2026-10-22.** La página advierte que también hay líneas territoriales. Confirmar cobertura y ruta local para Villavicencio antes de presentarla como canal local o recurso de emergencia. |
| Alcaldía de Villavicencio, [«Yo te escucho», línea de apoyo emocional](https://villavicencio.gov.co/yo-te-escucho-la-linea-de-apoyo-emocional-que-sigue-salvando-vidas-en-villavicencio/) | Publicación fechada 2025-02-26 que menciona el número 01800 093 108 y WhatsApp 316 390 7010 para el programa municipal. | **Página consultada 2026-10-22; vigencia operativa NO confirmada.** Por la antigüedad de la publicación, no copiar números, horarios ni disponibilidad a la aplicación sin confirmación directa de la Alcaldía o la ESE Municipal. |

### Estado de las fuentes cargadas

El archivo `apps/backend/db/seed/fuentes_institucionales.json` contiene cinco registros ficticios (`InstituciónDemo`, `CanalDemo`, etc.), todos con `esDemo: true`. Sus fechas de verificación son fechas de demostración, no fechas en que se comprobó un recurso real. La palabra «fuente» en esos registros identifica el origen ficticio del dato y no una fuente institucional oficial. No se cargaron en el producto los contactos oficiales de la tabla anterior.

Al incorporar un servicio real, registrar en cada ficha la entidad, el nombre exacto del servicio, el canal y horario publicados, la URL oficial, fecha de consulta, estado de vigencia y responsable que lo verificó. No inferir datos ausentes ni combinar información de páginas distintas sin dejar trazabilidad. Usar `npm run fuentes:cargar` según el procedimiento de [`FUENTES.md`](FUENTES.md), y conservar en la bitácora el motivo y los cambios.

## Documentación oficial adicional consultada

| Fuente | Para qué se consultó | Fecha |
| --- | --- | --- |
| [ICBF — Línea 141](https://www.icbf.gov.co/linea-141) | Validar la publicación institucional del recurso nacional para niñas, niños y adolescentes. | 2026-10-22 |
| [MinSalud — Línea 106](https://www.minsalud.gov.co/salud/publica/salud-mental/Paginas/linea-106.aspx) | Validar el recurso nacional y su referencia a líneas territoriales. | 2026-10-22 |
| [Alcaldía de Villavicencio — «Yo te escucho»](https://villavicencio.gov.co/yo-te-escucho-la-linea-de-apoyo-emocional-que-sigue-salvando-vidas-en-villavicencio/) | Identificar una referencia municipal y dejar constancia de que el dato requiere reconfirmación operativa. | 2026-10-22 |

