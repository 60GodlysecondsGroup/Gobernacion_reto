# Comunidad Protegida · prototipo

Plataforma digital de orientación y comunidad protegida para jóvenes de Villavicencio (10 a 22 años), en cuatro comunidades aisladas por rango de edad. Es un **prototipo de hackathon** (objetivo TRL 4) que trabaja **solo con datos sintéticos**.

> La plataforma no diagnostica, no evalúa ni predice riesgo, no presta servicios de salud y no es un servicio oficial de ninguna institución.

- Fuente de verdad del producto: [`docs/Documento Maestro…docx`](docs/).
- Decisiones técnicas: [`DECISIONES.md`](DECISIONES.md).
- Modelo de datos: [`docs/MODELO_DE_DATOS.md`](docs/MODELO_DE_DATOS.md).
- Estado: **Fase 1 (entorno y definición técnica) terminada.** Siguiente: Fase 2, seguridad base.

## Requisitos

- Node.js **22.12 o superior** (incluye npm 10).
- Una base PostgreSQL. El equipo usa un proyecto de Supabase: pide el `.env` a quien lo administra.

## Puesta en marcha (menos de 5 minutos)

```bash
cp .env.example .env    # completa DATABASE_URL (o usa el .env que te pase el equipo)
npm install             # instala frontend y backend
npm run db:reset        # crea el esquema y carga los datos sintéticos
npm run dev             # levanta backend (:4000) y frontend (:3000)
```

Abre <http://localhost:3000>: la tarjeta «Estado del sistema» muestra **backend OK**, la base conectada y los datos sintéticos cargados.

## Comandos

| Comando                              | Qué hace                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `npm install`                        | Instala las dos aplicaciones (npm workspaces).                                                  |
| `npm run dev`                        | Levanta backend y frontend a la vez, con recarga automática.                                    |
| `npm run db:reset`                   | **Reinicia los datos de demo**: borra el esquema `app`, aplica las migraciones y carga el seed. |
| `npm run db:migrate`                 | Aplica solo las migraciones pendientes.                                                         |
| `npm run db:seed`                    | Vacía las tablas y recarga los datos sintéticos (sin tocar el esquema).                         |
| `npm test`                           | Pruebas de humo y unitarias del backend. No necesitan red ni base de datos.                     |
| `npm run test:db`                    | Pruebas de integración contra la base del `.env` (esquema, seed y reglas). Requiere `db:reset`. |
| `npm run lint` / `npm run typecheck` | ESLint y TypeScript en las dos aplicaciones.                                                    |
| `npm run format` / `format:check`    | Prettier.                                                                                       |
| `npm run verificar`                  | Formato + lint + tipos + pruebas: lo que debe pasar antes de cerrar una fase.                   |

## Estructura

```
apps/
  backend/                      Node.js 22 + Express 5 (TypeScript, ejecutado con tsx)
    db/migraciones/             SQL numerado: 0001_esquema_inicial.sql, 0002_…
    db/seed/datos_demo.sql      Datos sintéticos (Anexo B.7)
    scripts/db.ts               migrar | sembrar | reiniciar
    src/
      app.ts                    Construye la app HTTP (sin abrir puerto; la usan las pruebas)
      server.ts                 Arranque, conexión a la base y apagado ordenado
      config/env.ts             Lee el .env de la raíz y valida variables con zod
      db/                       Pool de PostgreSQL y ejecutor de migraciones
      http/                     Errores, validación de entrada, registro de solicitudes
      lib/logger.ts             Logs de una línea, sin contenido de usuarios
      modules/sistema/          GET /api/salud (rutas → servicio → repositorio)
    test/                       Humo (sin red) e integracion/ (base real)
  frontend/                     Next.js 16 (App Router) + React 19
    src/
      app/                      Páginas: inicio (estado del sistema) y guía de estilos
      components/ui/            Componentes base: Boton, Tarjeta, CampoTexto, Insignia
      components/layout/        Encabezado, navegación, pie y logo
      config/navegacion.ts      Enlaces del menú principal
      lib/api/                  Cliente HTTP centralizado y llamadas por módulo
      styles/tokens.css         Tokens de diseño (paleta, tipografía, espaciado)
docs/                           Documento maestro y modelo de datos
```

## Cómo crece en las siguientes fases

- **Backend:** cada área del producto es un módulo en `apps/backend/src/modules/<modulo>/` con `*.routes.ts`, `*.service.ts` y `*.repository.ts`, registrado en `src/app.ts`. Módulos previstos: `seguridad` (sesión, rangos, permisos y DLP, Fase 2), `orientacion` (Fase 3), `comunidad` (Fase 4), `salas` (Fase 5), `avatar` (Fase 6) y `administracion` (Fase 7). Solo se crean cuando se usan.
- **Base de datos:** el esquema completo de B.4 ya existe. Un cambio de estructura es una migración nueva `000N_descripcion.sql`; los datos de demostración se agregan en `db/seed/datos_demo.sql`.
- **Frontend:** páginas en `src/app/`, llamadas al backend en `src/lib/api/<modulo>.ts` (siempre con el cliente central), enlaces del menú en `src/config/navegacion.ts`, y la interfaz con los componentes de `src/components/ui` y los tokens de `tokens.css` (ver `/guia-de-estilos`).
- Toda decisión técnica nueva se registra en una línea en `DECISIONES.md`.

## Base de datos

- PostgreSQL en Supabase, esquema propio **`app`**. La API pública de Supabase no lo expone y los roles `anon`/`authenticated` no tienen permisos: **el backend es el único acceso a los datos**. El frontend no usa las claves de Supabase.
- `db:reset` solo borra el esquema `app`; no toca nada más del proyecto de Supabase.
- Datos sintéticos cargados (B.7): 4 comunidades (A 10–12, B 13–15, C 16–17, D 18–22), 5 categorías, `Usuario_001` con alias `LunaDemo` en la comunidad 13–15, la sala «Bienestar cotidiano» y la fuente `InstituciónDemo · CanalDemo`, marcada como dato de demostración.
- Reglas que la propia base garantiza, además del backend: segmentación por edad en hilos, respuestas y salas; máximo 10 participantes por sala; bitácora de fuentes y auditoría de solo inserción; ninguna columna de edad exacta.

## Seguridad y restricciones

- El `.env` real nunca se versiona; `.env.example` solo tiene marcadores.
- Solo datos sintéticos. Ninguna institución, teléfono ni enlace real: las fuentes reales las investiga y verifica el equipo.
- Los logs y los eventos DLP no guardan contenido escrito por usuarios.
- **Pendiente y documentado en `DECISIONES.md`:** la verificación de edad real (en la Fase 2 será provisional), las fuentes institucionales verificadas y el mecanismo de auditoría definitivo.
- Solo ejecución local. No se despliega ni se publica nada.
