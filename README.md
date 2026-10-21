# Comunidad Protegida · prototipo

Plataforma digital de orientación y comunidad protegida para jóvenes de Villavicencio (10 a 22 años), en cuatro comunidades aisladas por rango de edad. Es un **prototipo de hackathon** (objetivo TRL 4) que trabaja **solo con datos sintéticos**.

> La plataforma no diagnostica, no evalúa ni predice riesgo, no presta servicios de salud y no es un servicio oficial de ninguna institución.

- Fuente de verdad del producto: [`docs/Documento Maestro…docx`](docs/).
- Decisiones técnicas: [`DECISIONES.md`](DECISIONES.md).
- Modelo de datos: [`docs/MODELO_DE_DATOS.md`](docs/MODELO_DE_DATOS.md).
- Estado: **Fases 1 (entorno) y 2 (seguridad base) terminadas.** Siguiente: Fase 3, orientación y fuentes.

## Requisitos

- Node.js **22.12 o superior** (incluye npm 10).
- Una base PostgreSQL. El equipo usa un proyecto de Supabase: pide el `.env` a quien lo administra.

## Puesta en marcha (menos de 5 minutos)

```bash
cp .env.example .env    # completa DATABASE_URL y SESSION_SECRET (o usa el .env del equipo)
npm install             # instala frontend y backend
npm run db:reset        # crea el esquema y carga los datos sintéticos y las reglas DLP
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

## Comandos

| Comando                              | Qué hace                                                                                                   |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `npm install`                        | Instala las dos aplicaciones (npm workspaces).                                                             |
| `npm run dev`                        | Levanta backend y frontend a la vez, con recarga automática.                                               |
| `npm run db:reset`                   | **Reinicia los datos de demo**: borra el esquema `app`, aplica las migraciones y carga el seed.            |
| `npm run db:migrate`                 | Aplica solo las migraciones pendientes.                                                                    |
| `npm run db:seed`                    | Vacía las tablas y recarga los datos sintéticos y las reglas DLP (sin tocar el esquema).                   |
| `npm test`                           | Pruebas unitarias y de humo del backend (DLP, permisos, sesión, guardianes). Sin red ni base de datos.     |
| `npm run test:db`                    | Integración contra la base del `.env`: esquema, seed, TRL-01, DLP y permisos por HTTP. Deja la base igual. |
| `npm run lint` / `npm run typecheck` | ESLint y TypeScript en las dos aplicaciones.                                                               |
| `npm run format` / `format:check`    | Prettier.                                                                                                  |
| `npm run verificar`                  | Formato + lint + tipos + pruebas: lo que debe pasar antes de cerrar una fase.                              |

## API

Todo bajo `/api`. Los errores tienen la forma `{ error: { codigo, mensaje, detalles? } }`.

| Ruta                                         | Quién                       | Qué hace                                                                              |
| -------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------- |
| `GET /salud`                                 | Cualquiera                  | Estado del backend, de la base y conteo de datos de demo.                             |
| `GET /sesion`                                | Cualquiera                  | Sesión actual (`usuario: null` si no hay).                                            |
| `POST /sesion`, `DELETE /sesion`             | Solo modo demo / cualquiera | Entrar como usuario sintético (`{ codigo }`) / salir.                                 |
| `GET /sesion/usuarios-demo`                  | Solo modo demo              | Usuarios para el selector de acceso.                                                  |
| `GET /comunidad`, `GET /comunidades`         | Con comunidad               | La comunidad propia. La lista solo la contiene a ella.                                |
| `GET /comunidades/:id-o-A-D`                 | Con comunidad               | La propia, o 404 idéntico al de una inexistente.                                      |
| `GET /perfil`, `PUT /perfil`                 | Con sesión                  | Perfil propio: alias, intereses y personaje del catálogo. Todo texto pasa por el DLP. |
| `GET /perfiles?buscar=`, `GET /perfiles/:id` | Con comunidad               | Búsqueda y perfiles, solo de la misma comunidad.                                      |
| `GET /moderacion/incidencias-dlp`            | Moderación y administración | Bloqueos DLP por categoría y recientes, sin texto ni autor (F35).                     |

## Estructura

```
apps/
  backend/                      Node.js 22 + Express 5 (TypeScript, ejecutado con tsx)
    db/migraciones/             SQL numerado: 0001_esquema_inicial.sql, 0002_…
    db/seed/datos_demo.sql      Datos sintéticos (Anexo B.7 + usuarios por rango y rol)
    db/seed/reglas_dlp.json     Reglas DLP predeterminadas que el seed carga en app.regla_dlp
    scripts/db.ts               migrar | sembrar | reiniciar
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
        comunidad/              Comunidad propia; la segmentación se deriva de la sesión
        perfil/                 Perfil protegido y búsqueda dentro de la comunidad
        moderacion/             Incidencias DLP
    test/                       Unitarias y humo (sin red) e integracion/ (base real)
  frontend/                     Next.js 16 (App Router) + React 19
    src/
      app/                      Páginas: inicio, acceso, comunidad, perfil, moderación, guía de estilos
      components/ui/            Componentes base: Aviso, Boton, BotonEnlace, Tarjeta, CampoTexto, Insignia
      components/sesion/        Contexto de sesión, guardián de páginas y selector de acceso
      components/…              Comunidad, perfil, moderación, avatar provisional y layout
      config/navegacion.ts      Menú principal (cada enlace declara el permiso que necesita)
      lib/api/                  Cliente HTTP centralizado y llamadas por módulo
      styles/tokens.css         Tokens de diseño (paleta, tipografía, espaciado)
docs/                           Documento maestro y modelo de datos
```

## Seguridad base (Fase 2)

- **Sesión:** cookie `HttpOnly` y `SameSite=Lax`, firmada con HMAC (`SESSION_SECRET`), válida por 8 horas. En cada solicitud, el rol, el rango y el estado se leen de la base: si una cuenta se suspende, pierde el acceso de inmediato. Las escrituras que llegan desde otro origen se rechazan.
- **Segmentación:** la comunidad sale **siempre** del rango de la sesión, nunca de lo que envía el cliente. Pedir una comunidad, un perfil o una búsqueda de otro rango da una respuesta idéntica a la de algo inexistente. La base lo refuerza con un disparador.
- **Permisos:** la matriz A.2 está en [`seguridad/permisos.ts`](apps/backend/src/modules/seguridad/permisos.ts), con un guardián `requerirPermiso(...)`. El frontend oculta lo que no corresponde, pero quien decide es el backend.
- **DLP:** `crearServicioDlp().revisar(texto, { tipoContenido, idUsuario })` sirve para perfiles, hilos, respuestas y salas. Las reglas son expresiones regulares en `app.regla_dlp` y se activan o desactivan sin tocar código; se escriben en minúsculas y sin tildes, porque el texto se normaliza antes de compararlo. Un bloqueo devuelve 422 con el mensaje estándar y el campo afectado, sin repetir el dato. Cada bloqueo registra un evento en `app.evento_dlp` sin el texto. Hay un punto de extensión (`clasificadores`) para un clasificador futuro. **No detecta todas las formas posibles de compartir información.**
- **Perfil protegido:** solo alias, intereses generales y un personaje del catálogo. Cualquier otro campo, como la edad, el rango o datos de contacto, se rechaza.

## Cómo crece en las siguientes fases

- **Backend:** cada área del producto es un módulo en `apps/backend/src/modules/<modulo>/` con `*.routes.ts`, `*.service.ts` y `*.repository.ts`, registrado en `src/app.ts`. Una ruta nueva usa `requerirPermiso(...)`. Si es comunitaria, obtiene el rango con `exigirRango(sesion)`, y todo texto de usuarios pasa por `dlp.exigirPermitido(...)` antes de guardarse. Módulos previstos: `orientacion` (Fase 3), hilos en `comunidad` (Fase 4), `salas` (Fase 5), `avatar` (Fase 6) y `administracion` (Fase 7).
- **Base de datos:** el esquema completo de B.4 ya existe. Un cambio de estructura es una migración nueva `000N_descripcion.sql`; los datos de demostración se agregan en `db/seed/`.
- **Frontend:** las páginas privadas se envuelven en `<RequiereSesion permiso="…">`. Las llamadas van en `src/lib/api/<modulo>.ts` y los enlaces del menú en `src/config/navegacion.ts`. La interfaz se arma con `src/components/ui` y los tokens (ver `/guia-de-estilos`).
- Toda decisión técnica nueva se registra en una línea en `DECISIONES.md`.

## Base de datos

- PostgreSQL en Supabase, esquema propio **`app`**. La API pública de Supabase no lo expone y los roles `anon`/`authenticated` no tienen permisos: **el backend es el único acceso a los datos**. El frontend no usa las claves de Supabase.
- `db:reset` solo borra el esquema `app`; no toca nada más del proyecto de Supabase.
- Datos sintéticos: 4 comunidades, 5 categorías, 8 usuarios de prueba (tabla de arriba), 3 personajes provisionales, la sala «Bienestar cotidiano», la fuente `InstituciónDemo · CanalDemo` (marcada como dato de demostración) y 19 reglas DLP.
- Reglas que la propia base garantiza, además del backend: segmentación por edad en hilos, respuestas y salas; máximo 10 participantes por sala; bitácora de fuentes y auditoría de solo inserción; ninguna columna de edad exacta.

## Seguridad y restricciones

- El `.env` real nunca se versiona; `.env.example` solo tiene marcadores.
- Solo datos sintéticos. Ninguna institución, teléfono ni enlace real: las fuentes reales las investiga y verifica el equipo.
- Los logs y los eventos DLP no guardan contenido escrito por usuarios.
- **Pendiente y documentado en `DECISIONES.md`:** la verificación de edad real (hoy es provisional), las fuentes institucionales verificadas y el mecanismo de auditoría definitivo.
- Solo ejecución local. No se despliega ni se publica nada.
