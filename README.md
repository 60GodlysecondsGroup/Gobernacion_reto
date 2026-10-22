# Comunidad Protegida · prototipo

Plataforma digital de orientación y comunidad protegida para jóvenes de Villavicencio (10 a 22 años), en cuatro comunidades aisladas por rango de edad. Es un **prototipo de hackathon** (objetivo TRL 4) que trabaja **solo con datos sintéticos**.

> La plataforma no diagnostica, no evalúa ni predice riesgo, no presta servicios de salud y no es un servicio oficial de ninguna institución.

- Fuente de verdad del producto: [`docs/Documento Maestro…docx`](docs/).
- Decisiones técnicas: [`DECISIONES.md`](DECISIONES.md).
- Modelo de datos: [`docs/MODELO_DE_DATOS.md`](docs/MODELO_DE_DATOS.md).
- Cómo cargar fuentes institucionales reales: [`docs/FUENTES.md`](docs/FUENTES.md).
- Arquitectura en una página: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).
- Guion de la demo (7 minutos): [`DEMO.md`](DEMO.md).
- Validación TRL 4: [`EVIDENCIAS/MATRIZ.md`](EVIDENCIAS/MATRIZ.md) (24 de 24 escenarios aprobados, con capturas y registros) y [`EVIDENCIAS/RESTRICCIONES.md`](EVIDENCIAS/RESTRICCIONES.md).
- Estado: **Fases 1 a 9 terminadas** (la 8 es opcional y se completó entera). Las funciones críticas se validaron en condiciones controladas con datos sintéticos; ver los límites de esa validación en la matriz.

## Requisitos

- Node.js **22.12 o superior** (incluye npm 10 u 11).
- Una base PostgreSQL. El equipo usa un proyecto de Supabase: pide el `.env` a quien lo administra.

## Puesta en marcha (menos de 5 minutos)

```bash
cp .env.example .env    # completa DATABASE_URL y SESSION_SECRET (o usa el .env del equipo)
npm install             # instala frontend y backend
npm run db:reset        # crea el esquema y carga datos sintéticos, reglas DLP y fuentes de demo
npm run dev             # levanta backend (:4000) y frontend (:3000)
```

**Sin base de datos propia:** `npm install` y luego `npm run dev:local`. Inicia un PostgreSQL local empaquetado en npm (carpeta `.postgres-local/`, ignorada por git), aplica las migraciones, carga los datos sintéticos y levanta backend y frontend apuntando a él, sin tocar el `.env`. Para volver a los datos iniciales: `npm run db:reset:local` (con la base local en marcha).

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

El guion completo de la presentación está en [`DEMO.md`](DEMO.md). Las demos por fase siguen sirviendo para ensayar cada parte.

### Demo de la Fase 2 (2 minutos)

1. **Entrar** → `LunaDemo`. Te lleva a la **Comunidad B**. En el buscador, «Demo» solo encuentra a `LunaDemo` y `SolDemo`; nadie de otro rango aparece.
2. Abre <http://localhost:3000/comunidades/C>: «No encontramos esa comunidad». El backend responde exactamente lo mismo que con una comunidad inexistente.
3. **Mi perfil** → en intereses escribe `escríbeme al 3000000000` → **Guardar**. Aparece el mensaje de bloqueo y no se guarda nada.
4. **Salir** → entra como `ModeradorDemo` → **Panel** → **Incidencias DLP**: el bloqueo aparece registrado con su categoría y regla, sin el texto y sin el autor.
5. Como joven, abre `/panel` (o la ruta anterior `/moderacion`): «No tienes acceso». La API responde 403.

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

### Demo de la Fase 5 (4 minutos, dos navegadores)

La sesión es una cookie, así que dos pestañas del mismo navegador son la misma persona. Para tener a dos personas usa **dos navegadores** o una ventana normal y otra **de incógnito**. Para la demo del cierre automático puedes poner `SALA_CIERRE_SEGUNDOS=30` en el `.env` (por defecto son 180).

1. **Navegador 1** → **Entrar** → `LunaDemo` → **Salas**: las cinco salas temáticas de la Comunidad B con su ocupación. Abre **Bienestar cotidiano**: la antesala muestra tema, reglas y `0/10`. **Entrar a la sala**.
2. **Navegador 2** → `SolDemo` → **Salas** → **Bienestar cotidiano** → **Entrar**. Cada una ve a la otra en el escenario y en la lista (`2/10`).
3. Muévete con **W A S D**: la otra pantalla ve el movimiento. Camina contra el cojín o la mesa del centro («Hay un mueble en esa dirección.») y contra el borde («Llegaste al borde de la sala.»). Mientras escribes en el chat, las teclas no mueven el avatar.
4. **Chat:** SolDemo escribe «Hola» y aparece en las dos pantallas. LunaDemo escribe `escríbeme al 3000000000`: solo ella ve «Tu mensaje no se envió» y su texto queda en el campo; SolDemo no recibe nada.
5. **Capacidad:** en una terminal, `npm run salas:simular -- --cantidad 8` llena la sala (`10/10`, con avatares que se mueven solos). En otra, `npm run salas:simular -- --cantidad 1 --desde 9` intenta ser la persona 11 y recibe «La sala está llena.». Ctrl+C en el simulador los saca a todos.
6. **Salida y cierre:** LunaDemo pulsa **Salir de la sala** y SolDemo cierra su ventana (pérdida de conexión): el cupo se libera y la sala queda en `0/10`. Pasado el tiempo de cierre, la antesala dice «Esta sala se cerró…» y ofrece la instancia nueva del mismo tema. Si alguien entra antes, el contador se cancela.

### Demo de la Fase 6 (3 minutos)

1. **Entrar** → `LunaDemo` → **Mi perfil** → **Personalizar mi avatar**.
2. Elige personaje base, cabello, rasgos, prenda y accesorio: la vista previa cambia al instante y cada opción se muestra ya aplicada a tu avatar. **Deshacer cambios** vuelve a lo guardado. **Guardar avatar** → «Avatar guardado.».
3. **Salir** y volver a entrar como `LunaDemo` → **Mi avatar** muestra la misma apariencia.
4. **Mi comunidad**: el avatar nuevo aparece junto a tu alias en tus hilos y respuestas. **Salas** → entra a una sala: tu avatar es el mismo en el escenario y en la lista de personas.
5. **No hay foto ni texto:** la pantalla solo ofrece opciones del catálogo (no hay botón de subir ni campo de texto). Si alguien lo intenta por la API, se rechaza:
   ```bash
   curl -X PUT http://localhost:4000/api/avatar -H "Content-Type: application/json" -d "{\"personaje\":\"https://ejemplo.com/foto.png\"}"
   ```
   responde `401` sin sesión y `400 AVATAR_INVALIDO` con ella (lo cubre `npm run test:db`).

### Demo de la Fase 7 (3 minutos)

1. **Entrar** → `LunaDemo` → **Mi comunidad** → «Me cuesta adaptarme a los cambios de este año». Hay una respuesta grosera sintética de SolDemo que el DLP no detecta (no tiene datos personales). **Reportar** → «Acoso» → «Tu reporte fue registrado.».
2. **Salir** → `ModeradorDemo` → **Panel**: el resumen muestra reportes pendientes, bloqueos del DLP y personas en salas, todo con datos reales. **Reportes** → abre el de «Acoso»: motivo, fecha y contenido asociado; nunca quién reportó.
3. **Ocultar contenido** → **Confirmar**. Vuelve como LunaDemo: la respuesta ya no aparece. Como moderador, **Marcar como resuelto** y abre **Registro de acciones**: quién, qué y cuándo.
4. **Salir** → `AdminDemo` → **Panel** → **Salas**: desactiva «Bienestar cotidiano» de la Comunidad B (quien esté dentro sale con un aviso y deja de aparecer en la lista) y vuelve a activarla. Cambia la capacidad o edita el escenario con la sala vacía.
5. **Incidencias DLP**: bloqueos por categoría y por día. **Reglas DLP**: activa o desactiva reglas o categorías completas (la moderación solo puede consultarlas).

### Demo de la Fase 8 (2 minutos)

1. En cualquier página, **¿Cómo funciona?** abre a Cocuyo, la guía: respuestas preparadas sobre la plataforma, las salas, la privacidad y los reportes. «¿Dónde encuentro orientación?» muestra canales reales de la base con institución, fuente y fecha. No hay campo de texto: no es un chatbot ni da consejos médicos. La versión completa está en `/guia`.
2. En una sala, **haz clic en una casilla libre**: el avatar llega por el camino más corto rodeando los muebles, paso a paso, y la otra sesión lo ve. Un clic sobre un mueble responde «No puedes ir a esa casilla».
3. Crea un hilo con `tres cero cero cero cero cero cero cero cero cero`, `i n s t a g r a m`, `1nst4gr4m` o `prueba arroba example punto test`: se bloquean. Los casos de la Fase 2 siguen bloqueándose.

## Comandos

| Comando                              | Qué hace                                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm install`                        | Instala las dos aplicaciones (npm workspaces).                                                                                                   |
| `npm run dev`                        | Levanta backend y frontend a la vez, con recarga automática.                                                                                     |
| `npm run db:reset`                   | **Reinicia los datos de demo**: borra el esquema `app`, aplica las migraciones y carga el seed.                                                  |
| `npm run db:migrate`                 | Aplica solo las migraciones pendientes.                                                                                                          |
| `npm run db:seed`                    | Vacía las tablas y recarga datos sintéticos, reglas DLP y fuentes de demo (sin tocar el esquema).                                                |
| `npm run fuentes:cargar`             | Sincroniza las fuentes con `db/seed/fuentes_institucionales.json` sin tocar el resto (ver `docs/FUENTES.md`).                                    |
| `npm run salas:simular`              | Conecta personas sintéticas a una sala (`--cantidad`, `--desde`, `--sala`, `--comunidad`) para la demo de capacidad.                             |
| `npm test`                           | Pruebas unitarias y de humo del backend (DLP y evasión, permisos, sesión, guardianes, salas y clic). Sin red ni base de datos.                   |
| `npm run test:db`                    | Integración contra la base del `.env`: TRL-01 a 12, AV-01 a 12, DLP, reportes, moderación, administración, salas y permisos. Deja la base igual. |
| `npm run lint` / `npm run typecheck` | ESLint y TypeScript en las dos aplicaciones.                                                                                                     |
| `npm run format` / `format:check`    | Prettier.                                                                                                                                        |
| `npm run verificar`                  | Formato + lint + tipos + pruebas: lo que debe pasar antes de cerrar una fase.                                                                    |

## API

Todo bajo `/api`. Los errores tienen la forma `{ error: { codigo, mensaje, detalles? } }`.

| Ruta                                                  | Quién                             | Qué hace                                                                                                                                                       |
| ----------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /salud`                                          | Cualquiera                        | Estado del backend, de la base y conteo de datos de demo.                                                                                                      |
| `GET /sesion`                                         | Cualquiera                        | Sesión actual (`usuario: null` si no hay).                                                                                                                     |
| `POST /sesion`, `DELETE /sesion`                      | Solo modo demo / cualquiera       | Entrar como usuario sintético (`{ codigo }`) / salir.                                                                                                          |
| `GET /sesion/usuarios-demo`                           | Solo modo demo                    | Usuarios para el selector de acceso.                                                                                                                           |
| `GET /comunidad`, `GET /comunidades`                  | Con comunidad                     | La comunidad propia. La lista solo la contiene a ella.                                                                                                         |
| `GET /comunidades/:id-o-A-D`                          | Con comunidad                     | La propia, o 404 idéntico al de una inexistente.                                                                                                               |
| `GET /perfil`, `PUT /perfil`                          | Con sesión                        | Perfil propio: alias e intereses (y su avatar, de solo lectura). Todo texto pasa por el DLP.                                                                   |
| `GET /avatar`                                         | Con sesión                        | «Mi avatar»: la configuración propia y el catálogo activo.                                                                                                     |
| `PUT /avatar`                                         | Jóvenes y administración          | Guardar el avatar propio: solo ids del catálogo, una por capa. No hay ruta para otra persona ni carga de archivos.                                             |
| `GET /perfiles?buscar=`, `GET /perfiles/:id`          | Con comunidad                     | Búsqueda y perfiles, solo de la misma comunidad.                                                                                                               |
| `GET /moderacion/incidencias-dlp?dias=`               | Moderación y administración       | Bloqueos DLP por categoría, por día y por tipo, y los recientes, sin texto ni autor (F35).                                                                     |
| `GET /moderacion/reportes?estado=&pagina=`            | Moderación y administración       | Reportes por estado (F30), de 15 en 15, con el conteo de cada estado.                                                                                          |
| `GET`/`PATCH /moderacion/reportes/:id`                | Moderación y administración       | Detalle (motivo, fecha, contenido asociado, sin quién reportó) / cambiar estado (`{ estado }`).                                                                |
| `POST /moderacion/reportes/:id/acciones`              | Moderación y administración       | `ocultar_contenido`, `restaurar_contenido`, `suspender_autor`, `reactivar_autor`, `deshabilitar_sala` (solo admin).                                            |
| `GET /admin/resumen`                                  | Moderación y administración       | Indicadores del panel con datos reales.                                                                                                                        |
| `GET /admin/usuarios`, `PATCH /admin/usuarios/:id`    | Moderación (solo jóvenes) y admin | Cuentas con datos mínimos / suspender, bloquear o reactivar (`{ estado }`). Nadie actúa sobre su propia cuenta.                                                |
| `GET`/`PATCH /admin/comunidades[/:id]`                | Administración                    | Nombre, descripción y estado. El rango de edad no se puede cambiar.                                                                                            |
| `GET`/`POST`/`PATCH /admin/categorias[/:id]`          | Administración                    | Categorías de foros y salas (F28).                                                                                                                             |
| `GET`/`POST`/`PATCH /admin/salas[/:id]`               | Administración                    | Salas por comunidad: habilitar, capacidad (1 a 10), descripción y reglas; habilitar la sala de una categoría.                                                  |
| `PUT /admin/salas/:id/escenario`                      | Administración                    | Obstáculos y punto de entrada, con la sala vacía. El backend exige que no queden zonas sin salida.                                                             |
| `GET /admin/reglas-dlp`                               | Moderación y administración       | Reglas por categoría con sus bloqueos de 30 días.                                                                                                              |
| `PATCH /admin/reglas-dlp/:id`, `…/categorias/:codigo` | Administración                    | Activar o desactivar una regla o una categoría completa (`{ estado }`).                                                                                        |
| `GET /admin/auditoria?pagina=`                        | Moderación y administración       | Registro de acciones: quién, qué, cuándo. La moderación ve solo lo que gestiona.                                                                               |
| `GET /comunidad/categorias`                           | Con comunidad                     | Las cinco categorías, con el número de hilos de la comunidad propia.                                                                                           |
| `GET /comunidad/hilos?categoria=&buscar=&pagina=`     | Con comunidad                     | Hilos de la comunidad propia, de 10 en 10, por última actividad.                                                                                               |
| `POST /comunidad/hilos`                               | Jóvenes y administración          | Crear hilo (`{ categoria, titulo, contenido }`). Pasa por el DLP.                                                                                              |
| `GET /comunidad/hilos/:id`                            | Con comunidad                     | Hilo con sus respuestas. De otra comunidad: 404 idéntico al de uno inexistente.                                                                                |
| `POST /comunidad/hilos/:id/respuestas`                | Con comunidad                     | Responder (`{ contenido }`). Pasa por el DLP. Un hilo cerrado responde 409.                                                                                    |
| `POST /reportes`                                      | Con comunidad                     | Reportar hilo, respuesta, perfil o sala de la propia comunidad. Responde «Tu reporte fue registrado.»                                                          |
| `GET /salas`                                          | Con comunidad                     | Salas abiertas de la comunidad propia, con ocupación y estado.                                                                                                 |
| `GET /salas/:id`                                      | Con comunidad                     | Antesala: tema, descripción, reglas y ocupación. De otra comunidad: 404. Si se cerró, indica la instancia abierta.                                             |
| `WS /ws/salas/:id` (fuera de `/api`)                  | Con comunidad                     | Tiempo real de la sala, autenticado con la cookie de sesión. Intenciones: `mover`, `ir` (clic, Fase 8), `mensaje`, `salir`. Protocolo en `salas.protocolo.ts`. |
| `GET /orientacion/necesidades`                        | Cualquiera, sin sesión            | Las seis necesidades del navegador, con cuántos servicios tiene cada una.                                                                                      |
| `GET /orientacion/necesidades/:codigo`                | Cualquiera, sin sesión            | Servicios activos o en revisión de esa necesidad.                                                                                                              |
| `GET /orientacion/servicios/:id`                      | Cualquiera, sin sesión            | Ficha del servicio. Una fuente inactiva responde 404.                                                                                                          |
| `GET /orientacion/ayuda`                              | Cualquiera, sin sesión            | Canales de «Necesito ayuda».                                                                                                                                   |
| `GET`/`POST /gestion/fuentes`                         | Gestor y administración           | Semáforo y lista / crear una fuente (con fecha de verificación).                                                                                               |
| `GET`/`PUT /gestion/fuentes/:id`                      | Gestor y administración           | Detalle con bitácora / editar datos.                                                                                                                           |
| `POST /gestion/fuentes/:id/revision`                  | Gestor y administración           | Marcar para revisión (`{ motivo }`).                                                                                                                           |
| `POST /gestion/fuentes/:id/verificacion`              | Gestor y administración           | Verificar (`{ fecha?, observacion? }`); vuelve a Activo.                                                                                                       |
| `POST /gestion/fuentes/:id/desactivacion`             | Gestor y administración           | Desactivar (`{ motivo }`).                                                                                                                                     |

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
    scripts/salas-simular.ts    Personas sintéticas conectadas a una sala (demo de capacidad)
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
        avatar/                 Catálogo, «Mi avatar» y la apariencia que usan perfiles, hilos y salas
        moderacion/             Incidencias DLP y revisión de reportes (F30) con sus acciones
        administracion/         Usuarios, comunidades, categorías, salas y reglas DLP (Fase 7)
        auditoria/              Registro de acciones administrativas (solo inserción)
        fuentes/                Gestión de fuentes: esquemas, ciclo de vida, bitácora y carga
        orientacion/            Navegador público y «Necesito ayuda»
        salas/                  Salas en tiempo real: escenario, gestor (autoridad), WebSocket y antesala
    test/                       Unitarias y humo (sin red) e integracion/ (base real)
  frontend/                     Next.js 16 (App Router) + React 19
    src/
      app/                      Páginas: inicio, acceso, orientación, ayuda, guía, comunidad e hilos, salas, reglas, perfil, panel, fuentes
      app/fuentes/              Fuentes tipográficas alojadas en el proyecto (licencia OFL)
      components/ui/            Componentes base: Aviso, Boton, BotonEnlace, Tarjeta, CampoTexto, CampoSeleccion, Insignia
      components/sesion/        Contexto de sesión, guardián de páginas y selector de acceso
      components/salas/         Lista, antesala, escenario 2D, chat y conexión en tiempo real (useSalaEnVivo)
      components/avatar/        Avatar (único componente, por capas), sus dibujos (capas.ts) y «Mi avatar»
      components/panel/         Panel administrativo: resumen, reportes, usuarios, salas y escenario, comunidades, reglas, registro
      components/guia/          Guía virtual «Cocuyo» (contenido en config/guia.ts)
      components/inicio/        Edificio llanero (ilustración del inicio) y atajos de orientación
      components/…              Orientación, fuentes, comunidad, perfil, moderación y layout
      config/textos.ts          Aviso de límites (texto exacto de la sección 18.1)
      config/navegacion.ts      Menú principal (cada enlace declara el permiso que necesita)
      lib/api/                  Cliente HTTP centralizado y llamadas por módulo
      styles/tokens.css         Tokens de diseño (paleta, tipografía, espaciado)
docs/                           Documento maestro, modelo de datos, arquitectura y guía de carga de fuentes
EVIDENCIAS/                     Matriz TRL 4, verificación de restricciones, capturas y registros de pruebas
DEMO.md                         Guion de la demostración
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

## Salas en tiempo real (Fase 5)

- **Salas temáticas (F11):** cinco por comunidad, fijas: Cambios y nuevas etapas, Vida académica, Relaciones y convivencia, Bienestar cotidiano y Hablar con alguien. Nadie las crea desde la interfaz. Antes de entrar, la antesala muestra tema, reglas y ocupación `n/10`.
- **Tiempo real:** un WebSocket (`ws`) en el mismo servidor del backend, en `/ws/salas/:id`. Se autentica con la misma cookie de sesión y rechaza otros orígenes. **El servidor es la autoridad:** decide quién está, dónde está cada avatar y qué movimiento es válido; el cliente solo envía intenciones (`mover`, `mensaje`, `salir`). Quien llega tarde recibe el estado completo.
- **Segmentación (AV-12):** solo se entra a salas de la comunidad propia; otra sala responde igual que una inexistente. La base lo refuerza con su disparador en participaciones y posiciones.
- **Capacidad (TRL-07):** máximo 10. Ocupar un cupo es un único `UPDATE … WHERE usuarios_actuales < capacidad_maxima` y la tabla tiene un `CHECK`, así que entradas simultáneas nunca pasan de 10; la persona 11 recibe «La sala está llena.». Otra pestaña de la misma persona reemplaza su conexión sin ocupar otro cupo.
- **Salida (F15):** salir o perder la conexión libera el cupo, cierra la participación y borra la posición. Al arrancar, el backend cierra lo que hubiera quedado abierto.
- **Cierre automático (TRL-08, F13):** con 0 personas empieza un contador (`SALA_CIERRE_SEGUNDOS`, 180 por defecto). Si nadie entra, la instancia se cierra y, en la misma sentencia, se abre una nueva del mismo tema con el mismo escenario. Entrar antes cancela el contador. Una instancia cerrada no admite entradas.
- **Escenario 2D:** cuadrícula de 12×8 con muebles guardados como datos en `escenario_sala` y dibujados por código (pixel art original). Movimiento con W A S D, con las flechas si el escenario tiene el foco o con botones en pantalla; no hay clic para moverse. Las teclas se ignoran mientras se escribe en un campo. Cada movimiento válido se guarda en `posicion_avatar_sala` y se difunde; los rechazados (borde u obstáculo) solo los ve quien se movió.
- **Chat (F14):** cada mensaje pasa por el DLP. Si se bloquea, solo su autor ve el aviso y su texto queda en el campo; nadie más lo recibe y el bloqueo queda en `evento_dlp` sin el texto. El chat no se guarda.
- **En la sala:** lista de personas con `n/10`, **Salir de la sala**, **Necesito ayuda** (muestra un canal institucional sin salir de la sala) y **Reportar** la sala.

## Avatar (Fase 6)

- **Catálogo cerrado y gratuito (F36, RF27):** `elemento_avatar` con 4 personajes base (tonos de piel), 4 cabellos, 4 rasgos, 4 prendas y 3 accesorios, cada uno con origen y licencia. No hay precios, monedas, tienda ni artículos premium, y ninguna opción depende de la edad.
- **Recursos originales (RF28):** cada elemento apunta a un dibujo propio en pixel art hecho por código ([`components/avatar/capas.ts`](apps/frontend/src/components/avatar/capas.ts)), sobre una cuadrícula de 16 × 20. No se usan imágenes externas.
- **«Mi avatar»:** desde **Mi perfil**. Vista previa en vivo, cada opción se muestra aplicada al avatar actual, guardado en `configuracion_avatar` y recuperación al volver a entrar. Cabello y accesorio pueden quedar vacíos.
- **Un solo componente (F37):** `<Avatar apariencia>` dibuja por capas (cabello de atrás, personaje, prenda, rasgos, cabello de delante y accesorio). Lo usan el perfil, el buscador, los hilos, las respuestas y el escenario de las salas. En la base, una sola expresión (`sqlApariencia`) arma la apariencia para todos. En una sala, un cambio se ve desde la siguiente entrada.
- **Validación (RF21, RF22, AV-11):** `PUT /api/avatar` solo acepta un id del catálogo por capa, del tipo correcto y activo. Cualquier otro campo, texto, URL, teléfono o imagen responde `400 AVATAR_INVALIDO` sin repetir el valor. No existe ninguna ruta de carga de archivos y no hay forma de indicar a otra persona: el usuario sale de la sesión. La base lo refuerza: el recurso gráfico debe ser una clave (nunca una URL) y cada capa debe apuntar a un elemento de su tipo.

## Moderación y administración (Fase 7)

- **Panel en `/panel`**, protegido por rol: lo ven moderación y administración, cada sección según su permiso de la matriz A.2. El backend vuelve a comprobar el permiso en cada llamada: un joven recibe 403 y sin sesión 401. La ruta anterior `/moderacion` redirige al panel.
- **Reportes (F30):** lista con filtro por estado (Pendiente, En revisión, Resuelto, Descartado) y detalle con motivo, fecha, comunidad y contenido asociado. El moderador ve el alias del autor y el estado de su cuenta; nunca quién reportó, la edad ni otros datos privados. Transiciones controladas (un reporte cerrado se puede reabrir).
- **Acciones permitidas:** ocultar o restaurar un hilo o una respuesta (deja de mostrarse en la comunidad), suspender o reactivar la cuenta autora (pierde la sesión al instante y sale de las salas) y, solo administración, deshabilitar la sala reportada. La resolución se guarda de una lista cerrada, sin notas libres.
- **Administración (F26–F29, F31):** usuarios con datos mínimos y medidas (la moderación solo sobre jóvenes; nadie sobre sí mismo); comunidades (nombre, descripción y estado; **el rango no se puede cambiar desde ninguna parte**); categorías; salas por comunidad (habilitar, capacidad de 1 a 10, escenario con editor visual que no permite dejar zonas sin salida); reglas DLP por regla o por categoría.
- **Registro de acciones:** cada medida se escribe en `app.registro_auditoria` en la **misma sentencia SQL** que el cambio, así que no hay acción sin registro. La tabla es de solo inserción. Es el mecanismo mínimo: la auditoría definitiva sigue pendiente.
- **Datos de demo:** el seed trae una respuesta grosera sintética que el DLP no detecta y dos reportes pendientes, para mostrar la segunda capa.

## Experiencia complementaria (Fase 8)

- **Guía virtual «Cocuyo» (F25):** personaje original (un cocuyo llanero en pixel art) con contenido preestablecido en `config/guia.ts`. Botón flotante en las páginas públicas y de comunidad, y página `/guia`. No tiene campo de texto, no diagnostica, no da consejos médicos y, cuando muestra canales, indica institución, fuente y fecha.
- **Movimiento por clic (F40, AV-05):** el cliente envía `{ tipo: 'ir', x, y }`; el servidor calcula el camino más corto (búsqueda en anchura en 4 direcciones) y lo recorre paso a paso, validando cada paso con las mismas reglas que el teclado y difundiéndolo. Una tecla cancela el recorrido. Destinos sobre un mueble o fuera del área se rechazan.
- **Detección básica de evasión (F23):** el DLP analiza también variantes del texto: números dictados en palabras, dígitos separados con símbolos, letras sueltas, números o símbolos en lugar de letras, letras repetidas y correos escritos con «arroba» y «punto», más una regla con nombres de plataformas alterados. Las fechas como 21/10/2026 no se confunden con teléfonos. **No detecta todas las formas posibles de evasión.**

## Integración y validación (Fase 9)

- 24 de 24 escenarios (TRL-01 a 12 y AV-01 a 12) ejecutados y aprobados el 22/10/2026, con capturas de un navegador real y la salida de las pruebas: [`EVIDENCIAS/MATRIZ.md`](EVIDENCIAS/MATRIZ.md). La validación se hizo con PostgreSQL local; el equipo debe repetir `npm run db:reset` y `npm run test:db` contra su base.
- Verificación de restricciones con evidencia: [`EVIDENCIAS/RESTRICCIONES.md`](EVIDENCIAS/RESTRICCIONES.md).

## Interfaz e identidad visual

- **Marca «Refugio»:** un arco que abraza cuatro ventanas de colores. El arco es la protección; cada ventana, con su luz, una de las cuatro comunidades por edad (A cielo, B ámbar, C menta, D lila). Funciona desde 16 px y sobre fondos claros y oscuros. Archivos en [`apps/frontend/public/marca/`](apps/frontend/public/marca) (icono, horizontal, símbolo y sus negativos en SVG), favicon en `src/app/icon.svg` e icono táctil en `src/app/apple-icon.png`. En la interfaz se usa el componente `Logo` / `MarcaCompleta`. Se presenta en `/guia-de-estilos`.
- **Paleta:** índigo profundo para la confianza, ámbar para la luz que orienta, menta para lo que está bien; el coral queda reservado para «Necesito ayuda». Todos los pares de texto cumplen contraste AA.
- **Tipografía:** Atkinson Hyperlegible para el texto (legibilidad) y Bricolage Grotesque para títulos, alojadas en el proyecto.
- **Navegación:** en escritorio, una cápsula con las secciones del rol, «Necesito ayuda» y el menú de la cuenta (perfil, avatar, cómo funciona, salir). En móvil y tableta, barra inferior al alcance del pulgar y la ayuda siempre arriba. El panel agrupa sus secciones (moderación, administración, información) y la gestión de fuentes comparte su marco.
- **Componentes:** botones, tarjetas, campos, insignias y avisos con los tokens; además diálogo de confirmación (`<dialog>` nativo), notificaciones breves con `aria-live`, estados vacío, de error con reintento y de carga.
- **Librerías:** `motion` (indicadores animados, contadores y notificaciones; respeta «reducir movimiento») y `lucide-react` (iconos). De shadcn/ui, Magic UI, Aceternity UI y React Bits se tomaron patrones concretos reescritos con CSS Modules, sin instalar nada: menú desplegable y diálogo (shadcn/ui), contador animado y borde brillante (Magic UI), fondo aurora (Aceternity UI) y tarjeta con destello (React Bits). Ver `DECISIONES.md`.

## Cómo crece en las siguientes fases

- **Backend:** cada área del producto es un módulo en `apps/backend/src/modules/<modulo>/` con `*.routes.ts`, `*.service.ts` y `*.repository.ts`, registrado en `src/app.ts`. Una ruta nueva usa `requerirPermiso(...)`. Si es comunitaria, obtiene el rango con `exigirRango(sesion)`, y todo texto de usuarios pasa por `dlp.exigirPermitido(...)` antes de guardarse. Una acción administrativa se registra con `cteAuditoria(...)` en la misma sentencia.
- **Base de datos:** el esquema completo de B.4 ya existe. Un cambio de estructura es una migración nueva `000N_descripcion.sql`; los datos de demostración se agregan en `db/seed/`.
- **Frontend:** las páginas privadas se envuelven en `<RequiereSesion permiso="…">`. Las llamadas van en `src/lib/api/<modulo>.ts` y los enlaces del menú en `src/config/navegacion.ts`. La interfaz se arma con `src/components/ui` y los tokens (ver `/guia-de-estilos`).
- Toda decisión técnica nueva se registra en una línea en `DECISIONES.md`.

## Base de datos

- PostgreSQL en Supabase, esquema propio **`app`**. La API pública de Supabase no lo expone y los roles `anon`/`authenticated` no tienen permisos: **el backend es el único acceso a los datos**. El frontend no usa las claves de Supabase.
- `db:reset` solo borra el esquema `app`; no toca nada más del proyecto de Supabase.
- Datos sintéticos: 4 comunidades, 5 categorías, 8 usuarios de prueba (tabla de arriba), un catálogo de avatar de 19 elementos (cada usuario con una apariencia distinta), 5 salas temáticas por comunidad con su escenario, 5 hilos (uno por comunidad y dos en la B) con dos respuestas (una de ellas grosera, para la demo de moderación), 2 reportes pendientes, 20 reglas DLP y 5 fuentes institucionales de demostración (`InstituciónDemo · CanalDemo` y otras; 3 activas, 1 en revisión y 1 inactiva).
- Reglas que la propia base garantiza, además del backend: segmentación por edad en hilos, respuestas y salas; máximo 10 participantes por sala; bitácora de fuentes y auditoría de solo inserción; ninguna columna de edad exacta.

## Seguridad y restricciones

- El `.env` real nunca se versiona; `.env.example` solo tiene marcadores.
- Solo datos sintéticos. Ninguna institución, teléfono ni enlace real: las fuentes reales las investiga y verifica el equipo, y las carga con `npm run fuentes:cargar` (ver `docs/FUENTES.md`).
- Los logs y los eventos DLP no guardan contenido escrito por usuarios.
- Las acciones administrativas quedan en un registro de solo inserción, sin contenido escrito por usuarios.
- **Pendiente y documentado en `DECISIONES.md`:** la verificación de edad real (hoy es provisional), las fuentes institucionales verificadas y el mecanismo de auditoría definitivo.
- Solo ejecución local. No se despliega ni se publica nada.
