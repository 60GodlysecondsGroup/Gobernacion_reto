import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const DURACION_SESION_MS = 8 * 60 * 60 * 1000;
// «Recordarme» en el inicio de sesión: la cookie dura 30 días (y se puede revocar antes).
const DURACION_SESION_RECORDADA_MS = 30 * 24 * 60 * 60 * 1000;

const esquemaEntorno = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // No se usa PORT: Next.js y otras herramientas lo definen y chocaría con el frontend.
  BACKEND_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  FRONTEND_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silencioso']).default('info'),
  DATABASE_URL: z
    .string({ error: 'Falta DATABASE_URL en el .env de la raíz (ver .env.example).' })
    .regex(/^postgres(ql)?:\/\//, 'DATABASE_URL debe empezar por postgresql://'),
  DATABASE_SSL: z.enum(['disable', 'require', 'verify-full']).default('require'),
  // Vacío equivale a ausente (así queda al copiar .env.example).
  SESSION_SECRET: z
    .union([
      z.literal(''),
      z.string().min(32, 'SESSION_SECRET debe tener al menos 32 caracteres (ver .env.example).'),
    ])
    .optional()
    .transform((valor) => valor || undefined),
  // lax (por defecto) | none (requerido para frontend en dominio distinto con HTTPS, ej. Vercel) | strict
  COOKIE_SAME_SITE: z.enum(['lax', 'none', 'strict']).optional(),
  // Segundos sin nadie antes de cerrar una sala (F13). 180 s por defecto; menos solo para ensayar.
  SALA_CIERRE_SEGUNDOS: z.coerce.number().int().min(1).max(3600).default(180),
  // Salas entre varias instancias (Vercel): Redis comparte presencias y eventos. Sin REDIS_URL,
  // solo un backend local (en memoria); en producción y en Vercel es obligatorio.
  REDIS_URL: z
    .union([
      z.literal(''),
      z.string().regex(/^rediss?:\/\//, 'REDIS_URL debe empezar por redis:// o rediss://'),
    ])
    .optional()
    .transform((valor) => valor || undefined),
  // Prefijo de claves y canales: permite compartir un Redis entre entornos sin mezclarlos.
  REDIS_PREFIJO: z.string().trim().min(1).default('comunidad:'),
  // Latido de las salas: ping del WebSocket y renovación de presencias.
  SALAS_LATIDO_SEGUNDOS: z.coerce.number().int().min(1).max(60).default(10),
  // Vida de una presencia sin renovar: margen para reconectarse sin salir de la sala.
  SALAS_PRESENCIA_SEGUNDOS: z.coerce.number().int().min(2).max(300).default(30),
  // La demo ya tenía `openai` en el .env; OPENAI_API_KEY queda como nombre estándar opcional.
  OPENAI_API_KEY: z.string().optional(),
  openai: z.string().optional(),
  OPENAI_MODEL: z.string().trim().min(1).default('gpt-5.4-mini'),
  // Clave PRIVADA de Google Maps Platform para buscar lugares (Places API (New)) desde el panel de
  // fuentes. Vacía: el panel permite ingresar la ubicación a mano. Nunca con prefijo NEXT_PUBLIC_.
  GOOGLE_MAPS_SERVER_API_KEY: z
    .string()
    .trim()
    .optional()
    .transform((valor) => valor || undefined),
  // Variables de sistema de Vercel (vercel.json): allí no se abre puerto y el frontend se
  // sirve en el mismo dominio que el backend.
  VERCEL: z.string().optional(),
  VERCEL_URL: z.string().optional(),
  VERCEL_BRANCH_URL: z.string().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
});

export type Config = {
  entorno: 'development' | 'test' | 'production';
  /** true en Vercel (despliegue o `vercel dev`): la plataforma intercepta listen() y no abre puerto. */
  enVercel: boolean;
  puerto: number;
  origenesPermitidos: string[];
  nivelLog: z.infer<typeof esquemaEntorno>['LOG_LEVEL'];
  baseDeDatos: { url: string; ssl: 'disable' | 'require' | 'verify-full' };
  sesion: {
    secreto: string;
    /** true si no había SESSION_SECRET: las sesiones se pierden al reiniciar el backend. */
    secretoGenerado: boolean;
    duracionMs: number;
    duracionRecordadaMs: number;
    cookieSegura: boolean;
    sameSite?: 'lax' | 'none' | 'strict';
  };
  salas: {
    cierreSegundos: number;
    /** Cada cuánto se comprueba cada conexión y se renuevan las presencias. */
    latidoMs: number;
    /** Una presencia que nadie renueva en este tiempo vence: la persona sale de la sala. */
    presenciaMs: number;
  };
  /** Sin `url`, las salas viven en la memoria del proceso (un solo backend local). */
  redis: { url?: string; prefijo: string };
  openai: { apiKey?: string; model: string };
  /** Búsqueda de lugares del panel de fuentes. Sin clave, la ubicación se ingresa a mano. */
  googleMaps: { claveServidor?: string };
};

/**
 * Carga el único .env del monorepo (raíz) y, si existe, uno propio de apps/backend.
 * Las variables ya definidas en el proceso tienen prioridad sobre los archivos.
 */
function cargarArchivosEnv() {
  const candidatos = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
  ];
  for (const archivo of candidatos) {
    if (existsSync(archivo)) process.loadEnvFile(archivo);
  }
}

export function cargarConfig(entorno: NodeJS.ProcessEnv = process.env): Config {
  if (entorno === process.env) cargarArchivosEnv();

  const resultado = esquemaEntorno.safeParse(entorno);
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuración de entorno inválida:\n${detalle}`);
  }

  const v = resultado.data;
  const produccion = v.NODE_ENV === 'production';
  if (produccion && !v.SESSION_SECRET) {
    throw new Error(
      'Configuración de entorno inválida:\n  - SESSION_SECRET es obligatorio en producción.',
    );
  }
  // Con varias instancias, salas en memoria serían salas distintas que nadie más ve.
  if ((produccion || v.VERCEL) && !v.REDIS_URL) {
    throw new Error(
      'Configuración de entorno inválida:\n  - REDIS_URL es obligatorio en producción y en Vercel: las salas se comparten entre instancias.',
    );
  }
  if (v.SALAS_PRESENCIA_SEGUNDOS < 2 * v.SALAS_LATIDO_SEGUNDOS) {
    throw new Error(
      'Configuración de entorno inválida:\n  - SALAS_PRESENCIA_SEGUNDOS debe ser al menos el doble de SALAS_LATIDO_SEGUNDOS.',
    );
  }

  return {
    entorno: v.NODE_ENV,
    enVercel: Boolean(v.VERCEL),
    puerto: v.BACKEND_PORT,
    origenesPermitidos: [
      ...v.FRONTEND_ORIGIN.split(','),
      // En Vercel el frontend comparte dominio con el backend: se aceptan las URLs del despliegue,
      // de la rama y de producción sin repetirlas en FRONTEND_ORIGIN (un dominio propio sí va allí).
      ...[v.VERCEL_URL, v.VERCEL_BRANCH_URL, v.VERCEL_PROJECT_PRODUCTION_URL].flatMap((dominio) =>
        dominio ? [`https://${dominio}`] : [],
      ),
    ]
      .map((origen) => origen.trim().replace(/\/+$/, ''))
      .filter(Boolean),
    nivelLog: v.LOG_LEVEL,
    baseDeDatos: { url: v.DATABASE_URL, ssl: v.DATABASE_SSL },
    sesion: {
      secreto: v.SESSION_SECRET ?? randomBytes(32).toString('hex'),
      secretoGenerado: !v.SESSION_SECRET,
      duracionMs: DURACION_SESION_MS,
      duracionRecordadaMs: DURACION_SESION_RECORDADA_MS,
      cookieSegura: produccion,
      sameSite: v.COOKIE_SAME_SITE,
    },
    salas: {
      cierreSegundos: v.SALA_CIERRE_SEGUNDOS,
      latidoMs: v.SALAS_LATIDO_SEGUNDOS * 1000,
      presenciaMs: v.SALAS_PRESENCIA_SEGUNDOS * 1000,
    },
    redis: { url: v.REDIS_URL, prefijo: v.REDIS_PREFIJO },
    openai: { apiKey: v.OPENAI_API_KEY || v.openai || undefined, model: v.OPENAI_MODEL },
    googleMaps: { claveServidor: v.GOOGLE_MAPS_SERVER_API_KEY },
  };
}
