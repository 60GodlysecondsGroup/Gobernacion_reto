# Ubicación de fuentes presenciales y «Cómo llegar»

Las fuentes con atención presencial (o híbrida) pueden tener una **dirección escrita** y una **ubicación en el mapa**. La ficha pública muestra un mapa pequeño, la dirección de ese mismo punto y el botón **«Cómo llegar»**, que abre las indicaciones en Google Maps.

> **Privacidad.** La plataforma **nunca** pide, consulta, captura ni guarda la ubicación de la persona usuaria: no usa `navigator.geolocation`, no pide permisos de ubicación y los enlaces a Google Maps llevan solo el **destino** (nunca un `origin`). Google Maps decide, con lo que la persona le permita allí, desde dónde trazar la ruta. No se calculan rutas en la plataforma ni se usa la Directions API.

## Modelo de datos (migración `0013_ubicacion_fuentes.sql`)

Columnas nuevas y opcionales en `app.fuente_institucional`:

| Columna               | Qué es                                                                  | Reglas                                                                    |
| --------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `direccion`           | Dirección escrita por la fuente oficial (con piso u oficina si aplica). | 5 a 200 caracteres, o `null`. Se muestra aunque no haya punto en el mapa. |
| `latitud`, `longitud` | Punto del establecimiento (WGS84, 6 decimales ≈ 0,1 m).                 | Siempre **en pareja**; rangos ±90 / ±180; se rechaza `0, 0`.              |
| `place_id`            | Identificador del lugar en Google, si se eligió en la búsqueda.         | Opcional (una ubicación ingresada a mano no lo tiene). Solo con un punto. |
| `direccion_ubicacion` | Dirección que corresponde a ese punto: la que se muestra junto al mapa. | Obligatoria si hay punto (5 a 300 caracteres).                            |

Una restricción de la base (`fuente_ubicacion_completa`) garantiza que no existan coordenadas sueltas, aunque alguien escriba sin pasar por la API. Las fuentes ya registradas quedan con todo en `null` y funcionan igual que antes. **No se guarda** ninguna respuesta completa de Google: solo esos cuatro datos.

En la API, la ubicación viaja como un objeto (o `null` para quitarla):

```json
{
  "direccion": "Calle 38 # 30-25, piso 2",
  "ubicacion": {
    "latitud": 4.151235,
    "longitud": -73.639877,
    "placeId": "ChIJ…",
    "direccion": "Cl. 38 #30-25, Villavicencio, Meta, Colombia"
  }
}
```

Los dos campos están en `GET/POST/PUT /api/gestion/fuentes…` y en las fichas públicas (`/api/orientacion/…`). Cada cambio queda en la bitácora de la fuente. Un cliente que no envía los campos los deja en `null`, igual que `horarioSemanal`.

## Panel de fuentes (gestión)

En **Fuentes → Nueva fuente** o al editar una fuente, la sección **3 · Dirección y ubicación**:

- **Dirección escrita (opcional).**
- **Ubicación en el mapa (opcional):**
  - **Buscar** una dirección o establecimiento (autocompletado de Google Places, limitado a Colombia y con preferencia por Villavicencio). Al elegir un resultado se guardan el punto, el `place_id` y la dirección de ese punto.
  - **Ingresar a mano**: las coordenadas copiadas de Google Maps (clic derecho sobre el lugar → clic en las coordenadas) y su dirección. Sirve cuando la búsqueda no está configurada o no encuentra el lugar. **Nunca** se calculan coordenadas a partir de un texto.
  - **Cambiar** o **Quitar** la ubicación. Se guarda con «Guardar cambios», sin borrar la fuente.

Es opcional para todos los tipos de canal: recomendada para el canal presencial y disponible para las fuentes híbridas (p. ej. una línea telefónica que también atiende en una sede), que conservan sus canales virtuales. Las categorías de canal no cambiaron.

La búsqueda pasa por el backend (`GET /api/gestion/fuentes/lugares…`, solo con el permiso `gestionar_fuentes`, hasta 60 consultas por minuto por cuenta): la clave privada nunca llega al navegador.

## Ficha pública

| La fuente tiene…       | Se muestra                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| Ubicación              | «Dónde queda»: mapa pequeño con marcador (clicable), dirección del punto, «Cómo llegar» y «Ver en Google Maps». |
| Solo dirección escrita | La dirección y «Buscar en Google Maps» (búsqueda del texto, sin inventar coordenadas).                          |
| Nada                   | Nada: nunca un mapa vacío.                                                                                      |
| Dato de demostración   | Mapa y dirección sin enlaces activos, como sus demás canales.                                                   |

Si además hay una dirección escrita distinta (piso, oficina), aparece como «Indicaciones». Sin clave para el mapa incrustado, la vista previa muestra un pin con la dirección y los enlaces siguen funcionando. La dirección y los botones también aparecen en «Cómo contactar» y en la consulta rápida de fichas (`DetalleServicio`).

Enlaces (Maps URLs oficiales, sin clave):

- Cómo llegar: `https://www.google.com/maps/dir/?api=1&destination=LAT,LNG&destination_place_id=PLACE_ID`
- Ver el lugar: `https://www.google.com/maps/search/?api=1&query=LAT,LNG&query_place_id=PLACE_ID`
- Buscar una dirección escrita: `https://www.google.com/maps/search/?api=1&query=DIRECCIÓN`

El mapa incrustado usa las **coordenadas guardadas** (`q=LAT,LNG`), así que siempre marca exactamente el punto de la dirección mostrada, aunque el `place_id` cambie con el tiempo. El iframe carga en diferido y queda fuera del orden de tabulación: toda su superficie es un solo enlace accesible a Google Maps.

## Configuración de Google Maps Platform

Solo se usan dos APIs, cada una con **su propia clave**:

| Variable                                | Dónde              | API que debe habilitarse                            | Restricciones de la clave                                                                                                                                                                                                                       |
| --------------------------------------- | ------------------ | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_MAPS_SERVER_API_KEY`            | Backend (privada)  | **Places API (New)** (Autocomplete y Place Details) | Restricción de API: solo Places API (New). Restricción de aplicación: direcciones IP si el backend tiene IP fija; en Vercel (IP variable), ninguna, compensada con la restricción de API y cuotas bajas. **Nunca** con prefijo `NEXT_PUBLIC_`.  |
| `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY` | Frontend (pública) | **Maps Embed API**                                  | Restricción de API: solo Maps Embed API. Restricción de aplicación: sitios web (referentes HTTP), p. ej. `https://tu-dominio/*`, `https://*.vercel.app/*` si se usan vistas previas y `http://localhost:3000/*` solo en la clave de desarrollo. |

- **Maps URLs** («Cómo llegar», «Ver en Google Maps», «Buscar») no necesitan clave.
- **No se usan** Maps JavaScript API, Directions API, Geocoding API ni Static Maps.
- La clave del frontend es pública por diseño (va en la URL del iframe): su seguridad depende de las restricciones. La del backend es secreta.
- `NEXT_PUBLIC_*` se incluye al **compilar** el frontend: tras cambiarla en Vercel hay que volver a desplegar.

### Facturación y cuotas

- **Maps Embed API**: sin costo por carga del modo `place` (no consume cuota facturable).
- **Places API (New)**: facturable. El panel agrupa las sugerencias y el detalle de una misma búsqueda con un **token de sesión**, pide solo los campos `id,displayName,formattedAddress,location` (máscara de campos) y espera 350 ms entre teclas. Recomendado: un tope diario de solicitudes en Google Cloud Console (Cuotas) y una alerta de presupuesto. Solo el personal de gestión puede buscar.

### Degradación controlada

| Falta…                                  | Qué pasa                                                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_MAPS_SERVER_API_KEY`            | El panel avisa que la búsqueda no está configurada y ofrece ingresar la ubicación a mano. Nada se rompe.              |
| `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY` | La vista previa muestra un pin con la dirección (sin iframe); «Cómo llegar» y «Ver en Google Maps» funcionan.         |
| Google no responde                      | La búsqueda muestra un error y permite reintentar o ingresar a mano; las fichas no dependen de Google para mostrarse. |

## Archivo de carga

`fuentes_institucionales.json` acepta los mismos campos opcionales `direccion` y `ubicacion` (ver [FUENTES.md](FUENTES.md)). Como con el resto de campos, el archivo es la fuente de verdad al cargar: si un registro no los trae, la carga los deja en `null`.
