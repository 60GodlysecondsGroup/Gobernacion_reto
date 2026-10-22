/**
 * Base de datos PostgreSQL local para desarrollo y demo, sin instalar nada a mano.
 * Usa `embedded-postgres`, que trae un PostgreSQL real empaquetado en npm.
 *
 *   npm run db:local     → inicia la base local (y la crea la primera vez)
 *   npm run dev:local    → base local + backend + frontend, todo junto
 *
 * La primera vez crea el clúster en `.postgres-local/` (ignorado por git), aplica las migraciones
 * y carga los datos sintéticos. Las siguientes veces solo aplica migraciones pendientes.
 * Ctrl+C la detiene. Los datos se conservan entre ejecuciones; `npm run db:reset` los reinicia.
 */
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { crearPool } from '../src/db/database.js';
import { migrar, sembrar } from '../src/db/migraciones.js';
import { crearLogger } from '../src/lib/logger.js';

import {
  DIRECTORIO_DB_LOCAL as DIRECTORIO,
  NOMBRE_DB_LOCAL,
  PUERTO_DB_LOCAL,
  SENAL_DB_LOCAL as SENAL_LISTA,
  URL_ADMIN_DB_LOCAL,
  URL_DB_LOCAL,
} from './db-local.config.js';
const logger = crearLogger('info');

const servidor = new EmbeddedPostgres({
  databaseDir: DIRECTORIO,
  port: PUERTO_DB_LOCAL,
  user: 'postgres',
  password: 'postgres',
  persistent: true,
  // UTF-8 y sin configuración regional del sistema, igual en Windows, macOS y Linux.
  initdbFlags: ['--encoding=UTF8', '--no-locale'],
  // En un usuario administrador de Linux (contenedores), PostgreSQL no arranca como root.
  createPostgresUser: process.platform !== 'win32' && process.getuid?.() === 0,
  onLog: () => {},
  onError: (error) => {
    const texto = error instanceof Error ? error.message : String(error);
    if (texto.trim()) logger.warn('PostgreSQL local', { mensaje: texto.trim().slice(0, 300) });
  },
});

const nuevo = !existsSync(path.join(DIRECTORIO, 'PG_VERSION'));
rmSync(SENAL_LISTA, { force: true });

try {
  if (nuevo) {
    logger.info('Creando la base de datos local (solo la primera vez)…', { carpeta: DIRECTORIO });
    await servidor.initialise();
  }
  await servidor.start();
} catch (error) {
  logger.error('No se pudo iniciar la base local', {
    error: error instanceof Error ? error.message : String(error),
    ayuda: `¿Hay otro proceso usando el puerto ${PUERTO_DB_LOCAL}? Cámbialo con DB_LOCAL_PUERTO.`,
  });
  process.exit(1);
}

async function detenerConError(mensaje: string, error: unknown): Promise<never> {
  logger.error(mensaje, { error: error instanceof Error ? error.message : String(error) });
  await servidor.stop().catch(() => undefined);
  process.exit(1);
}

// Crea la base UTF-8 si falta. No borra ni modifica ninguna base existente.
const admin = crearPool({ url: URL_ADMIN_DB_LOCAL, ssl: 'disable' });
try {
  const { rowCount } = await admin.query('select 1 from pg_database where datname = $1', [
    NOMBRE_DB_LOCAL,
  ]);
  if (!rowCount) {
    await admin.query(
      `create database ${NOMBRE_DB_LOCAL} with template template0 encoding 'UTF8' lc_collate 'C' lc_ctype 'C'`,
    );
    logger.info(`Base «${NOMBRE_DB_LOCAL}» creada en UTF-8`);
  }
} catch (error) {
  await detenerConError('No se pudo crear la base local', error);
} finally {
  await admin.end();
}

const pool = crearPool({ url: URL_DB_LOCAL, ssl: 'disable' });
try {
  const { rows } = await pool.query<{ existe: boolean }>(
    `select exists (select 1 from information_schema.tables
                    where table_schema = 'app' and table_name = 'usuario') as existe`,
  );
  await migrar(pool, logger);
  if (!rows[0]?.existe) await sembrar(pool, logger);
} catch (error) {
  await pool.end().catch(() => undefined);
  await detenerConError('No se pudo preparar el esquema', error);
}
await pool.end();

writeFileSync(SENAL_LISTA, new Date().toISOString());
logger.info(`Base local lista en ${URL_DB_LOCAL} (Ctrl+C para detenerla)`);

let deteniendo = false;
async function detener() {
  if (deteniendo) return;
  deteniendo = true;
  logger.info('Deteniendo la base local…');
  rmSync(SENAL_LISTA, { force: true });
  await servidor.stop().catch(() => undefined);
  process.exit(0);
}
process.on('SIGINT', () => void detener());
process.on('SIGTERM', () => void detener());

// Mantiene el proceso vivo mientras la base está en marcha.
setInterval(() => {}, 1 << 30);
