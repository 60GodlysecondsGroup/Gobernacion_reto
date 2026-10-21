const ZONA_HORARIA = 'America/Bogota';

const formatoFecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' });
const formatoFechaHora = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: ZONA_HORARIA,
});

/** `2026-10-20` → «20 de octubre de 2026». La fecha no tiene hora: se lee en UTC para no correrse. */
export const formatearFecha = (fecha: string) =>
  formatoFecha.format(new Date(`${fecha}T00:00:00Z`));

const formatoHora = new Intl.DateTimeFormat('es-CO', {
  timeStyle: 'short',
  timeZone: ZONA_HORARIA,
});

/** Marca de tiempo ISO → fecha y hora de Colombia. */
export const formatearFechaHora = (iso: string) => formatoFechaHora.format(new Date(iso));

/** Marca de tiempo ISO → solo la hora de Colombia (p. ej. en el chat de una sala). */
export const formatearHora = (iso: string) => formatoHora.format(new Date(iso));

/** Fecha de hoy en Colombia, `AAAA-MM-DD` (para campos de fecha). */
export const hoyEnColombia = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA }).format(new Date());

export const haceDias = (dias: number) =>
  dias <= 0 ? 'hoy' : dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
