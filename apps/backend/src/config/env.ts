import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const DURACION_SESION_MS = 8 * 60 * 60 * 1000;

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
  // Selector de usuarios sintéticos en la pantalla de acceso. Solo para la demo.
  ACCESO_DEMO: z.enum(['true', 'false']).optional(),
  // lax (por defecto) | none (requerido para frontend en dominio distinto con HTTPS, ej. Vercel) | strict
  COOKIE_SAME_SITE: z.enum(['lax', 'none', 'strict']).optional(),
  // Segundos sin nadie antes de cerrar una sala (F13). 180 s por defecto; menos solo para ensayar.
  SALA_CIERRE_SEGUNDOS: z.coerce.number().int().min(1).max(3600).default(180),
  // La demo ya tenía `openai` en el .env; OPENAI_API_KEY queda como nombre estándar opcional.
  OPENAI_API_KEY: z.string().optional(),
  openai: z.string().optional(),
  OPENAI_MODEL: z.string().trim().min(1).default('gpt-5.4-mini'),
});

export type Config = {
  entorno: 'development' | 'test' | 'production';
  puerto: number;
  origenesPermitidos: string[];
  nivelLog: z.infer<typeof esquemaEntorno>['LOG_LEVEL'];
  baseDeDatos: { url: string; ssl: 'disable' | 'require' | 'verify-full' };
  sesion: {
    secreto: string;
    /** true si no había SESSION_SECRET: las sesiones se pierden al reiniciar el backend. */
    secretoGenerado: boolean;
    duracionMs: number;
    cookieSegura: boolean;
    sameSite?: 'lax' | 'none' | 'strict';
  };
  accesoDemo: boolean;
  salas: { cierreSegundos: number };
  openai: { apiKey?: string; model: string };
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

  return {
    entorno: v.NODE_ENV,
    puerto: v.BACKEND_PORT,
    origenesPermitidos: v.FRONTEND_ORIGIN.split(',')
      .map((origen) => origen.trim().replace(/\/+$/, ''))
      .filter(Boolean),
    nivelLog: v.LOG_LEVEL,
    baseDeDatos: { url: v.DATABASE_URL, ssl: v.DATABASE_SSL },
    sesion: {
      secreto: v.SESSION_SECRET ?? randomBytes(32).toString('hex'),
      secretoGenerado: !v.SESSION_SECRET,
      duracionMs: DURACION_SESION_MS,
      cookieSegura: produccion,
      sameSite: v.COOKIE_SAME_SITE,
    },
    accesoDemo: v.ACCESO_DEMO ? v.ACCESO_DEMO === 'true' : !produccion,
    salas: { cierreSegundos: v.SALA_CIERRE_SEGUNDOS },
    openai: { apiKey: v.OPENAI_API_KEY || v.openai || undefined, model: v.OPENAI_MODEL },
  };
}
