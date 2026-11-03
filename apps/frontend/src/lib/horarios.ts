/**
 * Horario semanal de una fuente: tipos, validación y texto legible. Funciones puras (sin React),
 * con la misma forma y las mismas reglas que valida el backend
 * (`apps/backend/src/modules/fuentes/fuentes.horario.ts`); el backend decide al guardar.
 *
 * Un día sin intervalos es un día sin atención. «24:00» solo vale como cierre (medianoche): un
 * horario que cruza la medianoche se registra partido entre los dos días.
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

export const NOMBRE_DIA: Record<DiaSemana, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

export const DIAS_HABILES: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
export const MAX_INTERVALOS_DIA = 4;

export type Intervalo = { apertura: string; cierre: string };
export type HorarioSemanal = Record<DiaSemana, Intervalo[]>;

/**
 * Lo que se está editando: cada día recuerda sus intervalos aunque se marque sin atención,
 * para no perderlos al volver a activarlo. Las horas vacías son intervalos incompletos.
 */
export type BorradorHorario = Record<DiaSemana, { activo: boolean; intervalos: Intervalo[] }>;

/** Errores por ruta: `lunes.0.cierre`, `lunes.1.apertura`… */
export type ErroresHorario = Record<string, string>;

export const INTERVALO_OFICINA: Intervalo = { apertura: '08:00', cierre: '17:00' };
export const INTERVALO_24_HORAS: Intervalo = { apertura: '00:00', cierre: '24:00' };

const porDia = <T>(valor: (dia: DiaSemana) => T) =>
  Object.fromEntries(DIAS_SEMANA.map((dia) => [dia, valor(dia)])) as Record<DiaSemana, T>;

export const borradorVacio = (): BorradorHorario =>
  porDia(() => ({ activo: false, intervalos: [] }));

export const borradorDesde = (horario: HorarioSemanal | null): BorradorHorario =>
  horario
    ? porDia((dia) => ({
        activo: (horario[dia] ?? []).length > 0,
        intervalos: (horario[dia] ?? []).map(({ apertura, cierre }) => ({ apertura, cierre })),
      }))
    : borradorVacio();

const aMinutos = (hora: string) => {
  const [h, m] = hora.split(':').map(Number);
  return h! * 60 + m!;
};
const ordenarIntervalos = (intervalos: Intervalo[]) =>
  [...intervalos].sort((a, b) => aMinutos(a.apertura) - aMinutos(b.apertura));

/** Lo que se envía: solo los días activos tienen intervalos. Sin ninguno, no hay horario. */
export function horarioDesde(borrador: BorradorHorario): HorarioSemanal | null {
  const horario = porDia((dia) =>
    borrador[dia].activo ? ordenarIntervalos(borrador[dia].intervalos) : [],
  );
  return DIAS_SEMANA.some((dia) => horario[dia].length > 0) ? horario : null;
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Valida los días activos. Las horas vacías solo se señalan con `exigirCompletos` (al guardar),
 * para no llenar de errores un intervalo que se acaba de agregar.
 */
export function validarHorario(
  borrador: BorradorHorario,
  { exigirCompletos = false } = {},
): ErroresHorario {
  const errores: ErroresHorario = {};
  for (const dia of DIAS_SEMANA) {
    if (!borrador[dia].activo) continue;
    const intervalos = borrador[dia].intervalos;
    if (exigirCompletos && intervalos.length === 0) {
      errores[dia] = 'Agrega un intervalo o marca el día sin atención.';
    }
    const completos: (Intervalo & { i: number })[] = [];
    intervalos.forEach(({ apertura, cierre }, i) => {
      const aperturaValida = HORA.test(apertura);
      const cierreValido = HORA.test(cierre) || cierre === '24:00';
      if (!aperturaValida && (exigirCompletos || apertura)) {
        errores[`${dia}.${i}.apertura`] = 'Indica la hora de apertura.';
      }
      if (!cierreValido && (exigirCompletos || cierre)) {
        errores[`${dia}.${i}.cierre`] = 'Indica la hora de cierre.';
      }
      if (!aperturaValida || !cierreValido) return;
      if (aMinutos(cierre) <= aMinutos(apertura)) {
        errores[`${dia}.${i}.cierre`] = 'El cierre debe ser posterior a la apertura.';
        return;
      }
      completos.push({ apertura, cierre, i });
    });
    const ordenados = completos.sort((a, b) => aMinutos(a.apertura) - aMinutos(b.apertura));
    for (let k = 1; k < ordenados.length; k++) {
      if (aMinutos(ordenados[k]!.apertura) < aMinutos(ordenados[k - 1]!.cierre)) {
        errores[`${dia}.${ordenados[k]!.i}.apertura`] = 'Se cruza con otro intervalo del día.';
      }
    }
  }
  return errores;
}

/** «8:00 a. m.», «12:00 p. m.», «medianoche» (cierre 24:00). */
export function formatearHora(hora: string): string {
  if (hora === '24:00') return 'medianoche';
  const minutos = aMinutos(hora);
  const h = Math.floor(minutos / 60);
  const m = String(minutos % 60).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

export function formatearIntervalos(intervalos: Intervalo[]): string {
  if (intervalos.length === 0) return 'sin atención';
  const [primero] = intervalos;
  if (intervalos.length === 1 && primero!.apertura === '00:00' && primero!.cierre === '24:00') {
    return '24 horas';
  }
  const partes = intervalos.map((i) => `${formatearHora(i.apertura)} – ${formatearHora(i.cierre)}`);
  return partes.length === 1
    ? partes[0]!
    : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

/** Días seguidos con el mismo horario: «Lunes a viernes», «Sábado y domingo». */
export function agruparDias(horario: HorarioSemanal): { dias: string; texto: string }[] {
  const grupos: { desde: DiaSemana; hasta: DiaSemana; texto: string }[] = [];
  for (const dia of DIAS_SEMANA) {
    const texto = formatearIntervalos(horario[dia] ?? []);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.texto === texto) ultimo.hasta = dia;
    else grupos.push({ desde: dia, hasta: dia, texto });
  }
  return grupos.map(({ desde, hasta, texto }) => {
    const distancia = DIAS_SEMANA.indexOf(hasta) - DIAS_SEMANA.indexOf(desde);
    const dias =
      distancia === 0
        ? NOMBRE_DIA[desde]
        : `${NOMBRE_DIA[desde]} ${distancia === 1 ? 'y' : 'a'} ${NOMBRE_DIA[hasta].toLowerCase()}`;
    return { dias, texto };
  });
}

/** El mismo texto que guarda el backend en `horario` y muestra la ficha pública. */
export const formatearHorario = (horario: HorarioSemanal) =>
  agruparDias(horario)
    .map(({ dias, texto }) => `${dias}: ${texto}`)
    .join('; ');
