import { z } from 'zod';
import { ErrorApp } from '../../http/errores.js';
import type { Logger } from '../../lib/logger.js';

/**
 * Búsqueda de lugares para ubicar una fuente presencial (solo panel de fuentes), con Google
 * Places API (New). La clave es privada y vive solo en el backend (`GOOGLE_MAPS_SERVER_API_KEY`):
 * el navegador nunca la ve. Se piden únicamente los campos necesarios (máscara de campos) y no se
 * guarda la respuesta de Google: el formulario conserva solo el punto, el place_id y la dirección.
 *
 * Nada de esto toca la ubicación de las personas usuarias: se busca la de una institución.
 */

const URL_PLACES = 'https://places.googleapis.com/v1';
const TIEMPO_MAXIMO_MS = 5000;

/** Sesgo hacia Villavicencio (el prototipo es para sus jóvenes); los resultados son de Colombia. */
const CENTRO_BUSQUEDA = { latitude: 4.142, longitude: -73.6266 };
const RADIO_BUSQUEDA_M = 50_000;

export type SugerenciaLugar = {
  placeId: string;
  /** Nombre del lugar o primera línea de la dirección. */
  principal: string;
  /** Resto de la dirección (ciudad, departamento…), si lo hay. */
  secundario: string | null;
};

/** Lo justo para guardar la ubicación de una fuente. */
export type LugarSeleccionado = {
  placeId: string;
  nombre: string | null;
  latitud: number;
  longitud: number;
  direccion: string;
};

export type ClienteLugares = {
  /** false sin clave configurada: el panel ofrece entonces ingresar la ubicación a mano. */
  readonly disponible: boolean;
  sugerencias(texto: string, sesionBusqueda: string | null): Promise<SugerenciaLugar[]>;
  lugar(placeId: string, sesionBusqueda: string | null): Promise<LugarSeleccionado>;
};

const esquemaSugerencias = z.object({
  suggestions: z
    .array(
      z.object({
        placePrediction: z
          .object({
            placeId: z.string(),
            text: z.object({ text: z.string() }).optional(),
            structuredFormat: z
              .object({
                mainText: z.object({ text: z.string() }),
                secondaryText: z.object({ text: z.string() }).optional(),
              })
              .optional(),
          })
          .optional(),
      }),
    )
    .default([]),
});

const esquemaLugar = z.object({
  id: z.string(),
  displayName: z.object({ text: z.string() }).optional(),
  formattedAddress: z.string().optional(),
  location: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
});

const noConfigurado = () =>
  new ErrorApp(
    503,
    'LUGARES_NO_CONFIGURADO',
    'La búsqueda en Google Maps no está configurada. Puedes ingresar la ubicación a mano.',
  );

const noDisponible = () =>
  new ErrorApp(
    502,
    'LUGARES_NO_DISPONIBLE',
    'No se pudo consultar Google Maps en este momento. Intenta de nuevo o ingresa la ubicación a mano.',
  );

const redondear = (valor: number) => Math.round(valor * 1e6) / 1e6;

export function crearClienteLugares({
  claveApi,
  logger,
  fetch: hacerFetch = globalThis.fetch,
}: {
  claveApi?: string;
  logger?: Logger;
  fetch?: typeof globalThis.fetch;
}): ClienteLugares {
  async function consultar(
    ruta: string,
    opciones: { metodo: 'GET' | 'POST'; mascara: string; cuerpo?: unknown },
  ): Promise<unknown> {
    if (!claveApi) throw noConfigurado();
    let respuesta: Response;
    try {
      respuesta = await hacerFetch(`${URL_PLACES}${ruta}`, {
        method: opciones.metodo,
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': claveApi,
          'X-Goog-FieldMask': opciones.mascara,
        },
        body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      });
    } catch (error) {
      logger?.warn('No se pudo contactar Google Places', {
        motivo: error instanceof Error ? error.name : 'desconocido',
      });
      throw noDisponible();
    }
    if (respuesta.status === 404 || respuesta.status === 400) {
      throw new ErrorApp(404, 'NO_ENCONTRADO', 'Google Maps no encontró ese lugar.');
    }
    if (!respuesta.ok) {
      // Nunca se registra la clave ni la respuesta completa: solo el estado.
      logger?.warn('Google Places respondió con error', { estado: respuesta.status });
      throw noDisponible();
    }
    return respuesta.json();
  }

  return {
    disponible: Boolean(claveApi),

    async sugerencias(texto, sesionBusqueda) {
      const datos = esquemaSugerencias.safeParse(
        await consultar('/places:autocomplete', {
          metodo: 'POST',
          mascara:
            'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,' +
            'suggestions.placePrediction.structuredFormat',
          cuerpo: {
            input: texto,
            languageCode: 'es',
            regionCode: 'co',
            includedRegionCodes: ['co'],
            locationBias: { circle: { center: CENTRO_BUSQUEDA, radius: RADIO_BUSQUEDA_M } },
            ...(sesionBusqueda ? { sessionToken: sesionBusqueda } : {}),
          },
        }),
      );
      if (!datos.success) throw noDisponible();
      return datos.data.suggestions.flatMap(({ placePrediction: p }) =>
        p
          ? [
              {
                placeId: p.placeId,
                principal: p.structuredFormat?.mainText.text ?? p.text?.text ?? p.placeId,
                secundario: p.structuredFormat?.secondaryText?.text ?? null,
              },
            ]
          : [],
      );
    },

    async lugar(placeId, sesionBusqueda) {
      const parametros = new URLSearchParams({ languageCode: 'es', regionCode: 'co' });
      if (sesionBusqueda) parametros.set('sessionToken', sesionBusqueda);
      const datos = esquemaLugar.safeParse(
        await consultar(`/places/${encodeURIComponent(placeId)}?${parametros}`, {
          metodo: 'GET',
          mascara: 'id,displayName,formattedAddress,location',
        }),
      );
      if (!datos.success) throw noDisponible();
      const { id, displayName, formattedAddress, location } = datos.data;
      // Sin punto o sin dirección no hay ubicación que guardar: no se completa con suposiciones.
      if (!location || !formattedAddress) {
        throw new ErrorApp(
          422,
          'LUGAR_SIN_UBICACION',
          'Ese resultado no tiene una ubicación precisa. Elige otro o ingrésala a mano.',
        );
      }
      return {
        placeId: id,
        nombre: displayName?.text ?? null,
        latitud: redondear(location.latitude),
        longitud: redondear(location.longitude),
        direccion: formattedAddress,
      };
    },
  };
}
