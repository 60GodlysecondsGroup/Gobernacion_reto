import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

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
});

export type Config = {
  entorno: 'development' | 'test' | 'production';
  puerto: number;
  origenesPermitidos: string[];
  nivelLog: z.infer<typeof esquemaEntorno>['LOG_LEVEL'];
  baseDeDatos: { url: string; ssl: 'disable' | 'require' | 'verify-full' };
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
  return {
    entorno: v.NODE_ENV,
    puerto: v.BACKEND_PORT,
    origenesPermitidos: v.FRONTEND_ORIGIN.split(',').map((origen) => origen.trim()),
    nivelLog: v.LOG_LEVEL,
    baseDeDatos: { url: v.DATABASE_URL, ssl: v.DATABASE_SSL },
  };
}
