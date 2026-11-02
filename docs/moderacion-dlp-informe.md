# Moderación DLP en foros y salas: auditoría y fortalecimiento

Informe comparativo antes/después del filtro de lenguaje ofensivo, sexual y de doble sentido (rama `feature/moderacion-dlp-foros-salas`, 02/11/2026). Todos los textos de prueba son sintéticos.

**Resultado en una línea:** antes el DLP no tenía ninguna regla de lenguaje ofensivo (bloqueaba 1 de 139 textos ofensivos de la batería, y por casualidad); ahora bloquea 139 de 139 sin bloquear ninguna de las 93 frases legítimas, en foros y en el chat de salas por igual. Sigue sin detectar todo: es un filtro por reglas, no un clasificador.

## 1. Auditoría (sin modificar reglas)

### Dónde están las reglas y quién interviene

| Pieza                                                                                  | Qué hace                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`db/seed/reglas_dlp.json`](../apps/backend/db/seed/reglas_dlp.json) → `app.regla_dlp` | 20 expresiones regulares en 6 categorías (`contacto`, `redes_externas`, `ubicacion`, `identidad`, `edad`, `publicidad_comercio`). **Ninguna categoría ni regla de groserías, insultos o lenguaje sexual.**                                                          |
| [`dlp.analizador.ts`](../apps/backend/src/modules/dlp/dlp.analizador.ts)               | Normaliza (minúsculas, sin tildes, espacios simples) y genera variantes contra evasión pensadas para datos de contacto (números dictados, dígitos separados, letras sueltas, leetspeak, repeticiones de 3+ letras, correos con «arroba»). Gana la acción más grave. |
| [`dlp.service.ts`](../apps/backend/src/modules/dlp/dlp.service.ts)                     | `revisar` y `exigirPermitido`. Caché de reglas 15 s, falla cerrado (503) si no puede leerlas, registra `app.evento_dlp` sin el texto, punto de extensión `clasificadores` (vacío).                                                                                  |
| [`hilos.service.ts`](../apps/backend/src/modules/comunidad/hilos.service.ts)           | Crear hilo (título y contenido) y responder pasan por `exigirPermitido` antes de guardar.                                                                                                                                                                           |
| [`salas.gestor.ts`](../apps/backend/src/modules/salas/salas.gestor.ts) (`hablar`)      | Cada mensaje del WebSocket pasa por `dlp.revisar` antes de difundirse.                                                                                                                                                                                              |
| Perfil, registro (nametag y hobbies), detalle de reportes                              | Mismo servicio.                                                                                                                                                                                                                                                     |
| `modules/moderacion`, `modules/administracion`                                         | Solo consultan eventos (Incidencias DLP) y activan o desactivan reglas o categorías. No intervienen en la decisión.                                                                                                                                                 |
| Frontend                                                                               | **No valida nada.** `NuevoHilo`, `VistaHilo` y `useSalaEnVivo` solo muestran el mensaje que devuelve el backend y conservan el texto para corregirlo. Ojo: `ComoFunciona.tsx` y `juegos.ts` ya decían que el filtro bloquea «lenguaje ofensivo», y no era cierto.   |

### Foros frente a salas

Los dos canales usan **la misma instancia** del servicio DLP, las mismas reglas y la misma normalización; la validación es solo de backend (correcto: el cliente no puede saltársela). Las diferencias son de transporte, no de cobertura:

| Aspecto          | Foros (REST)                                                                     | Chat de salas (WebSocket)                                                                      |
| ---------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Punto de control | `exigirPermitido` en `crear` (título y contenido) y `responder`                  | `dlp.revisar` en `hablar`                                                                      |
| Si se bloquea    | 422 `CONTENIDO_BLOQUEADO` con el campo; no se guarda; aviso «Hilo bloqueado»     | `mensaje_bloqueado` solo al autor; nadie más lo recibe; no se guarda (el chat nunca se guarda) |
| Registro         | `evento_dlp` con `tipo_contenido` `hilo` o `respuesta`, sin texto                | `evento_dlp` con `tipo_contenido = 'sala'`, sin texto                                          |
| Límites          | Título 3–120, hilo 2–5000, respuesta 1–2000 caracteres; sin límite de frecuencia | 1–500 caracteres, un mensaje cada 500 ms (el intento bloqueado también cuenta)                 |
| Si el DLP falla  | 503 `DLP_NO_DISPONIBLE`, no se publica                                           | error `DLP_NO_DISPONIBLE`, no se difunde                                                       |

### Diagnóstico

- **Falsos negativos (la causa del problema):** el 100 % del lenguaje ofensivo pasaba. No era un fallo de un canal ni de la normalización: el DLP se diseñó solo para datos personales (secciones 16.1 y B.5) y nunca tuvo reglas de convivencia. El seed lo reconoce para la demo («una respuesta grosera sintética que el DLP no detecta»). El único bloqueo de la batería («Mándame una foto en ropa interior») fue casual: la regla `identidad-solicitud` atrapa «mándame una foto».
- **Evasión:** aun con reglas, la normalización no habría bastado: no unificaba formas Unicode (ancho completo «ｐｕｔａ»), homoglifos cirílicos («рutа»), caracteres invisibles («pu[ZWSP]ta»), signos dentro de palabras («hijue.puta», «p/u/t/a»), comodines («p*ta»), letras dobles («puuta») ni fragmentos («hi jue pu ta»). El carácter de ancho cero también burlaba las reglas de contacto: «what[ZWSP]sapp» pasaba.
- **Falsos positivos:** ninguno en la batería (0 de 93) ni en el texto del repositorio, porque no había reglas de lenguaje.
- **Mensaje:** el único aviso disponible hablaba de «información que no puede compartirse… privacidad», que no explica nada a quien escribió una grosería.

## 2. Qué se implementó

1. **Dos categorías nuevas** en `app.categoria_dlp`: `lenguaje_ofensivo` y `contenido_sexual`, con **11 reglas** en datos ([`reglas_dlp.json`](../apps/backend/db/seed/reglas_dlp.json) y migración [`0008_dlp_lenguaje_ofensivo.sql`](../apps/backend/db/migraciones/0008_dlp_lenguaje_ofensivo.sql) para bases existentes; una prueba exige que los patrones de ambos archivos sean idénticos). Se activan o desactivan desde el panel como las demás y aparecen en Incidencias DLP.

   | Regla                       | Cubre                                                                                                                                |
   | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
   | `ofensivo-hijueputa`        | «Hijo de puta» y variantes colombianas (hijueputa, jueputa, ijueputa, hijo e puta).                                                  |
   | `ofensivo-groserias`        | puta y derivados, mierda, verga, culo, joder, carajo, coño, cabrón, pendejo, malparido, pirobo, «me cago en», «concha de tu madre».  |
   | `ofensivo-coloquial`        | gonorrea (salvo en contexto de salud), care-chimba/verga, mamagüevo, güevón/webón, marica/maricón/mk, monda, «me vale huevo».        |
   | `ofensivo-abreviaturas`     | hpta, jpta, hdp, ptm, ctm, mmgv… y «hp» como insulto (no con impresoras ni juegos).                                                  |
   | `ofensivo-insulto-dirigido` | Insultos dirigidos: «eres un idiota», «cállate, imbécil», «esa estúpida», «eres una perra», «hijo de perra».                         |
   | `ofensivo-acoso`            | Deseos de muerte e incitación a hacerse daño («ojalá te mueras», «mátate») e insultos discriminatorios (veneco, sudaca, machorra…).  |
   | `sexual-explicito`          | culiar, follar, pajearse, jalársela, pinga, tetas, porno, nudes, «el pack», sexo por cámara o «contigo».                             |
   | `sexual-imagenes`           | Pedir fotos íntimas, «desnúdate», «quieres ver mi pito» (salvo contexto médico).                                                     |
   | `sexual-actos`              | «chúpamela», «mámamela», «me la chupas», «chupa el pico».                                                                            |
   | `sexual-doble-sentido`      | «te la quiero meter», «te doy por detrás», «probar mi leche», «se me paró pensando en ti», «te voy a comer toda», «ponte en cuatro». |
   | `sexual-acoso`              | «estás muy rica», «mamacita rica», «te quiero coger».                                                                                |

2. **Normalización más fuerte para todas las reglas** (`normalizar`): NFKC, homoglifos cirílicos y griegos, eliminación de caracteres invisibles (ancho cero, guion suave, marcas de dirección), además de minúsculas y sin tildes. Beneficia también a contacto y redes.
3. **Variantes solo para las reglas de lenguaje** (`variantesLenguaje`): leetspeak extendido (`+`→t, `!`/`|`→i, `€`→e, además de 0134578@$), signos dentro de palabras, todas las letras repetidas, comodines `*`/`#` (prueba las letras más probables, con costo acotado) y fragmentos de 1 a 3 letras separados por espacios. No se aplican a contacto para no convertir fechas o decimales en falsos teléfonos.
4. **Contexto en lugar de palabras sueltas.** Las palabras ambiguas solo se bloquean en su construcción ofensiva; las letras dobles se escriben opcionales (`perr?a`) porque las variantes colapsan repeticiones. Excepciones explícitas: contexto de salud para «gonorrea», contexto médico para partes del cuerpo, ejercicio o danza para «abre las piernas», computadores o juegos para «hp».
5. **Mensaje propio** para estas categorías (`MENSAJE_BLOQUEO_LENGUAJE`): «Este mensaje contiene lenguaje ofensivo, vulgar o sexual que no está permitido en la comunidad. Revisa las reglas de convivencia y escríbelo de otra forma.» Las demás categorías conservan el de F22. Ninguno repite la palabra.
6. **Sin cambios de flujo:** mismo `ResultadoDlp`, mismo 422 con el campo, mismo `mensaje_bloqueado`, mismo `evento_dlp` sin texto, misma caché y falla cerrada. La API pública del módulo se amplió (nuevas exportaciones) sin romper la anterior; `asistente.service.ts` no se tocó.

## 3. Antes y después

Batería: [`test/dlp-lenguaje.casos.ts`](../apps/backend/test/dlp-lenguaje.casos.ts), 232 textos, contra las reglas del seed y el analizador de cada versión. «Antes» es el commit `de70028`.

| Grupo                                                        | Casos   | Bloqueados antes | Bloqueados después | Correctos después |
| ------------------------------------------------------------ | ------- | ---------------- | ------------------ | ----------------- |
| Groserías explícitas                                         | 13      | 0                | 13                 | 13/13             |
| Insultos                                                     | 21      | 0                | 21                 | 21/21             |
| Lenguaje sexual vulgar                                       | 21      | 1 (casual)       | 21                 | 21/21             |
| Doble sentido sexual                                         | 15      | 0                | 15                 | 15/15             |
| Evasión (signos, leetspeak, repeticiones, espacios, Unicode) | 45      | 0                | 45                 | 45/45             |
| Coloquiales colombianas                                      | 24      | 0                | 24                 | 24/24             |
| **Ofensivos (total)**                                        | **139** | **1 (0,7 %)**    | **139 (100 %)**    | **139/139**       |
| Legítimas (no deben bloquearse)                              | 93      | 0                | 0                  | 93/93             |

**Cuidado con la lectura del 100 %:** la batería y las reglas se escribieron juntas. Para medir algo menos optimista:

- **Conjunto de control** escrito después de las reglas y corrido sin ajustarlas: 25 de 30 ofensivos bloqueados y 49 de 50 legítimos permitidos. Fallaron «Me la chupas?», «Que se joda», «Me masturbo pensando en ti», «Sos un pelotudo» y «Eres un cagón»; se agregaron a las reglas y a la batería. El «falso positivo» fue «Marica no, perdón, quise decir María»: contiene la palabra y la política la bloquea; se dejó así.
- **Corpus de texto real del repositorio** (README, DECISIONES, DEMO, docs, evidencias, textos del frontend, seed y código): 13 702 frases, **0 falsos positivos**. Las únicas coincidencias son los ejemplos escritos a propósito en las pruebas, el analizador y esta documentación.
- **Rendimiento:** un texto de 5000 caracteres se revisa en unos 7 ms; el peor caso medido (5000 caracteres llenos de comodines) en unos 60 ms. Un mensaje de sala tiene como máximo 500.

## 4. Pruebas automatizadas

- [`test/dlp-lenguaje.test.ts`](../apps/backend/test/dlp-lenguaje.test.ts): toda la batería (cada caso es una prueba), pares de contexto (la misma palabra bloqueada y permitida), normalización y variantes, trucos Unicode en datos de contacto, tiempo acotado, sincronía seed/migración, desactivar reglas (F31), mensaje y evento en `hilo`, `respuesta`, `sala`, `perfil` y `reporte`, y el servicio de hilos real (no guarda el hilo ni la respuesta bloqueados).
- [`test/salas.test.ts`](../apps/backend/test/salas.test.ts): el gestor de salas bloquea seis variantes ofensivas (solo el autor ve el aviso, nadie recibe el mensaje) y difunde frases legítimas parecidas.
- Integración ([`comunidad.test.ts`](../apps/backend/test/integracion/comunidad.test.ts), [`salas.test.ts`](../apps/backend/test/integracion/salas.test.ts), [`moderacion.test.ts`](../apps/backend/test/integracion/moderacion.test.ts)): HTTP real contra PostgreSQL (422, nada guardado, `evento_dlp` con la categoría) y WebSocket real.

## 5. Límites conocidos

- Es un filtro por reglas: no entiende ironía, insultos sin palabras marcadas, groserías nuevas ni otro idioma. Por diseño, la respuesta grosera del seed («Tus preguntas siempre son aburridas…») sigue pasando: la cubre la segunda capa (reportes y moderación).
- Algunas decisiones son discutibles y quedan para revisión del equipo: se permiten «qué chimba» (en Colombia, «qué chévere»), «gorda» como apodo cariñoso, «joda» y «jodido»; se bloquean «marica» y «mk» aunque se usen como muletilla, y «carajo».
- Palabras con doble sentido muy dependientes del contexto («coger», «comer», «leche», «pico», «huevos») solo se bloquean en construcciones claras; variantes de doble sentido nuevas pueden pasar.
- «Me quiero morir» no se bloquea a propósito: bloquear una señal de ayuda la silencia. No hay todavía una ruta que la detecte y ofrezca ayuda; sería un trabajo aparte.
- Un hilo de 5000 caracteres armado para el peor caso cuesta unos 60 ms de CPU; los hilos no tienen límite de frecuencia.

## 6. Cómo reproducir

```bash
npm test                                   # incluye la batería completa (test/dlp-lenguaje.test.ts)
npm run test:db                            # integración con PostgreSQL local desechable
npm run db:migrate                         # en una base existente: aplica 0008 (categorías y reglas)
```

## Anexo: resultado por caso

«Antes» indica la regla que bloqueó en la versión anterior; «Después», el resultado actual (✗ marcaría un error). `[ZWSP]` es un espacio de ancho cero y `[cir. x]` una letra cirílica.

### Groserías explícitas

| Texto                           | Antes | Después | Regla (después)    |
| ------------------------------- | ----- | ------- | ------------------ |
| Eres un hijueputa               | pasa  | bloquea | ofensivo-hijueputa |
| Qué mierda de foro              | pasa  | bloquea | ofensivo-groserias |
| Vete a la mierda                | pasa  | bloquea | ofensivo-groserias |
| Hijo de puta, deja de escribir  | pasa  | bloquea | ofensivo-hijueputa |
| Puta vida, todo me sale mal     | pasa  | bloquea | ofensivo-groserias |
| Me importa un culo lo que digas | pasa  | bloquea | ofensivo-groserias |
| No me jodas más                 | pasa  | bloquea | ofensivo-groserias |
| Qué coño haces                  | pasa  | bloquea | ofensivo-groserias |
| Me vale verga                   | pasa  | bloquea | ofensivo-groserias |
| Qué putada lo del examen        | pasa  | bloquea | ofensivo-groserias |
| Ese profe es un cabrón          | pasa  | bloquea | ofensivo-groserias |
| Jueputa, se me olvidó la tarea  | pasa  | bloquea | ofensivo-hijueputa |
| Vete al carajo                  | pasa  | bloquea | ofensivo-groserias |

### Insultos

| Texto                    | Antes | Después | Regla (después)           |
| ------------------------ | ----- | ------- | ------------------------- |
| Eres un idiota           | pasa  | bloquea | ofensivo-insulto-dirigido |
| Eres una estúpida        | pasa  | bloquea | ofensivo-insulto-dirigido |
| Qué imbécil eres         | pasa  | bloquea | ofensivo-insulto-dirigido |
| Pedazo de mierda         | pasa  | bloquea | ofensivo-groserias        |
| Cállate, imbécil         | pasa  | bloquea | ofensivo-insulto-dirigido |
| Eres una perra           | pasa  | bloquea | ofensivo-insulto-dirigido |
| Eres una zorra           | pasa  | bloquea | ofensivo-insulto-dirigido |
| No sea pendejo           | pasa  | bloquea | ofensivo-groserias        |
| Eres un retrasado        | pasa  | bloquea | ofensivo-insulto-dirigido |
| Ese man es un maricón    | pasa  | bloquea | ofensivo-coloquial        |
| Usted es un malparido    | pasa  | bloquea | ofensivo-groserias        |
| Eres un inútil de mierda | pasa  | bloquea | ofensivo-groserias        |
| Ojalá te mueras          | pasa  | bloquea | ofensivo-acoso            |
| Mátate                   | pasa  | bloquea | ofensivo-acoso            |
| Cállese perra            | pasa  | bloquea | ofensivo-insulto-dirigido |
| Eres una puta            | pasa  | bloquea | ofensivo-groserias        |
| Eres un m0ng0l1c0        | pasa  | bloquea | ofensivo-insulto-dirigido |
| Hijo de perra            | pasa  | bloquea | ofensivo-insulto-dirigido |
| Sos un pelotudo          | pasa  | bloquea | ofensivo-insulto-dirigido |
| Eres un cagón            | pasa  | bloquea | ofensivo-insulto-dirigido |
| Ese veneco no sabe nada  | pasa  | bloquea | ofensivo-acoso            |

### Lenguaje sexual vulgar

| Texto                             | Antes                         | Después | Regla (después)     |
| --------------------------------- | ----------------------------- | ------- | ------------------- |
| Chúpamela                         | pasa                          | bloquea | sexual-actos        |
| Mámamela                          | pasa                          | bloquea | sexual-actos        |
| Quiero culiar contigo             | pasa                          | bloquea | sexual-explicito    |
| Mándame fotos desnuda             | pasa                          | bloquea | sexual-imagenes     |
| Pásame el pack                    | pasa                          | bloquea | sexual-explicito    |
| ¿Tienes nudes?                    | pasa                          | bloquea | sexual-explicito    |
| Hagamos sexo por cámara           | pasa                          | bloquea | sexual-explicito    |
| Qué tetas tan grandes             | pasa                          | bloquea | sexual-explicito    |
| Me la jalo pensando en ti         | pasa                          | bloquea | sexual-explicito    |
| Te quiero coger                   | pasa                          | bloquea | sexual-acoso        |
| Quiero follarte                   | pasa                          | bloquea | sexual-explicito    |
| Mira este video porno             | pasa                          | bloquea | sexual-explicito    |
| ¿Quieres ver mi pito?             | pasa                          | bloquea | sexual-imagenes     |
| Te voy a culiar                   | pasa                          | bloquea | sexual-explicito    |
| Mándame una foto en ropa interior | bloquea (identidad-solicitud) | bloquea | identidad-solicitud |
| Mándame nudes                     | pasa                          | bloquea | sexual-explicito    |
| Estás buenísima                   | pasa                          | bloquea | sexual-acoso        |
| Me la chupas?                     | pasa                          | bloquea | sexual-actos        |
| Chupame el pito                   | pasa                          | bloquea | sexual-actos        |
| Me masturbo pensando en ti        | pasa                          | bloquea | sexual-explicito    |
| Quiero ver tus tetas              | pasa                          | bloquea | sexual-explicito    |

### Doble sentido sexual

| Texto                                     | Antes | Después | Regla (después)      |
| ----------------------------------------- | ----- | ------- | -------------------- |
| Te la quiero meter                        | pasa  | bloquea | sexual-doble-sentido |
| Te doy por detrás                         | pasa  | bloquea | sexual-doble-sentido |
| Te voy a dar duro toda la noche           | pasa  | bloquea | sexual-doble-sentido |
| ¿Quieres probar mi leche?                 | pasa  | bloquea | sexual-doble-sentido |
| Se me paró pensando en ti                 | pasa  | bloquea | sexual-doble-sentido |
| Te voy a comer toda                       | pasa  | bloquea | sexual-doble-sentido |
| Te comería enterita                       | pasa  | bloquea | sexual-doble-sentido |
| Chupa el pico                             | pasa  | bloquea | sexual-actos         |
| Estás muy rica                            | pasa  | bloquea | sexual-acoso         |
| Mamacita rica                             | pasa  | bloquea | sexual-acoso         |
| Ponte en cuatro                           | pasa  | bloquea | sexual-doble-sentido |
| Abre las piernas                          | pasa  | bloquea | sexual-doble-sentido |
| Siéntate aquí que tengo algo duro para ti | pasa  | bloquea | sexual-doble-sentido |
| Te la meto toda                           | pasa  | bloquea | sexual-doble-sentido |
| Te voy a dar por detrás                   | pasa  | bloquea | sexual-doble-sentido |

### Evasión

| Texto                   | Antes | Después | Regla (después)           |
| ----------------------- | ----- | ------- | ------------------------- |
| p.u.t.a                 | pasa  | bloquea | ofensivo-groserias        |
| p u t a                 | pasa  | bloquea | ofensivo-groserias        |
| P-U-T-A                 | pasa  | bloquea | ofensivo-groserias        |
| p*u*t*a                 | pasa  | bloquea | ofensivo-groserias        |
| p_u_t_a                 | pasa  | bloquea | ofensivo-groserias        |
| p/u/t/a                 | pasa  | bloquea | ofensivo-groserias        |
| hijue.puta              | pasa  | bloquea | ofensivo-hijueputa        |
| h1jueput4               | pasa  | bloquea | ofensivo-hijueputa        |
| m13rd4                  | pasa  | bloquea | ofensivo-groserias        |
| pu+a                    | pasa  | bloquea | ofensivo-groserias        |
| puuuuta                 | pasa  | bloquea | ofensivo-groserias        |
| mieeeerda               | pasa  | bloquea | ofensivo-groserias        |
| malpariiido             | pasa  | bloquea | ofensivo-groserias        |
| gon0rr3a                | pasa  | bloquea | ofensivo-coloquial        |
| c4br0n                  | pasa  | bloquea | ofensivo-groserias        |
| v3rg4                   | pasa  | bloquea | ofensivo-groserias        |
| hpta                    | pasa  | bloquea | ofensivo-abreviaturas     |
| jpta                    | pasa  | bloquea | ofensivo-abreviaturas     |
| hdp                     | pasa  | bloquea | ofensivo-abreviaturas     |
| mrda                    | pasa  | bloquea | ofensivo-groserias        |
| pt@                     | pasa  | bloquea | ofensivo-groserias        |
| p*ta                    | pasa  | bloquea | ofensivo-groserias        |
| m*erda                  | pasa  | bloquea | ofensivo-groserias        |
| hijuep*ta               | pasa  | bloquea | ofensivo-hijueputa        |
| mal parido              | pasa  | bloquea | ofensivo-groserias        |
| hi jue pu ta            | pasa  | bloquea | ofensivo-hijueputa        |
| g o n o r r e a         | pasa  | bloquea | ofensivo-coloquial        |
| m-a-l-p-a-r-i-d-o       | pasa  | bloquea | ofensivo-groserias        |
| ijueputa                | pasa  | bloquea | ofensivo-hijueputa        |
| hijueputaaa             | pasa  | bloquea | ofensivo-hijueputa        |
| pvt@                    | pasa  | bloquea | ofensivo-groserias        |
| malp4r1d0               | pasa  | bloquea | ofensivo-groserias        |
| gonorea                 | pasa  | bloquea | ofensivo-coloquial        |
| ｐｕｔａ                | pasa  | bloquea | ofensivo-groserias        |
| [cir. р]ut[cir. а]      | pasa  | bloquea | ofensivo-groserias        |
| pu[ZWSP]ta              | pasa  | bloquea | ofensivo-groserias        |
| PUTA                    | pasa  | bloquea | ofensivo-groserias        |
| Púta                    | pasa  | bloquea | ofensivo-groserias        |
| HIJUEPUTA!!!            | pasa  | bloquea | ofensivo-hijueputa        |
| Eres un 1d10t4          | pasa  | bloquea | ofensivo-insulto-dirigido |
| e r e s u n a p e r r a | pasa  | bloquea | ofensivo-insulto-dirigido |
| H.P. sapo               | pasa  | bloquea | ofensivo-abreviaturas     |
| Pura mierdaaa           | pasa  | bloquea | ofensivo-groserias        |
| Pvto el que lo lea      | pasa  | bloquea | ofensivo-groserias        |
| M a r i c o n           | pasa  | bloquea | ofensivo-coloquial        |

### Coloquiales colombianas

| Texto                        | Antes | Después | Regla (después)       |
| ---------------------------- | ----- | ------- | --------------------- |
| Ese man es un pirobo         | pasa  | bloquea | ofensivo-groserias    |
| Gonorrea, deje de molestar   | pasa  | bloquea | ofensivo-coloquial    |
| Qué gonorrea tan fastidioso  | pasa  | bloquea | ofensivo-coloquial    |
| Malparido sapo               | pasa  | bloquea | ofensivo-groserias    |
| Carechimba                   | pasa  | bloquea | ofensivo-coloquial    |
| Careverga                    | pasa  | bloquea | ofensivo-coloquial    |
| Mamagüevo                    | pasa  | bloquea | ofensivo-coloquial    |
| Cállate güevón               | pasa  | bloquea | ofensivo-coloquial    |
| Qué huevón eres              | pasa  | bloquea | ofensivo-coloquial    |
| No sea webón                 | pasa  | bloquea | ofensivo-coloquial    |
| Marica, eres un bobo hp      | pasa  | bloquea | ofensivo-coloquial    |
| Qué más mk                   | pasa  | bloquea | ofensivo-coloquial    |
| Ese hp no sabe nada          | pasa  | bloquea | ofensivo-abreviaturas |
| Sapo hijueputa               | pasa  | bloquea | ofensivo-hijueputa    |
| Me rasco los huevos          | pasa  | bloquea | ofensivo-coloquial    |
| Usted es una gonorrea        | pasa  | bloquea | ofensivo-coloquial    |
| Qué malparida tan fastidiosa | pasa  | bloquea | ofensivo-groserias    |
| Hijueputa la profe           | pasa  | bloquea | ofensivo-hijueputa    |
| Ese man es una piroba        | pasa  | bloquea | ofensivo-groserias    |
| Malparidos todos             | pasa  | bloquea | ofensivo-groserias    |
| Vete a la verga              | pasa  | bloquea | ofensivo-groserias    |
| Que se joda                  | pasa  | bloquea | ofensivo-groserias    |
| Qué gonorrea de clase        | pasa  | bloquea | ofensivo-coloquial    |
| Me cago en todo              | pasa  | bloquea | ofensivo-groserias    |

### Legítimas (no deben bloquearse)

| Texto                                                                  | Antes | Después | Regla (después) |
| ---------------------------------------------------------------------- | ----- | ------- | --------------- |
| Estoy usando la computadora del colegio                                | pasa  | pasa    | —               |
| Voy a tomar un pico y pala para el jardín                              | pasa  | pasa    | —               |
| Hoy hay pico y placa                                                   | pasa  | pasa    | —               |
| Juguemos la polla de la Copa América                                   | pasa  | pasa    | —               |
| Me pica la garganta                                                    | pasa  | pasa    | —               |
| Comí huevos al desayuno                                                | pasa  | pasa    | —               |
| Me gustan los huevos revueltos con arepa                               | pasa  | pasa    | —               |
| La disputa entre los equipos fue larga                                 | pasa  | pasa    | —               |
| Hay que cuidar la reputación del grupo                                 | pasa  | pasa    | —               |
| El diputado habló en la radio                                          | pasa  | pasa    | —               |
| El sacapuntas no sirve                                                 | pasa  | pasa    | —               |
| Vi un zorro y una zorra en el documental                               | pasa  | pasa    | —               |
| Mi perra tuvo cachorros                                                | pasa  | pasa    | —               |
| Mi perrita se llama Luna                                               | pasa  | pasa    | —               |
| El cono de helado se derritió                                          | pasa  | pasa    | —               |
| Feliz año nuevo a todos                                                | pasa  | pasa    | —               |
| Hice un análisis del canal de televisión                               | pasa  | pasa    | —               |
| La gonorrea es una infección de transmisión sexual, ¿cómo se previene? | pasa  | pasa    | —               |
| ¿Qué es la masturbación? Me da pena preguntar                          | pasa  | pasa    | —               |
| El pene y la vagina son órganos del cuerpo                             | pasa  | pasa    | —               |
| Me siento como un idiota por haber reprobado                           | pasa  | pasa    | —               |
| Me sentí estúpido en la exposición                                     | pasa  | pasa    | —               |
| A mi tío le encanta mamar gallo                                        | pasa  | pasa    | —               |
| Qué mamera hacer tareas                                                | pasa  | pasa    | —               |
| Ese man es un berraco para el fútbol                                   | pasa  | pasa    | —               |
| Parce, qué bacano                                                      | pasa  | pasa    | —               |
| A veces me quiero morir de la vergüenza                                | pasa  | pasa    | —               |
| Vamos a coger el bus                                                   | pasa  | pasa    | —               |
| Me comí una arepa rica                                                 | pasa  | pasa    | —               |
| La sopa está rica                                                      | pasa  | pasa    | —               |
| Las cucas con leche son mis favoritas                                  | pasa  | pasa    | —               |
| Tomé la foto del pico de la montaña                                    | pasa  | pasa    | —               |
| Llegué a las 3 y pico                                                  | pasa  | pasa    | —               |
| El pájaro tiene el pico rojo                                           | pasa  | pasa    | —               |
| Mi impresora HP no imprime                                             | pasa  | pasa    | —               |
| Me quedan 10 hp en el juego                                            | pasa  | pasa    | —               |
| No hay que dar papaya                                                  | pasa  | pasa    | —               |
| Las conchas de la playa son bonitas                                    | pasa  | pasa    | —               |
| Jugamos a las bolas en el recreo                                       | pasa  | pasa    | —               |
| El árbitro sonó el pito                                                | pasa  | pasa    | —               |
| Me encanta el pepino en la ensalada                                    | pasa  | pasa    | —               |
| En cuatro días es el examen                                            | pasa  | pasa    | —               |
| Hay que estudiar duro                                                  | pasa  | pasa    | —               |
| Me tomé un vaso de leche                                               | pasa  | pasa    | —               |
| Vamos a comer                                                          | pasa  | pasa    | —               |
| Calculé el área del triángulo                                          | pasa  | pasa    | —               |
| Fue algo ridículo                                                      | pasa  | pasa    | —               |
| Siento mucha vergüenza                                                 | pasa  | pasa    | —               |
| La mariquita es un insecto                                             | pasa  | pasa    | —               |
| Fuimos a una pollada para recoger fondos                               | pasa  | pasa    | —               |
| Mi mamá me dijo que llegara temprano                                   | pasa  | pasa    | —               |
| Esa película estuvo muy buena                                          | pasa  | pasa    | —               |
| Tus preguntas siempre son aburridas, mejor no escribas más aquí.       | pasa  | pasa    | —               |
| Qué pendiente estás de todo                                            | pasa  | pasa    | —               |
| Me pusieron en el grupo de los perros calientes                        | pasa  | pasa    | —               |
| El documento está en el escritorio                                     | pasa  | pasa    | —               |
| Me caí y me pegué en la cola                                           | pasa  | pasa    | —               |
| Tengo una duda sobre las infecciones de transmisión sexual             | pasa  | pasa    | —               |
| Chupar limón ayuda con el mareo                                        | pasa  | pasa    | —               |
| Qué chimba de clase                                                    | pasa  | pasa    | —               |
| La pornografía puede afectar la salud mental                           | pasa  | pasa    | —               |
| Feliz cumpleaños, gorda linda                                          | pasa  | pasa    | —               |
| Esa es una buena pregunta                                              | pasa  | pasa    | —               |
| Hoy hice ejercicio en el parque                                        | pasa  | pasa    | —               |
| Parce, mañana hay parcial de cálculo, qué pereza                       | pasa  | pasa    | —               |
| Ese partido estuvo de infarto, qué golazo                              | pasa  | pasa    | —               |
| Mi abuela hace unas empanadas buenísimas                               | pasa  | pasa    | —               |
| Estás muy pendiente de tus amigos, eso es bonito                       | pasa  | pasa    | —               |
| Me puse a llorar en el baño del colegio                                | pasa  | pasa    | —               |
| Hoy me sentí muy sola en el descanso                                   | pasa  | pasa    | —               |
| Mi mamá está enferma y me preocupa                                     | pasa  | pasa    | —               |
| Qué rico ese pan de bono                                               | pasa  | pasa    | —               |
| Esta tarea está muy difícil                                            | pasa  | pasa    | —               |
| Mi hermano es un crack jugando Free Fire                               | pasa  | pasa    | —               |
| Los perros del vecino ladran toda la noche                             | pasa  | pasa    | —               |
| La profe de biología explicó el aparato reproductor                    | pasa  | pasa    | —               |
| Hay que ponerse las pilas con el ICFES                                 | pasa  | pasa    | —               |
| Qué boleta lo que pasó en el recreo                                    | pasa  | pasa    | —               |
| Ayer me caí en las escaleras, qué oso                                  | pasa  | pasa    | —               |
| El examen estuvo duro pero lo pasé                                     | pasa  | pasa    | —               |
| Mañana vamos a coger mangos donde la abuela                            | pasa  | pasa    | —               |
| Mi gata está en celo y maúlla mucho                                    | pasa  | pasa    | —               |
| ¿Qué hago si alguien me insulta en el colegio?                         | pasa  | pasa    | —               |
| Me dijeron una grosería y me sentí mal                                 | pasa  | pasa    | —               |
| La ITS más común se puede prevenir con condón                          | pasa  | pasa    | —               |
| No seas tan duro contigo mismo                                         | pasa  | pasa    | —               |
| Me siento una inútil cuando no entiendo matemáticas                    | pasa  | pasa    | —               |
| Soy un tonto, se me olvidó el cuaderno                                 | pasa  | pasa    | —               |
| El pico más alto de Colombia es el Cristóbal Colón                     | pasa  | pasa    | —               |
| Hay que pelar las papas para la sopa                                   | pasa  | pasa    | —               |
| El arroz con leche de mi tía es el mejor                               | pasa  | pasa    | —               |
| Los huevos de gallina criolla son más ricos                            | pasa  | pasa    | —               |
| Vimos micos en el parque Los Fundadores                                | pasa  | pasa    | —               |
