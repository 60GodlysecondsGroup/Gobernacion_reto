/**
 * Revisión de datos personales antes de enviar un mensaje de Cocuyo al proveedor de IA. Reutiliza
 * las reglas DLP activas de la base (API pública del módulo dlp: reglas compiladas + `analizar`)
 * sin registrar eventos: el mensaje no se publica, solo se decide si puede salir del backend.
 *
 * Falla cerrado: si las reglas no se pueden leer, el resultado es «desconocido» y el mensaje no
 * se envía a la IA (Cocuyo responde igual, con la respuesta predeterminada).
 *
 * Las reglas de convivencia (lenguaje ofensivo y contenido sexual, migración 0008) no son datos
 * personales: un insulto no debe recibir el aviso de privacidad. Se evalúan aparte y dan
 * «ofensivo»: el mensaje tampoco sale hacia la IA, pero sin aviso de datos personales.
 */
import type { Logger } from '../../lib/logger.js';
import { analizar, esCategoriaLenguaje, type ReglaCompilada } from '../dlp/dlp.analizador.js';
import { pareceDatoPersonal } from './cocuyo.clasificador.js';

export type ResultadoPrivacidad = 'limpio' | 'personal' | 'ofensivo' | 'desconocido';
export type RevisorPrivacidad = (texto: string) => Promise<ResultadoPrivacidad>;

/** Categorías DLP que identifican o ubican a una persona. */
const CATEGORIAS_PERSONALES = new Set(['contacto', 'ubicacion', 'identidad', 'edad']);

/** Solo las expresiones locales: para pruebas y cuando no hay base de datos. */
export const revisorLocal: RevisorPrivacidad = async (texto) =>
  pareceDatoPersonal(texto) ? 'personal' : 'limpio';

export function crearRevisorPrivacidad({
  reglas,
  logger,
  ttlMs = 60_000,
}: {
  reglas: () => Promise<ReglaCompilada[]>;
  logger?: Logger;
  ttlMs?: number;
}): RevisorPrivacidad {
  let cache: { reglas: ReglaCompilada[]; vence: number } | null = null;

  return async (texto) => {
    if (pareceDatoPersonal(texto)) return 'personal';
    let activas: ReglaCompilada[];
    try {
      if (!cache || cache.vence <= Date.now()) {
        cache = { reglas: await reglas(), vence: Date.now() + ttlMs };
      }
      activas = cache.reglas;
    } catch (error) {
      logger?.warn('Cocuyo: no se pudieron leer las reglas DLP; el mensaje no irá a la IA', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 'desconocido';
    }
    // Primero los datos personales, sin las reglas de lenguaje: así una grosería en el mismo
    // mensaje no tapa un dato personal (`analizar` devuelve una sola detección).
    const deteccion = analizar(
      texto,
      activas.filter((regla) => !esCategoriaLenguaje(regla.categoria)),
    );
    if (
      deteccion &&
      (deteccion.accion === 'bloquear' || CATEGORIAS_PERSONALES.has(deteccion.categoria))
    ) {
      return 'personal';
    }
    const lenguaje = activas.filter((regla) => esCategoriaLenguaje(regla.categoria));
    return lenguaje.length > 0 && analizar(texto, lenguaje) ? 'ofensivo' : 'limpio';
  };
}
