# Orientación: ruleta de temas y edificios

Rediseño de `/orientacion` (F04). Las necesidades siguen siendo categorías para buscar información: no hay preguntas, puntajes ni mensajes sobre el estado de nadie.

## Qué no cambia

- **Temas y destinos.** Los temas siguen llegando de `GET /api/orientacion/necesidades` (hoy seis: `bienestar`, `hablar_con_alguien`, `situacion_preocupa`, `amigo_preocupa`, `lineas_ayuda`, `informacion_institucional`), con su nombre, descripción y número de servicios.
- **Navegación.** Entrar a un tema es el mismo `next/link` de antes hacia `/orientacion/<código>`. Intro en la ruleta, tocar el centro o volver a tocar el tema elegido pulsan ese mismo enlace (`enlace.click()`), no una ruta paralela.
- **Rutas profundas y atajos.** `/orientacion/[necesidad]`, `/orientacion/servicios/[id]`, los atajos de la portada (`AtajosOrientacion`) y el resto de enlaces a `/orientacion` no cambian.
- El encabezado, los estados de carga y error, y el aviso de límites de la página se mantienen.

## Distribución

| Pantalla             | Distribución                                        | Puntero de la ruleta |
| -------------------- | --------------------------------------------------- | -------------------- |
| Móvil (< 48rem)      | Edificio arriba (rótulo en una fila), ruleta debajo | Arriba               |
| Tableta y escritorio | Ruleta a la izquierda, edificio a la derecha        | A la derecha         |

En el DOM la ruleta va primero (se elige y después se entra). En el móvil la escena recorta un poco de pradera y el rótulo es una sola fila para que edificio y ruleta quepan juntos en la pantalla.

## Piezas

- `lib/ruleta.ts`: geometría y selección puras (sectores, posiciones, tamaño de los botones, giro por el camino corto, teclas). Todo se calcula a partir del número de temas. Pruebas en `lib/ruleta.test.ts` con `node --test` (`npm test -w apps/frontend`), sin dependencias nuevas.
- `RuletaTemas`: `radiogroup` con foco itinerante. Flechas giran y eligen, Inicio y Fin van a los extremos, Intro o Espacio entran. Con el cursor, el centro muestra como vista previa el tema que está debajo. Botones de al menos 44 px.
- `EscenaEdificio`: pixel art propio (RF28) con el lenguaje del valle de la portada (`ValleComunidades`): tablones, tejados con los mismos colores, ventanas que se encienden, humo, nubes y Cocuyo volando al letrero. Un edificio por tema (casa, café, refugio, casas unidas, torre de señal, edificio institucional); un tema nuevo sin edificio propio se dibuja como casa con su icono y su tono (`config/necesidades.ts`).
- `ExploradorTemas`: une ruleta y edificio. Recuerda en `sessionStorage` el último tema elegido o visitado; sin almacenamiento, empieza en el primero.

Transiciones: la luz del cielo y la pradera se funde (1100 ms, como el cambio de estación del valle) y el edificio entra con las curvas de `lib/movimiento.ts`. Con «reducir movimiento», el disco cambia de posición sin girar, la luz cambia con un fundido breve y no hay animaciones de ambiente (`MotionConfig reducedMotion="user"` y `@media (prefers-reduced-motion)`).

## Verificación (1 de noviembre de 2026)

Backend en el puerto 4300 contra la base del `.env` y frontend `next dev` en el 3300, en el navegador integrado.

- Seis temas en la ruleta. Al elegir cada uno se marca `aria-checked`, cambian el edificio y el tono, y el enlace apunta a `/orientacion/<código>`. Esto se comprobó a 360, 768, 1024 y 1440 px.
- Teclado: las flechas giran por el camino corto (del último al primero suma 60°), Inicio y Fin funcionan, e Intro abre el tema elegido. El foco es visible.
- Ratón y toque: un toque elige y un segundo toque sobre el mismo tema entra. El edificio entra al tema. Los atajos de la portada llevan a `/orientacion/<código>`. «Todos los temas» vuelve con ese tema elegido. Un código inexistente muestra «Ese tema no existe».
- Sin desplazamiento horizontal a 320, 360, 375, 768, 1024 y 1440 px. Botones de 66 px o más. Ningún error de consola salvo el 404 esperado del tema inexistente.
- `npm run lint`, `npm run typecheck`, `npm test` (231 pruebas del backend y 10 de la ruleta) y `npm run build`: correctos. `prettier --check` pasa en los archivos de este cambio. En la rama base ya había 20 archivos con avisos de formato.
- No se verificó en un dispositivo táctil físico ni con lector de pantalla. «Reducir movimiento» se comprobó revisando las reglas CSS cargadas, sin emularlo en el navegador.
