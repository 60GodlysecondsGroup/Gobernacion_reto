import { z } from 'zod';
import { vacioANull } from '../../http/validacion.js';
import { esquemaHorarioSemanal, formatearHorario, type HorarioSemanal } from './fuentes.horario.js';

export const ESTADOS_FUENTE = ['activo', 'requiere_revision', 'inactivo'] as const;
export type EstadoFuente = (typeof ESTADOS_FUENTE)[number];

export const TIPOS_CANAL = ['telefono', 'web', 'presencial', 'chat', 'otro'] as const;

/** Necesidades del navegador de orientación (F04), en app.necesidad_orientacion. */
export const CODIGOS_NECESIDAD = [
  'bienestar',
  'hablar_con_alguien',
  'situacion_preocupa',
  'amigo_preocupa',
  'lineas_ayuda',
  'informacion_institucional',
] as const;

export const ZONA_HORARIA = 'America/Bogota';

/** Fecha de hoy en Colombia, `AAAA-MM-DD`. */
export const hoyEnColombia = (ahora = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA }).format(ahora);

const fechaVerificacion = z.iso
  .date('Usa el formato AAAA-MM-DD.')
  .refine((fecha) => fecha <= hoyEnColombia(), 'La fecha de verificación no puede ser futura.');

const camposFuente = {
  institucion: z.string().trim().min(2).max(120),
  servicio: z.string().trim().min(2).max(120),
  descripcion: z.string().trim().min(10).max(1000),
  tipoCanal: z.enum(TIPOS_CANAL),
  telefono: z.preprocess(
    vacioANull,
    z
      .string()
      .trim()
      .regex(/^[0-9 +()-]{3,20}$/, 'Usa solo números, espacios, +, paréntesis o guiones.')
      .nullable()
      .default(null),
  ),
  enlace: z.preprocess(
    vacioANull,
    z
      .url({
        protocol: /^https?$/,
        error: 'Debe ser un enlace que empiece por http:// o https://.',
      })
      .max(300)
      .nullable()
      .default(null),
  ),
  /**
   * Texto del horario. Si llega `horarioSemanal`, se reemplaza por su versión legible (que puede
   * pasar de 200 caracteres); si no, es texto libre de hasta 200 (ver `textoHorarioLibre`).
   */
  horario: z.preprocess(vacioANull, z.string().trim().max(2000).nullable().default(null)),
  /** Horario estructurado. Opcional: sin él, `horario` se guarda como texto, igual que antes. */
  horarioSemanal: esquemaHorarioSemanal.nullable().default(null),
  fuenteOriginal: z.string().trim().min(3).max(300),
  necesidades: z
    .array(z.enum(CODIGOS_NECESIDAD))
    .min(1, 'Elige al menos una necesidad.')
    .transform((codigos) => [...new Set(codigos)]),
  observaciones: z.preprocess(vacioANull, z.string().trim().max(500).nullable().default(null)),
  esDemo: z.boolean(),
};

/** El canal debe poder usarse: un teléfono necesita número; una web o un chat, enlace. */
function canalCoherente(
  datos: { tipoCanal: string; telefono: string | null; enlace: string | null },
  ctx: z.RefinementCtx,
) {
  if (datos.tipoCanal === 'telefono' && !datos.telefono) {
    ctx.addIssue({
      code: 'custom',
      path: ['telefono'],
      message: 'Un canal telefónico necesita un teléfono.',
    });
  }
  if ((datos.tipoCanal === 'web' || datos.tipoCanal === 'chat') && !datos.enlace) {
    ctx.addIssue({
      code: 'custom',
      path: ['enlace'],
      message: 'Un canal web o de chat necesita un enlace.',
    });
  }
}

/** El límite de 200 caracteres es del texto libre; el derivado del horario semanal no lo tiene. */
function textoHorarioLibre(
  datos: { horario: string | null; horarioSemanal: HorarioSemanal | null },
  ctx: z.RefinementCtx,
) {
  if (!datos.horarioSemanal && datos.horario && datos.horario.length > 200) {
    ctx.addIssue({
      code: 'custom',
      path: ['horario'],
      message: 'El horario en texto admite como máximo 200 caracteres.',
    });
  }
}

/**
 * Con horario estructurado, el texto `horario` se deriva de él: la ficha pública, el asistente y
 * la bitácora siguen leyendo un texto, ahora siempre con el mismo formato.
 */
const conHorarioDerivado = <
  T extends { horario: string | null; horarioSemanal: HorarioSemanal | null },
>(
  datos: T,
): T =>
  datos.horarioSemanal ? { ...datos, horario: formatearHorario(datos.horarioSemanal) } : datos;

/** Editar datos de una fuente. El estado y la verificación cambian con sus propias acciones. */
export const esquemaEdicion = z
  .object(camposFuente)
  .strict()
  .superRefine(canalCoherente)
  .superRefine(textoHorarioLibre)
  .transform(conHorarioDerivado);

/** Crear una fuente: ninguna se publica sin fecha de verificación (B.6). */
export const esquemaCreacion = z
  .object({
    ...camposFuente,
    estado: z.enum(['activo', 'requiere_revision']),
    fechaVerificacion,
  })
  .strict()
  .superRefine(canalCoherente)
  .superRefine(textoHorarioLibre)
  .transform(conHorarioDerivado);

/** Cada registro del archivo de carga `fuentes_institucionales.json`. */
export const esquemaEntradaCarga = z
  .object({
    codigo: z.string().regex(/^[a-z0-9-]{3,60}$/, 'Solo minúsculas, números y guiones (3 a 60).'),
    ...camposFuente,
    estado: z.enum(ESTADOS_FUENTE),
    fechaVerificacion,
  })
  .strict()
  .superRefine(canalCoherente)
  .superRefine(textoHorarioLibre)
  .transform(conHorarioDerivado);

const motivo = z.string().trim().min(5, 'Explica el motivo en al menos 5 caracteres.').max(500);

export const esquemaMarcarRevision = z.object({ motivo }).strict();
export const esquemaDesactivacion = z.object({ motivo }).strict();
export const esquemaVerificacion = z
  .object({
    fecha: fechaVerificacion.default(() => hoyEnColombia()),
    observacion: z.preprocess(vacioANull, z.string().trim().max(500).nullable().default(null)),
  })
  .strict();

export type DatosFuente = z.output<typeof esquemaEdicion>;
export type FuenteCompleta = DatosFuente & { estado: EstadoFuente; fechaVerificacion: string };
export type EntradaFuente = z.output<typeof esquemaEntradaCarga>;
