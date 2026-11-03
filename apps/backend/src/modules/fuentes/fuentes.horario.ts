import { z } from 'zod';

/**
 * Horario semanal estructurado de una fuente: para cada día, sus intervalos de atención.
 * Un día sin intervalos es un día sin atención. Las horas van en `HH:MM` (24 h).
 *
 * Medianoche: todos los intervalos caben dentro de su día. «24:00» solo vale como cierre (fin
 * del día), así «00:00–24:00» es «24 horas». Un horario que cruza la medianoche se registra
 * partido: «Viernes 22:00–24:00» y «Sábado 00:00–02:00». Así no hay intervalos ambiguos y los
 * solapamientos se comprueban dentro de cada día.
 */
export const DIAS_SEMANA = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
] as const;
export type DiaSemana = (typeof DIAS_SEMANA)[number];

const NOMBRE_DIA: Record<DiaSemana, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

export const MAX_INTERVALOS_DIA = 4;

export type Intervalo = { apertura: string; cierre: string };
export type HorarioSemanal = Record<DiaSemana, Intervalo[]>;

/** Minutos desde las 00:00. «24:00» son 1440. */
export const aMinutos = (hora: string) => {
  const [h, m] = hora.split(':').map(Number);
  return h! * 60 + m!;
};

const apertura = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa una hora válida (HH:MM).');
const cierre = z
  .string()
  .regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, 'Usa una hora válida (HH:MM).');

const intervalosDelDia = z
  .array(z.object({ apertura, cierre }).strict())
  .max(MAX_INTERVALOS_DIA, `Como máximo ${MAX_INTERVALOS_DIA} intervalos por día.`)
  .superRefine((intervalos, ctx) => {
    intervalos.forEach(({ apertura, cierre }, i) => {
      if (aMinutos(cierre) <= aMinutos(apertura)) {
        ctx.addIssue({
          code: 'custom',
          path: [i, 'cierre'],
          message: 'La hora de cierre debe ser posterior a la de apertura.',
        });
      }
    });
    const ordenados = intervalos
      .map((intervalo, i) => ({ ...intervalo, i }))
      .sort((a, b) => aMinutos(a.apertura) - aMinutos(b.apertura));
    for (let k = 1; k < ordenados.length; k++) {
      if (aMinutos(ordenados[k]!.apertura) < aMinutos(ordenados[k - 1]!.cierre)) {
        ctx.addIssue({
          code: 'custom',
          path: [ordenados[k]!.i, 'apertura'],
          message: 'Este intervalo se cruza con otro del mismo día.',
        });
      }
    }
  })
  // Se guardan ordenados: la misma configuración produce siempre el mismo valor.
  .transform((intervalos) =>
    [...intervalos].sort((a, b) => aMinutos(a.apertura) - aMinutos(b.apertura)),
  );

/**
 * Horario semanal recibido de la API o del archivo de carga. Siempre trae los siete días;
 * un horario sin ningún día con atención equivale a «sin horario» (null).
 */
export const esquemaHorarioSemanal = z
  .object(Object.fromEntries(DIAS_SEMANA.map((dia) => [dia, intervalosDelDia])))
  .strict()
  .transform((dias) => {
    const horario = dias as HorarioSemanal;
    return DIAS_SEMANA.some((dia) => horario[dia].length > 0) ? horario : null;
  });

/** «8:00 a. m.», «12:00 p. m.», «medianoche» (cierre 24:00). */
export function formatearHora(hora: string): string {
  if (hora === '24:00') return 'medianoche';
  const minutos = aMinutos(hora);
  const h = Math.floor(minutos / 60);
  const m = String(minutos % 60).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

const formatearIntervalos = (intervalos: Intervalo[]) => {
  if (intervalos.length === 0) return 'sin atención';
  if (
    intervalos.length === 1 &&
    intervalos[0]!.apertura === '00:00' &&
    intervalos[0]!.cierre === '24:00'
  ) {
    return '24 horas';
  }
  const partes = intervalos.map((i) => `${formatearHora(i.apertura)} – ${formatearHora(i.cierre)}`);
  return partes.length === 1
    ? partes[0]!
    : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
};

/**
 * Texto legible del horario, el que se guarda en `horario` y ven la ficha pública, el asistente
 * y la bitácora. Agrupa los días seguidos con el mismo horario:
 * «Lunes a viernes: 8:00 a. m. – 5:00 p. m.; Sábado: 8:00 a. m. – 12:00 p. m.; Domingo: sin atención».
 */
export function formatearHorario(horario: HorarioSemanal): string {
  const grupos: { desde: DiaSemana; hasta: DiaSemana; texto: string }[] = [];
  for (const dia of DIAS_SEMANA) {
    const texto = formatearIntervalos(horario[dia]);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.texto === texto) ultimo.hasta = dia;
    else grupos.push({ desde: dia, hasta: dia, texto });
  }
  return grupos
    .map(({ desde, hasta, texto }) => {
      const distancia = DIAS_SEMANA.indexOf(hasta) - DIAS_SEMANA.indexOf(desde);
      const dias =
        distancia === 0
          ? NOMBRE_DIA[desde]
          : `${NOMBRE_DIA[desde]} ${distancia === 1 ? 'y' : 'a'} ${NOMBRE_DIA[hasta].toLowerCase()}`;
      return `${dias}: ${texto}`;
    })
    .join('; ');
}
