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
  .date('Indica la fecha de verificación.')
  .refine((fecha) => fecha <= hoyEnColombia(), 'La fecha de verificación no puede ser futura.');

/** Mensajes claros por campo; el frontend usa los mismos (`lib/fuentes-validacion.ts`). */
const maximo = (n: number) => `Usa como máximo ${n} caracteres.`;
const texto = (min: number, max: number, mensaje: string) =>
  z.string().trim().min(min, mensaje).max(max, maximo(max));

/** 6 decimales ≈ 0,1 m: precisión de sobra para un establecimiento, sin ruido de coma flotante. */
const redondearCoordenada = (valor: number) => Math.round(valor * 1e6) / 1e6;

const coordenada = (minimo: number, maximo: number, nombre: string) =>
  // En zod 4, `z.number()` ya rechaza NaN e Infinity.
  z
    .number({ error: `Indica la ${nombre} como un número.` })
    .min(minimo, `La ${nombre} debe estar entre ${minimo} y ${maximo}.`)
    .max(maximo, `La ${nombre} debe estar entre ${minimo} y ${maximo}.`)
    .transform(redondearCoordenada);

/**
 * Punto del establecimiento en el mapa. Latitud y longitud llegan siempre juntas (un objeto, no
 * campos sueltos), con la dirección que corresponde a ese punto: la que se muestra junto al mapa.
 * El `placeId` de Google es opcional (una ubicación escrita a mano no lo tiene).
 */
export const esquemaUbicacion = z
  .object({
    latitud: coordenada(-90, 90, 'latitud'),
    longitud: coordenada(-180, 180, 'longitud'),
    placeId: z.preprocess(
      vacioANull,
      z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9_-]{10,300}$/, 'El identificador del lugar no es válido.')
        .nullable()
        .default(null),
    ),
    direccion: texto(5, 300, 'Indica la dirección de la ubicación (al menos 5 caracteres).'),
  })
  .strict()
  // 0,0 está en el océano: casi siempre es una coordenada que faltó, no un establecimiento.
  .refine((u) => u.latitud !== 0 || u.longitud !== 0, {
    path: ['latitud'],
    message: 'Las coordenadas 0, 0 no corresponden a un establecimiento: revisa la ubicación.',
  });

export type Ubicacion = z.output<typeof esquemaUbicacion>;

/** Mensajes del número de WhatsApp; el frontend usa los mismos (`lib/fuentes-validacion.ts`). */
export const MENSAJES_WHATSAPP = {
  indicativo:
    'Escribe el celular con su indicativo internacional, empezando por + (p. ej. +57 300 123 4567).',
  formato:
    'Revisa el número: el indicativo no empieza por 0 y el número completo tiene de 8 a 15 dígitos.',
  colombia:
    'Un celular de Colombia (+57) tiene 10 dígitos y empieza por 3 (p. ej. +57 300 123 4567).',
} as const;

/** Quita los separadores que se suelen escribir: «+57 (300) 123-4567» → «+573001234567». */
export const normalizarWhatsapp = (valor: string) => valor.replace(/[\s().-]/g, '');

/**
 * Celular de WhatsApp (opcional). Llega como lo escribe el equipo, con su indicativo, y se guarda
 * en E.164 («+» y solo dígitos): así el enlace `https://wa.me/<dígitos>` sale siempre igual.
 * En Colombia (+57) se exige un celular (10 dígitos que empiezan por 3): WhatsApp no funciona
 * en una línea fija.
 */
const whatsapp = z.preprocess(
  vacioANull,
  z
    .string()
    .trim()
    .max(30, maximo(30))
    .regex(/^\+[0-9 ().-]+$/, MENSAJES_WHATSAPP.indicativo)
    .transform(normalizarWhatsapp)
    .refine((numero) => /^\+[1-9]\d{7,14}$/.test(numero), MENSAJES_WHATSAPP.formato)
    .refine(
      (numero) => !numero.startsWith('+57') || /^\+573\d{9}$/.test(numero),
      MENSAJES_WHATSAPP.colombia,
    )
    .nullable()
    .default(null),
);

const camposFuente = {
  institucion: texto(2, 120, 'Escribe el nombre de la institución (al menos 2 caracteres).'),
  servicio: texto(2, 120, 'Escribe el nombre del servicio o canal (al menos 2 caracteres).'),
  descripcion: texto(10, 1000, 'La descripción necesita al menos 10 caracteres.'),
  tipoCanal: z.enum(TIPOS_CANAL),
  telefono: z.preprocess(
    vacioANull,
    z
      .string()
      .trim()
      .regex(
        /^[0-9 +()-]{3,20}$/,
        'Usa de 3 a 20 caracteres: números, espacios, +, paréntesis o guiones.',
      )
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
      .max(300, maximo(300))
      .nullable()
      .default(null),
  ),
  /** Celular para escribir por WhatsApp (opcional, en cualquier tipo de canal). */
  whatsapp,
  /**
   * Texto del horario. Si llega `horarioSemanal`, se reemplaza por su versión legible (que puede
   * pasar de 200 caracteres); si no, es texto libre de hasta 200 (ver `textoHorarioLibre`).
   */
  horario: z.preprocess(vacioANull, z.string().trim().max(2000).nullable().default(null)),
  /** Horario estructurado. Opcional: sin él, `horario` se guarda como texto, igual que antes. */
  horarioSemanal: esquemaHorarioSemanal.nullable().default(null),
  /** Dirección escrita (opcional): se muestra aunque no haya ubicación en el mapa. */
  direccion: z.preprocess(
    vacioANull,
    z
      .string()
      .trim()
      .min(5, 'La dirección necesita al menos 5 caracteres.')
      .max(200, maximo(200))
      .nullable()
      .default(null),
  ),
  /** Ubicación en el mapa (opcional, para atención presencial o híbrida). null la quita. */
  ubicacion: esquemaUbicacion.nullable().default(null),
  fuenteOriginal: texto(3, 300, 'Indica de dónde sale la información (al menos 3 caracteres).'),
  necesidades: z
    .array(z.enum(CODIGOS_NECESIDAD))
    .min(1, 'Elige al menos un tema.')
    .transform((codigos) => [...new Set(codigos)]),
  observaciones: z.preprocess(
    vacioANull,
    z.string().trim().max(500, maximo(500)).nullable().default(null),
  ),
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
