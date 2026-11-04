/**
 * Clave PÚBLICA de Google Maps para la vista previa del mapa (Maps Embed API). Viaja al navegador
 * dentro de la URL del iframe, así que debe estar restringida en Google Cloud: solo Maps Embed API
 * y solo los dominios de la plataforma (ver docs/UBICACION_FUENTES.md). Sin clave, las fichas
 * muestran la dirección y los enlaces a Google Maps, sin mapa incrustado.
 *
 * Se lee con su nombre literal para que Next.js la incluya al compilar.
 */
export const CLAVE_MAPA_INCRUSTADO = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY || null;
