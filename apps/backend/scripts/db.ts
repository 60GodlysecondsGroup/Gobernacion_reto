/**
 * Comandos de base de datos:
 *   npm run db:migrate  → aplica migraciones pendientes
 *   npm run db:seed     → borra y recarga los datos sintéticos
 *   npm run db:reset    → elimina el esquema "app" y lo reconstruye (migraciones + seed)
 */
import { cargarConfig } from '../src/config/env.js';
import { crearPool } from '../src/db/database.js';
import { migrar, reiniciar, sembrar } from '../src/db/migraciones.js';
import { crearLogger } from '../src/lib/logger.js';
import { crearRepositorioSistema } from '../src/modules/sistema/sistema.repository.js';

const comandos = { migrar, sembrar, reiniciar };
const nombre = process.argv[2];

if (!nombre || !(nombre in comandos)) {
  console.error(`Uso: tsx scripts/db.ts <${Object.keys(comandos).join('|')}>`);
  process.exit(1);
}

const config = cargarConfig();
const logger = crearLogger(config.nivelLog === 'silencioso' ? 'info' : config.nivelLog);

if (nombre === 'reiniciar' && config.entorno === 'production') {
  logger.error('db:reset está deshabilitado con NODE_ENV=production.');
  process.exit(1);
}

const pool = crearPool(config.baseDeDatos);
try {
  await comandos[nombre as keyof typeof comandos](pool, logger);
  if (nombre !== 'migrar') {
    const conteo = await crearRepositorioSistema(pool).contarDatosDemo();
    logger.info('Datos en la base', conteo);
  }
} catch (error) {
  logger.error(`Falló "${nombre}"`, {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
} finally {
  await pool.end();
}
