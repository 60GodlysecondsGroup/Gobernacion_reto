# Comunidad Protegida · prototipo

Plataforma digital de orientación y comunidad protegida para jóvenes de Villavicencio (10 a 22 años), en cuatro comunidades aisladas por rango de edad. Es un **prototipo de hackathon** (objetivo TRL 4) que trabaja **solo con datos sintéticos**.

> La plataforma no diagnostica, no evalúa ni predice riesgo, no presta servicios de salud y no es un servicio oficial de ninguna institución.

- Fuente de verdad del producto: [`docs/Documento Maestro…docx`](docs/).
- Decisiones técnicas: [`DECISIONES.md`](DECISIONES.md).
- Modelo de datos: [`docs/MODELO_DE_DATOS.md`](docs/MODELO_DE_DATOS.md).
- Cómo cargar fuentes institucionales reales: [`docs/FUENTES.md`](docs/FUENTES.md).
- Estado: **Fases 1 (entorno), 2 (seguridad base), 3 (orientación y fuentes) y 4 (comunidad) terminadas.** Siguiente: Fase 5, salas interactivas.

## Requisitos

- Node.js **22.12 o superior** (incluye npm 10).
- Una base PostgreSQL. El equipo usa un proyecto de Supabase: pide el `.env` a quien lo administra.

## Puesta en marcha (menos de 5 minutos)

```bash
cp .env.example .env    # completa DATABASE_URL y SESSION_SECRET (o usa el .env del equipo)
npm install             # instala frontend y backend
npm run db:reset        # crea el esquema y carga datos sintéticos, reglas DLP y fuentes de demo
npm run dev             # levanta backend (:4000) y frontend (:3000)
```

Abre <http://localhost:3000>: la tarjeta «Estado del sistema» muestra **backend OK**, la base conectada y los datos sintéticos cargados. Pulsa **Entrar** para elegir un usuario de prueba.

## Acceso de demostración

> **Esto NO es verificación de edad real.** El rango de edad sale del usuario sintético que eliges. Todo el sistema obtiene el rango de un único módulo reemplazable ([`seguridad/rango-edad.ts`](apps/backend/src/modules/seguridad/rango-edad.ts)). El mecanismo definitivo de validación de edad sigue pendiente (sección 8.1 y `DECISIONES.md`).

La pantalla `/acceso` lista los usuarios sintéticos; no hay contraseñas. Solo existe cuando `ACCESO_DEMO=true`, que es el valor por defecto fuera de producción.

| Código          | Alias           | Rol                    | Comunidad              |
| --------------- | --------------- | ---------------------- | ---------------------- |
| `Usuario_003`   | `RioDemo`       | Joven                  | A · 10–12 años         |
| `Usuario_001`   | `LunaDemo`      | Joven (usuario de B.7) | B · 13–15 años         |
| `Usuario_002`   | `SolDemo`       | Joven                  | B · 13–15 años         |
| `Usuario_004`   | `NubeDemo`      | Joven                  | C · 16–17 años         |
| `Usuario_005`   | `MarDemo`       | Joven                  | D · 18–22 años         |
| `Moderador_001` | `ModeradorDemo` | Moderador              | — (no tiene comunidad) |
| `Admin_001`     | `AdminDemo`     | Administrador          | —                      |
| `Gestor_001`    | `GestorDemo`    | Gestor de fuentes      | —                      |

### Demo de la Fase 2 (2 minutos)

1. **Entrar** → `LunaDemo`. Te lleva a la **Comunidad B**. En el buscador, «Demo» solo encuentra a `LunaDemo` y `SolDemo`; nadie de otro rango aparece.
2. Abre <http://localhost:3000/comunidades/C>: «No encontramos esa comunidad». El backend responde exactamente lo mismo que con una comunidad inexistente.
3. **Mi perfil** → en intereses escribe `escríbeme al 3000000000` → **Guardar**. Aparece el mensaje de bloqueo y no se guarda nada.
4. **Salir** → entra como `ModeradorDemo` → **Moderación**: el bloqueo aparece registrado con su categoría y regla, sin el texto y sin el autor.
5. Como joven, abre `/moderacion`: «No tienes acceso». La API responde 403.

### Demo de la Fase 3 (2 minutos)

No hace falta iniciar sesión para orientarse ni para pedir ayuda.

1. **Orientación** → **Líneas y canales de ayuda** → **CanalDemo**. La ficha muestra institución, servicio, información, canal, fuente, fecha de verificación y estado, marcada como «DATO DE DEMOSTRACIÓN».
2. Pulsa **Necesito ayuda** (botón rojo, siempre en el encabezado): canales institucionales con su contacto, fuente y fecha, y el aviso de límites de la plataforma.
3. **Entrar** → `GestorDemo` → **Fuentes**: semáforo con 3 activas, 1 en revisión y 1 inactiva. La inactiva («LíneaDemo anterior») no aparece en Orientación.
4. Abre **CanalDemo** → **Marcar para revisión** con un motivo → **Registrar verificación** con la fecha de hoy. La **Bitácora** muestra ambos cambios con fecha, responsable y motivo.

### Demo de la Fase 4 (3 minutos)

1. **Entrar** → `LunaDemo` → **Mi comunidad**: bienvenida, reglas, accesos a Orientación y Ayuda, categorías y los hilos de la Comunidad B.
2. **Crear hilo** en «Bienestar cotidiano» con `escríbeme al 3000000000` en el contenido → «Hilo bloqueado» con el mensaje estándar, y el texto queda para corregirlo. Quita el número → **Publicar** → «Hilo publicado».
3. **Salir** → `SolDemo` (también de la B) → abre el hilo → responde → la respuesta aparece con su alias y avatar. Pulsa **Reportar** sobre el hilo → elige un motivo → «Tu reporte fue registrado.»
4. **Salir** → `NubeDemo` (Comunidad C): su comunidad solo muestra sus propios hilos, y la URL del hilo de LunaDemo responde «No encontramos ese hilo en tu comunidad».
5. **Reglas de la comunidad** (en el pie de todas las páginas) se pueden consultar en cualquier momento.

## Comandos

| Comando                              | Qué hace                                                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `npm install`                        | Instala las dos aplicaciones (npm workspaces).                                                                          |
| `npm run dev`                        | Levanta backend y frontend a la vez, con recarga automática.                                                            |
| `npm run db:reset`                   | **Reinicia los datos de demo**: borra el esquema `app`, aplica las migraciones y carga el seed.                         |
| `npm run db:migrate`                 | Aplica solo las migraciones pendientes.                                                                                 |
| `npm run db:seed`                    | Vacía las tablas y recarga datos sintéticos, reglas DLP y fuentes de demo (sin tocar el esquema).                       |
| `npm run fuentes:cargar`             | Sincroniza las fuentes con `db/seed/fuentes_institucionales.json` sin tocar el resto (ver `docs/FUENTES.md`).           |
| `npm test`                           | Pruebas unitarias y de humo del backend (DLP, permisos, sesión, guardianes). Sin red ni base de datos.                  |
| `npm run test:db`                    | Integración contra la base del `.env`: TRL-01 a 06, 09, 10 y 12, DLP, reportes y permisos por HTTP. Deja la base igual. |
| `npm run lint` / `npm run typecheck` | ESLint y TypeScript en las dos aplicaciones.                                                                            |
| `npm run format` / `format:check`    | Prettier.                                                                                                               |
| `npm run verificar`                  | Formato + lint + tipos + pruebas: lo que debe pasar antes de cerrar una fase.                                           |

## API

Todo bajo `/api`. Los errores tienen la forma `{ error: { codigo, mensaje, detalles? } }`.

| Ruta                                              | Quién                       | Qué hace                                                                                        |
| ------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET /salud`                                      | Cualquiera                  | Estado del backend, de la base y conteo de datos de demo.                                       |
| `GET /sesion`                                     | Cualquiera                  | Sesión actual (`usuario: null` si no hay).                                                      |
| `POST /sesion`, `DELETE /sesion`                  | Solo modo demo / cualquiera | Entrar como usuario sintético (`{ codigo }`) / salir.                                           |
| `GET /sesion/usuarios-demo`                       | Solo modo demo              | Usuarios para el selector de acceso.                                                            |
| `GET /comunidad`, `GET /comunidades`              | Con comunidad               | La comunidad propia. La lista solo la contiene a ella.                                          |
| `GET /comunidades/:id-o-A-D`                      | Con comunidad               | La propia, o 404 idéntico al de una inexistente.                                                |
| `GET /perfil`, `PUT /perfil`                      | Con sesión                  | Perfil propio: alias, intereses y personaje del catálogo. Todo texto pasa por el DLP.           |
| `GET /perfiles?buscar=`, `GET /perfiles/:id`      | Con comunidad               | Búsqueda y perfiles, solo de la misma comunidad.                                                |
| `GET /moderacion/incidencias-dlp`                 | Moderación y administración | Bloqueos DLP por categoría y recientes, sin texto ni autor (F35).                               |
| `GET /comunidad/categorias`                       | Con comunidad               | Las cinco categorías, con el número de hilos de la comunidad propia.                            |
| `GET /comunidad/hilos?categoria=&buscar=&pagina=` | Con comunidad               | Hilos de la comunidad propia, de 10 en 10, por última actividad.                                |
| `POST /comunidad/hilos`                           | Jóvenes y administración    | Crear hilo (`{ categoria, titulo, contenido }`). Pasa por el DLP.                               |
| `GET /comunidad/hilos/:id`                        | Con comunidad               | Hilo con sus respuestas. De otra comunidad: 404 idéntico al de uno inexistente.                 |
| `POST /comunidad/hilos/:id/respuestas`            | Con comunidad               | Responder (`{ contenido }`). Pasa por el DLP. Un hilo cerrado responde 409.                     |
| `POST /reportes`                                  | Con comunidad               | Reportar hilo, respuesta o perfil de la propia comunidad. Responde «Tu reporte fue registrado.» |
| `GET /orientacion/necesidades`                    | Cualquiera, sin sesión      | Las seis necesidades del navegador, con cuántos servicios tiene cada una.                       |
| `GET /orientacion/necesidades/:codigo`            | Cualquiera, sin sesión      | Servicios activos o en revisión de esa necesidad.                                               |
| `GET /orientacion/servicios/:id`                  | Cualquiera, sin sesión      | Ficha del servicio. Una fuente inactiva responde 404.                                           |
| `GET /orientacion/ayuda`                          | Cualquiera, sin sesión      | Canales de «Necesito ayuda».                                                                    |
| `GET`/`POST /gestion/fuentes`                     | Gestor y administración     | Semáforo y lista / crear una fuente (con fecha de verificación).                                |
| `GET`/`PUT /gestion/fuentes/:id`                  | Gestor y administración     | Detalle con bitácora / editar datos.                                                            |
| `POST /gestion/fuentes/:id/revision`              | Gestor y administración     | Marcar para revisión (`{ motivo }`).                                                            |
| `POST /gestion/fuentes/:id/verificacion`          | Gestor y administración     | Verificar (`{ fecha?, observacion? }`); vuelve a Activo.                                        |
| `POST /gestion/fuentes/:id/desactivacion`         | Gestor y administración     | Desactivar (`{ motivo }`).                                                                      |

## Estructura

```
apps/
  backend/                      Node.js 22 + Express 5 (TypeScript, ejecutado con tsx)
    db/migraciones/             SQL numerado: 0001_esquema_inicial.sql, 0002_…
    db/seed/datos_demo.sql      Datos sintéticos (Anexo B.7 + usuarios por rango y rol)
    db/seed/reglas_dlp.json     Reglas DLP predeterminadas que el seed carga en app.regla_dlp
    db/seed/fuentes_institucionales.json  Fuentes de demostración: el archivo que el equipo reemplaza
    scripts/db.ts               migrar | sembrar | reiniciar
    scripts/fuentes.ts          Sincroniza las fuentes con su archivo de carga
    src/
      app.ts                    Construye la app HTTP (sin abrir puerto; la usan las pruebas)
      server.ts                 Arranque, conexión a la base y apagado ordenado
      config/env.ts             Lee el .env de la raíz y valida variables con zod
      db/                       Pool de PostgreSQL y ejecutor de migraciones y seed
      http/                     Errores, validación, verificación de origen y registro
      modules/
        sistema/                GET /api/salud
        seguridad/              Sesión, rango de edad (reemplazable) y matriz de permisos A.2
        dlp/                    Analizador, reglas en datos, eventos y servicio reutilizable
        comunidad/              Comunidad propia, categorías, hilos y respuestas (siempre filtrados por la sesión)
        reportes/               Reportes de hilos, respuestas y perfiles
        perfil/                 Perfil protegido y búsqueda dentro de la comunidad
        moderacion/             Incidencias DLP
        fuentes/                Gestión de fuentes: esquemas, ciclo de vida, bitácora y carga
        orientacion/            Navegador público y «Necesito ayuda»
    test/                       Unitarias y humo (sin red) e integracion/ (base real)
  frontend/                     Next.js 16 (App Router) + React 19
    src/
      app/                      Páginas: inicio, acceso, orientación, ayuda, comunidad e hilos, reglas, perfil, moderación, fuentes
      components/ui/            Componentes base: Aviso, Boton, BotonEnlace, Tarjeta, CampoTexto, CampoSeleccion, Insignia
      components/sesion/        Contexto de sesión, guardián de páginas y selector de acceso
      components/…              Orientación, fuentes, comunidad, perfil, moderación, avatar y layout
      config/textos.ts          Aviso de límites (texto exacto de la sección 18.1)
      config/navegacion.ts      Menú principal (cada enlace declara el permiso que necesita)
      lib/api/                  Cliente HTTP centralizado y llamadas por módulo
      styles/tokens.css         Tokens de diseño (paleta, tipografía, espaciado)
docs/                           Documento maestro, modelo de datos y guía de carga de fuentes
```

## Seguridad base (Fase 2)

- **Sesión:** cookie `HttpOnly` y `SameSite=Lax`, firmada con HMAC (`SESSION_SECRET`), válida por 8 horas. En cada solicitud, el rol, el rango y el estado se leen de la base: si una cuenta se suspende, pierde el acceso de inmediato. Las escrituras que llegan desde otro origen se rechazan.
- **Segmentación:** la comunidad sale **siempre** del rango de la sesión, nunca de lo que envía el cliente. Pedir una comunidad, un perfil o una búsqueda de otro rango da una respuesta idéntica a la de algo inexistente. La base lo refuerza con un disparador.
- **Permisos:** la matriz A.2 está en [`seguridad/permisos.ts`](apps/backend/src/modules/seguridad/permisos.ts), con un guardián `requerirPermiso(...)`. El frontend oculta lo que no corresponde, pero quien decide es el backend.
- **DLP:** `crearServicioDlp().revisar(texto, { tipoContenido, idUsuario })` sirve para perfiles, hilos, respuestas y salas. Las reglas son expresiones regulares en `app.regla_dlp` y se activan o desactivan sin tocar código; se escriben en minúsculas y sin tildes, porque el texto se normaliza antes de compararlo. Un bloqueo devuelve 422 con el mensaje estándar y el campo afectado, sin repetir el dato. Cada bloqueo registra un evento en `app.evento_dlp` sin el texto. Hay un punto de extensión (`clasificadores`) para un clasificador futuro. **No detecta todas las formas posibles de compartir información.**
- **Perfil protegido:** solo alias, intereses generales y un personaje del catálogo. Cualquier otro campo, como la edad, el rango o datos de contacto, se rechaza.

## Orientación y fuentes (Fase 3)

- **Navegador (F04–F06):** seis necesidades que sirven para buscar información, no para evaluar a nadie: no hay preguntas, puntajes ni mensajes de diagnóstico o riesgo. Cada servicio muestra institución, servicio o canal, información, canal, fuente, fecha de verificación y estado.
- **Estados:** solo se muestran las fuentes activas y las que están en revisión (con un aviso para confirmar en la fuente original). Las inactivas no aparecen como opción.
- **«Necesito ayuda» (F18):** botón fijo en el encabezado de todas las páginas, con o sin sesión. Lleva en un paso a los canales de `lineas_ayuda` y `hablar_con_alguien`, con su contacto visible. La plataforma no crea protocolos de crisis propios.
- **Límites (18.1):** el texto exacto aparece en el pie de todas las páginas y en Orientación y Ayuda.
- **Gestión (F32–F34):** el gestor de fuentes y la administración pueden crear, editar, marcar para revisión, verificar con fecha y desactivar. Cada cambio queda en una bitácora de solo inserción con estado anterior y nuevo, responsable, fecha, motivo y los campos modificados. El panel tiene un semáforo verde, amarillo y rojo.
- **Datos:** solo registros de demostración (`esDemo`). Se muestran como tales y sin enlaces ni llamadas activas. Las fuentes reales se cargan sin tocar código: [`docs/FUENTES.md`](docs/FUENTES.md).

## Comunidad (Fase 4)

- **Inicio de comunidad (F03):** bienvenida, reglas, accesos a Orientación y «Necesito ayuda», categorías con su número de hilos, hilos recientes con búsqueda y «Ver más», y el buscador de personas.
- **Hilos y respuestas (F07–F09):** el título y el contenido pasan por el DLP antes de guardarse. Si algo se bloquea, no se guarda, aparece el mensaje estándar («Hilo bloqueado») y el texto queda para editarlo. Cada contenido muestra autor (alias y avatar), fecha y «Reportar», nunca la edad ni datos de contacto.
- **Aislamiento:** listar, buscar, abrir, responder o reportar contenido de otra comunidad responde como si no existiera. La comunidad sale de la sesión: el cliente no puede enviarla.
- **Reportes (F19, F20):** en hilos, respuestas y perfiles ajenos. Seis motivos y un detalle opcional, que también pasa por el DLP. La confirmación es siempre «Tu reporte fue registrado.» y no informa qué se hará con la otra persona. Repetir un reporte abierto no crea otro. La revisión llega en la Fase 7.
- **Reglas (F24):** `/reglas`, pública y enlazada en el pie de todas las páginas: privacidad, convivencia, información no permitida, reportes, límites y orientación.

## Cómo crece en las siguientes fases

- **Backend:** cada área del producto es un módulo en `apps/backend/src/modules/<modulo>/` con `*.routes.ts`, `*.service.ts` y `*.repository.ts`, registrado en `src/app.ts`. Una ruta nueva usa `requerirPermiso(...)`. Si es comunitaria, obtiene el rango con `exigirRango(sesion)`, y todo texto de usuarios pasa por `dlp.exigirPermitido(...)` antes de guardarse. Módulos previstos: `salas` (Fase 5), `avatar` (Fase 6) y `administracion` (Fase 7).
- **Base de datos:** el esquema completo de B.4 ya existe. Un cambio de estructura es una migración nueva `000N_descripcion.sql`; los datos de demostración se agregan en `db/seed/`.
- **Frontend:** las páginas privadas se envuelven en `<RequiereSesion permiso="…">`. Las llamadas van en `src/lib/api/<modulo>.ts` y los enlaces del menú en `src/config/navegacion.ts`. La interfaz se arma con `src/components/ui` y los tokens (ver `/guia-de-estilos`).
- Toda decisión técnica nueva se registra en una línea en `DECISIONES.md`.

## Base de datos

- PostgreSQL en Supabase, esquema propio **`app`**. La API pública de Supabase no lo expone y los roles `anon`/`authenticated` no tienen permisos: **el backend es el único acceso a los datos**. El frontend no usa las claves de Supabase.
- `db:reset` solo borra el esquema `app`; no toca nada más del proyecto de Supabase.
- Datos sintéticos: 4 comunidades, 5 categorías, 8 usuarios de prueba (tabla de arriba), 3 personajes provisionales, la sala «Bienestar cotidiano», 5 hilos (uno por comunidad y dos en la B) con una respuesta, 19 reglas DLP y 5 fuentes institucionales de demostración (`InstituciónDemo · CanalDemo` y otras; 3 activas, 1 en revisión y 1 inactiva).
- Reglas que la propia base garantiza, además del backend: segmentación por edad en hilos, respuestas y salas; máximo 10 participantes por sala; bitácora de fuentes y auditoría de solo inserción; ninguna columna de edad exacta.

## Seguridad y restricciones

- El `.env` real nunca se versiona; `.env.example` solo tiene marcadores.
- Solo datos sintéticos. Ninguna institución, teléfono ni enlace real: las fuentes reales las investiga y verifica el equipo, y las carga con `npm run fuentes:cargar` (ver `docs/FUENTES.md`).
- Los logs y los eventos DLP no guardan contenido escrito por usuarios.
- **Pendiente y documentado en `DECISIONES.md`:** la verificación de edad real (hoy es provisional), las fuentes institucionales verificadas y el mecanismo de auditoría definitivo.
- Solo ejecución local. No se despliega ni se publica nada.
