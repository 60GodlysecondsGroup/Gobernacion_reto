/**
 * `npm run test:db`: pruebas de integración contra una base PostgreSQL local y desechable
 * (`comunidad_pruebas`, en el clúster de `.postgres-local/`), nunca contra la base del .env.
 *
 * Si la base local ya está en marcha (`npm run db:local`), la reutiliza; si no, la inicia y la
 * detiene al terminar. Antes de las pruebas reconstruye `comunidad_pruebas` desde cero con los
 * datos base y las cuentas sintéticas de prueba. La base de desarrollo `comunidad` no se toca.
 *
 * Los argumentos extra pasan a vitest:  npm run test:db -- test/integracion/autenticacion.test.ts
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { crearPool } from '../src/db/database.js';
import { reiniciar } from '../src/db/migraciones.js';
import { crearLogger } from '../src/lib/logger.js';
import {
  DIRECTORIO_DB_LOCAL,
  NOMBRE_DB_PRUEBAS,
  URL_ADMIN_DB_LOCAL,
  URL_DB_PRUEBAS,
} from './db-local.config.js';
import { crearServidorLocal } from './db-local.servidor.js';

const logger = crearLogger('info');

async function respondeServidor(): Promise<boolean> {
  const sonda = crearPool({ url: URL_ADMIN_DB_LOCAL, ssl: 'disable' });
  try {
    await sonda.query('select 1');
    return true;
  } catch {
    return false;
  } finally {
    await sonda.end().catch(() => undefined);
  }
}

let servidor: ReturnType<typeof crearServidorLocal> | null = null;
async function detenerServidor() {
  if (!servidor) return;
  const actual = servidor;
  servidor = null;
  await actual.stop().catch(() => undefined);
}

if (!(await respondeServidor())) {
  servidor = crearServidorLocal(logger);
  try {
    if (!existsSync(path.join(DIRECTORIO_DB_LOCAL, 'PG_VERSION'))) {
      logger.info('Creando el clúster PostgreSQL local (solo la primera vez)…');
      await servidor.initialise();
    }
    await servidor.start();
  } catch (error) {
    logger.error('No se pudo iniciar la base local para las pruebas', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

try {
  const admin = crearPool({ url: URL_ADMIN_DB_LOCAL, ssl: 'disable' });
  try {
    const { rowCount } = await admin.query('select 1 from pg_database where datname = $1', [
      NOMBRE_DB_PRUEBAS,
    ]);
    if (!rowCount) {
      await admin.query(
        `create database ${NOMBRE_DB_PRUEBAS} with template template0 encoding 'UTF8' lc_collate 'C' lc_ctype 'C'`,
      );
    }
  } finally {
    await admin.end();
  }

  const pool = crearPool({ url: URL_DB_PRUEBAS, ssl: 'disable' });
  try {
    await reiniciar(pool, crearLogger('warn'), { usuariosPrueba: true });
  } finally {
    await pool.end();
  }
  logger.info(`Base de pruebas «${NOMBRE_DB_PRUEBAS}» reconstruida. Ejecutando las pruebas…`);
} catch (error) {
  logger.error('No se pudo preparar la base de pruebas', {
    error: error instanceof Error ? error.message : String(error),
  });
  await detenerServidor();
  process.exit(1);
}

const cliVitest = path.join(
  path.dirname(createRequire(import.meta.url).resolve('vitest/package.json')),
  'vitest.mjs',
);
// Sin archivos indicados, toda la carpeta de integración.
const extra = process.argv.slice(2);
const archivos = extra.some((arg) => !arg.startsWith('-')) ? [] : ['test/integracion'];
const vitest = spawn(
  process.execPath,
  [cliVitest, 'run', ...archivos, '--no-file-parallelism', ...extra],
  {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: URL_DB_PRUEBAS, DATABASE_SSL: 'disable' },
  },
);
for (const senal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(senal, () => vitest.kill(senal));
}
vitest.on('exit', async (codigo) => {
  await detenerServidor();
  process.exit(codigo ?? 1);
});
