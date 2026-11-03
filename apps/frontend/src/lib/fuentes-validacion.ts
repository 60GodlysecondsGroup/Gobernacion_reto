/**
 * Validación de los datos de una fuente en el navegador, para avisar mientras se escribe. Son las
 * mismas reglas y los mismos mensajes del backend (`apps/backend/src/modules/fuentes/
 * fuentes.esquemas.ts`), que es quien decide al guardar. El horario se valida en `horarios.ts`.
 */
export const MENSAJES_FUENTE = {
  institucion: 'Escribe el nombre de la institución (al menos 2 caracteres).',
  servicio: 'Escribe el nombre del servicio o canal (al menos 2 caracteres).',
  descripcion: 'La descripción necesita al menos 10 caracteres.',
  telefono: 'Usa de 3 a 20 caracteres: números, espacios, +, paréntesis o guiones.',
  telefonoObligatorio: 'Un canal telefónico necesita un teléfono.',
  enlace: 'Debe ser un enlace que empiece por http:// o https://.',
  enlaceObligatorio: 'Un canal web o de chat necesita un enlace.',
  fuenteOriginal: 'Indica de dónde sale la información (al menos 3 caracteres).',
  necesidades: 'Elige al menos un tema.',
  fechaVerificacion: 'Indica la fecha de verificación.',
  fechaFutura: 'La fecha de verificación no puede ser futura.',
  maximo: (n: number) => `Usa como máximo ${n} caracteres.`,
} as const;

export type DatosValidables = {
  institucion: string;
  servicio: string;
  descripcion: string;
  tipoCanal: string;
  telefono: string;
  enlace: string;
  fuenteOriginal: string;
  necesidades: string[];
  observaciones: string;
  fechaVerificacion?: string;
};

export type ErroresFuente = Partial<Record<keyof DatosValidables, string>>;

const TELEFONO = /^[0-9 +()-]{3,20}$/;

/** El teléfono es obligatorio en un canal telefónico; el enlace, en uno web o de chat. */
export const pideTelefono = (tipoCanal: string) => tipoCanal === 'telefono';
export const pideEnlace = (tipoCanal: string) => tipoCanal === 'web' || tipoCanal === 'chat';

function esEnlace(valor: string) {
  try {
    const { protocol, hostname } = new URL(valor);
    return (protocol === 'http:' || protocol === 'https:') && hostname.length > 0;
  } catch {
    return false;
  }
}

/**
 * Errores por campo. `hoy` (AAAA-MM-DD en Colombia) solo se usa si se valida la fecha de
 * verificación, que existe al crear.
 */
export function validarFuente(datos: DatosValidables, hoy?: string): ErroresFuente {
  const errores: ErroresFuente = {};
  const largo = (campo: keyof DatosValidables, min: number, max: number, mensaje: string) => {
    const valor = String(datos[campo] ?? '').trim();
    if (valor.length < min) errores[campo] = mensaje;
    else if (valor.length > max) errores[campo] = MENSAJES_FUENTE.maximo(max);
  };

  largo('institucion', 2, 120, MENSAJES_FUENTE.institucion);
  largo('servicio', 2, 120, MENSAJES_FUENTE.servicio);
  largo('descripcion', 10, 1000, MENSAJES_FUENTE.descripcion);
  largo('fuenteOriginal', 3, 300, MENSAJES_FUENTE.fuenteOriginal);

  const telefono = datos.telefono.trim();
  if (telefono && !TELEFONO.test(telefono)) errores.telefono = MENSAJES_FUENTE.telefono;
  else if (!telefono && pideTelefono(datos.tipoCanal)) {
    errores.telefono = MENSAJES_FUENTE.telefonoObligatorio;
  }

  const enlace = datos.enlace.trim();
  if (enlace && !esEnlace(enlace)) errores.enlace = MENSAJES_FUENTE.enlace;
  else if (enlace.length > 300) errores.enlace = MENSAJES_FUENTE.maximo(300);
  else if (!enlace && pideEnlace(datos.tipoCanal)) {
    errores.enlace = MENSAJES_FUENTE.enlaceObligatorio;
  }

  if (datos.necesidades.length === 0) errores.necesidades = MENSAJES_FUENTE.necesidades;
  if (datos.observaciones.trim().length > 500) {
    errores.observaciones = MENSAJES_FUENTE.maximo(500);
  }

  if (datos.fechaVerificacion !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fechaVerificacion)) {
      errores.fechaVerificacion = MENSAJES_FUENTE.fechaVerificacion;
    } else if (hoy && datos.fechaVerificacion > hoy) {
      errores.fechaVerificacion = MENSAJES_FUENTE.fechaFutura;
    }
  }
  return errores;
}
