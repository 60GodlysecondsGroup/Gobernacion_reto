/**
 * Número de WhatsApp de una fuente: validación (las mismas reglas y mensajes del backend,
 * `apps/backend/src/modules/fuentes/fuentes.esquemas.ts`), enlace oficial y formato para leerlo.
 * Funciones puras, sin React.
 *
 * El backend guarda el número en E.164 («+» y solo dígitos, p. ej. «+573001234567»). El enlace
 * es el oficial de WhatsApp, `https://wa.me/<dígitos>`: en el celular abre la aplicación (o su
 * alternativa web) y en el computador ofrece WhatsApp Web o la aplicación instalada. No lleva
 * texto prellenado ni nada de la persona usuaria.
 */

export const MENSAJES_WHATSAPP = {
  indicativo:
    'Escribe el celular con su indicativo internacional, empezando por + (p. ej. +57 300 123 4567).',
  formato:
    'Revisa el número: el indicativo no empieza por 0 y el número completo tiene de 8 a 15 dígitos.',
  colombia:
    'Un celular de Colombia (+57) tiene 10 dígitos y empieza por 3 (p. ej. +57 300 123 4567).',
  maximo: 'Usa como máximo 30 caracteres.',
} as const;

/** Quita los separadores que se suelen escribir: «+57 (300) 123-4567» → «+573001234567». */
export const normalizarWhatsapp = (valor: string) => valor.trim().replace(/[\s().-]/g, '');

/** Mensaje de error del número escrito, o null si es válido (vacío también es válido: opcional). */
export function errorWhatsapp(valor: string): string | null {
  const escrito = valor.trim();
  if (!escrito) return null;
  if (escrito.length > 30) return MENSAJES_WHATSAPP.maximo;
  if (!/^\+[0-9 ().-]+$/.test(escrito)) return MENSAJES_WHATSAPP.indicativo;
  const numero = normalizarWhatsapp(escrito);
  if (!/^\+[1-9]\d{7,14}$/.test(numero)) return MENSAJES_WHATSAPP.formato;
  if (numero.startsWith('+57') && !/^\+573\d{9}$/.test(numero)) return MENSAJES_WHATSAPP.colombia;
  return null;
}

/**
 * Enlace oficial para escribir por WhatsApp: `https://wa.me/` + el número internacional solo con
 * dígitos (sin «+», espacios ni guiones). null si el número no es válido: entonces no hay botón.
 */
export function urlWhatsapp(numero: string): string | null {
  if (errorWhatsapp(numero) !== null || !numero.trim()) return null;
  return `https://wa.me/${normalizarWhatsapp(numero).slice(1)}`;
}

/**
 * Número para leer: «+57 300 123 4567» en Colombia; en otros países, el indicativo separado no
 * se puede deducir con certeza, así que se muestra tal cual se guardó («+15550100000»).
 */
export function formatearWhatsapp(numero: string): string {
  const normalizado = normalizarWhatsapp(numero);
  const colombia = /^\+57(3\d{2})(\d{3})(\d{4})$/.exec(normalizado);
  return colombia ? `+57 ${colombia[1]} ${colombia[2]} ${colombia[3]}` : normalizado;
}
