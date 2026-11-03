/**
 * Enlaces a Google Maps para la ubicación de una fuente presencial. Funciones puras, sin React.
 *
 * Privacidad: la plataforma nunca pide, consulta ni guarda la ubicación de la persona usuaria.
 * Los enlaces solo llevan el DESTINO (la institución); nunca un `origin`. Al abrir «Cómo llegar»,
 * es Google Maps quien, si la persona lo permite allí, usa su ubicación para trazar la ruta.
 *
 * Se usan las Maps URLs oficiales (sin clave) y, para la vista previa, la Maps Embed API
 * (con una clave pública restringida por dominio y por API; ver docs/UBICACION_FUENTES.md).
 */

/** Punto de una fuente, tal como lo guarda el backend. */
export type UbicacionFuente = {
  latitud: number;
  longitud: number;
  /** Identificador del lugar en Google, si se eligió de la búsqueda. */
  placeId: string | null;
  /** Dirección que corresponde a ese punto (la que se muestra junto al mapa). */
  direccion: string;
};

const MAPS = 'https://www.google.com/maps';
const EMBED = 'https://www.google.com/maps/embed/v1/place';

const punto = (ubicacion: UbicacionFuente) => `${ubicacion.latitud},${ubicacion.longitud}`;

/**
 * Indicaciones hasta la institución. Destino = sus coordenadas (exactas) y, si lo hay, el place_id
 * para que Google identifique el establecimiento. Sin `origin`: Google Maps decide desde dónde.
 */
export function urlComoLlegar(ubicacion: UbicacionFuente): string {
  const parametros = new URLSearchParams({ api: '1', destination: punto(ubicacion) });
  if (ubicacion.placeId) parametros.set('destination_place_id', ubicacion.placeId);
  return `${MAPS}/dir/?${parametros}`;
}

/** Abre el lugar en Google Maps (el mismo punto que la vista previa). */
export function urlVerEnMapa(ubicacion: UbicacionFuente): string {
  const parametros = new URLSearchParams({ api: '1', query: punto(ubicacion) });
  if (ubicacion.placeId) parametros.set('query_place_id', ubicacion.placeId);
  return `${MAPS}/search/?${parametros}`;
}

/**
 * Busca una dirección escrita en Google Maps. Para fuentes sin coordenadas: no se inventa un
 * punto, se deja que la persona vea qué encuentra Google con ese texto.
 */
export function urlBuscarDireccion(direccion: string): string {
  return `${MAPS}/search/?${new URLSearchParams({ api: '1', query: direccion.trim() })}`;
}

/**
 * Vista previa incrustada (Maps Embed API) con un marcador en las coordenadas guardadas: así el
 * mapa muestra exactamente el punto de la dirección, aunque el place_id cambie con el tiempo.
 * Sin clave devuelve null y la interfaz muestra una vista previa sin mapa.
 */
export function urlMapaIncrustado(
  ubicacion: UbicacionFuente,
  clave: string | null | undefined,
): string | null {
  if (!clave) return null;
  const parametros = new URLSearchParams({
    key: clave,
    q: punto(ubicacion),
    zoom: '16',
    language: 'es',
    region: 'CO',
  });
  return `${EMBED}?${parametros}`;
}

const PAR_COORDENADAS = /^\s*([+-]?\d{1,3}(?:\.\d+)?)\s*,\s*([+-]?\d{1,3}(?:\.\d+)?)\s*$/;

/**
 * Lee «latitud, longitud» tal como lo copia Google Maps (clic derecho sobre el punto), p. ej.
 * «4.14201, -73.62660». Devuelve null si no es un par válido; nunca completa ni adivina.
 */
export function leerCoordenadas(texto: string): { latitud: number; longitud: number } | null {
  const partes = PAR_COORDENADAS.exec(texto);
  if (!partes) return null;
  const latitud = Number(partes[1]);
  const longitud = Number(partes[2]);
  if (Math.abs(latitud) > 90 || Math.abs(longitud) > 180) return null;
  if (latitud === 0 && longitud === 0) return null;
  const redondear = (valor: number) => Math.round(valor * 1e6) / 1e6;
  return { latitud: redondear(latitud), longitud: redondear(longitud) };
}

/** «4.142012, -73.6266»: para mostrar o editar un punto ya guardado. */
export const formatearCoordenadas = (ubicacion: Pick<UbicacionFuente, 'latitud' | 'longitud'>) =>
  `${ubicacion.latitud}, ${ubicacion.longitud}`;
