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

const formatoRelativo = new Intl.RelativeTimeFormat('es-CO', { numeric: 'auto' });

/** Marca de tiempo ISO → «hace 5 minutos», «ayer»… (para listas de moderación). */
export function haceTiempo(iso: string, ahora = Date.now()) {
  const segundos = Math.round((new Date(iso).getTime() - ahora) / 1000);
  const unidades: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unidad, tamano] of unidades) {
    if (Math.abs(segundos) >= tamano) {
      return formatoRelativo.format(Math.round(segundos / tamano), unidad);
    }
  }
  return 'hace un momento';
}
