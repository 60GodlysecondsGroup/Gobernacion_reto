# Herramientas, componentes de terceros y licencias

**Proyecto:** Comunidad Protegida · prototipo  
**Fecha de corte:** 2026-10-22  
**Base del inventario:** `package.json`, manifiestos de los workspaces, `package-lock.json`, árbol instalado y archivos de licencia versionados en el proyecto.

## Herramientas y servicios

| Herramienta / servicio | Uso identificado |
| --- | --- |
| Node.js 22 o superior y npm | Entorno de ejecución y administración de paquetes/workspaces. `.nvmrc` fija Node 22. |
| TypeScript | Tipado estático en frontend y backend. |
| Next.js y React | Aplicación web y componentes de interfaz. |
| Express | API backend. |
| PostgreSQL | Base relacional y migraciones SQL. El equipo documenta Supabase como servicio administrado de PostgreSQL; no usa Supabase Auth, Storage, Realtime ni API REST pública. |
| OpenAI API | Servicio externo opcional para funciones del asistente. Se invoca desde el backend mediante `fetch`; no se instala un SDK oficial de OpenAI en los manifiestos. La clave se configura en el servidor. |
| Git | Control de versiones; el historial documenta fases y cambios. |
| ESLint, TypeScript, Vitest, Supertest, Prettier | Lint, comprobación de tipos, pruebas y formato declarados en los scripts del proyecto. |

Node.js, npm, Git, PostgreSQL/Supabase y OpenAI son herramientas o servicios de ejecución, no componentes React de terceros. Sus condiciones de uso, alojamiento y tratamiento de datos deben revisarse aparte de las licencias npm.

## Componentes de terceros incluidos

Versiones según los manifiestos y el `package-lock.json` del repositorio. Las licencias son las declaradas por los paquetes instalados directos; cada paquete transitivo conserva sus propios términos y requiere revisión específica si se distribuye el producto.

| Componente | Versión | Licencia declarada | Uso |
| --- | ---: | --- | --- |
| Next.js y `@next/env` | 16.4.2 | MIT | Framework web y configuración de entorno. |
| React y React DOM | 19.3.1 | MIT | Componentes y renderizado. |
| `lucide-react` | 1.61.0 | ISC | Iconos. |
| `motion` | 14.5.0 | MIT | Animaciones e indicadores; el proyecto contempla reducir movimiento. |
| Express | 5.3.0 | MIT | Servidor HTTP/API. |
| `cors` | 2.8.6 | MIT | Middleware CORS. |
| Helmet | 8.3.0 | MIT | Cabeceras HTTP de seguridad. |
| `pg` | 8.23.1 | MIT | Cliente PostgreSQL. |
| `ws` | 8.22.0 | MIT | WebSocket. |
| `zod` | 4.6.7 | MIT | Validación de esquemas y configuración. |
| `concurrently` | 10.0.6 | MIT | Ejecución simultánea de frontend y backend. |
| Prettier | 3.9.10 | MIT | Formato de código y documentos. |
| TypeScript | 5.9.3 | Apache-2.0 | Compilador y comprobación de tipos. |
| ESLint, `@eslint/js`, `eslint-config-next`, `typescript-eslint` | 9.39.5 / 9.39.5 / 16.4.2 / 8.72.0 | MIT | Análisis estático y reglas. |
| Vitest | 5.0.5 | MIT | Ejecución de pruebas. |
| Supertest | 7.3.1 | MIT | Pruebas HTTP. |
| `tsx` | 4.23.15 | MIT | Ejecución TypeScript en desarrollo/scripts. |
| `embedded-postgres` | 18.4.0-beta.17 | MIT (paquete npm) | PostgreSQL local empaquetado para demo. El binario PostgreSQL incluido/descargado puede tener avisos y términos propios; revisar sus avisos de distribución antes de redistribuirlo. |
| `@types/node`, `@types/react`, `@types/react-dom`, `@types/cors`, `@types/express`, `@types/pg`, `@types/supertest`, `@types/ws` | Versiones en lockfile | MIT | Tipos de desarrollo. |

Este cuadro no es un inventario de todas las dependencias transitivas ni un dictamen de compatibilidad jurídica. Para una publicación, generar y revisar un SBOM/informe de licencias desde el lockfile, incluidos avisos de dependencias y artefactos binarios. No se detectó un archivo `LICENSE` en la raíz que defina una licencia de distribución para el código propio.

## Recursos tipográficos, gráficos y patrones

| Recurso | Procedencia / licencia registrada | Nota |
| --- | --- | --- |
| Atkinson Hyperlegible | Tipografía de Braille Institute of America, SIL Open Font License 1.1. | Archivos y texto de licencia en `apps/frontend/src/app/fuentes/`. |
| Bricolage Grotesque | Bricolage Grotesque Project Authors, SIL Open Font License 1.1. | Archivos y texto de licencia en `apps/frontend/src/app/fuentes/`. |
| Iconos Lucide | Paquete `lucide-react`, licencia ISC declarada por el paquete. | Usados desde la biblioteca; conservar los avisos de licencia aplicables. |
| Motion | Paquete `motion`, licencia MIT declarada por el paquete. | Animaciones de interfaz. |
| Marca Refugio y avatares | El registro de decisiones los identifica como creación original del equipo/proyecto; los avatares se dibujan por código. En los registros del catálogo la licencia figura como «Propia del proyecto». | No se encontró una licencia general en la raíz. El equipo debe elegir y añadir un aviso de copyright/licencia antes de redistribuir el código o los recursos propios. |
| Patrones de shadcn/ui, Magic UI, Aceternity UI y React Bits | `DECISIONES.md` indica que se tomaron patrones de interacción/estética y se reescribieron con CSS Modules, sin instalar esos paquetes. | No se identifican como dependencias incluidas. Si se copió código fuente de algún ejemplo, documentar archivo, URL y licencia correspondiente; el registro actual solo acredita patrones reimplementados. |

## Referencias de licencias y procedencia

- Licencias completas de las fuentes están junto a los archivos WOFF2 en `apps/frontend/src/app/fuentes/LICENCIA-atkinson-hyperlegible.txt` y `LICENCIA-bricolage-grotesque.txt`.
- Las licencias de paquetes se declaran en los manifiestos distribuidos con cada paquete instalado; las versiones fijadas/resueltas están en `package-lock.json`.
- Procedencia y licencia de avatares están registradas en `apps/backend/db/seed/datos_demo.sql` y en la decisión de recursos gráficos de `DECISIONES.md`.
- El inventario de alto nivel de la interfaz está en [`README.md`](../README.md) y [`DECISIONES.md`](../DECISIONES.md).

