/**
 * Comandos de base de datos:
 *   npm run db:migrate  → aplica migraciones pendientes
 *   npm run db:seed     → borra y recarga los datos base (sin cuentas de prueba)
 *   npm run db:reset    → elimina el esquema "app" y lo reconstruye (migraciones + datos base)
 *
 * Opciones (después de `--`):
 *   --usuarios-prueba  agrega las cuentas sintéticas de prueba. Solo para la base local; lo pasa
 *                      `npm run db:reset:local`.
 *   --forzar           db:seed y db:reset borran también las cuentas registradas (con contraseña)
 *                      y la contraseña de la administración; sin esta opción se niegan si las hay.
 */
import { cargarConfig } from '../src/config/env.js';
import { crearPool } from '../src/db/database.js';
import { contarCuentasConContrasena, migrar, reiniciar, sembrar } from '../src/db/migraciones.js';
import { crearLogger } from '../src/lib/logger.js';
import { crearRepositorioSistema } from '../src/modules/sistema/sistema.repository.js';

const comandos = { migrar, sembrar, reiniciar };
const nombre = process.argv[2];
const usuariosPrueba = process.argv.includes('--usuarios-prueba');
const forzar = process.argv.includes('--forzar');

if (!nombre || !(nombre in comandos)) {
  console.error(
    `Uso: tsx scripts/db.ts <${Object.keys(comandos).join('|')}> [--usuarios-prueba] [--forzar]`,
  );
  process.exit(1);
}

const config = cargarConfig();
const logger = crearLogger(config.nivelLog === 'silencioso' ? 'info' : config.nivelLog);

if (nombre === 'reiniciar' && config.entorno === 'production') {
  logger.error('db:reset está deshabilitado con NODE_ENV=production.');
  process.exit(1);
}
if (usuariosPrueba && config.entorno === 'production') {
  logger.error('Las cuentas de prueba no se cargan con NODE_ENV=production.');
  process.exit(1);
}

const pool = crearPool(config.baseDeDatos);
try {
  if (nombre !== 'migrar' && !forzar) {
    const cuentas = await contarCuentasConContrasena(pool);
    if (cuentas > 0) {
      throw new Error(
        `La base tiene ${cuentas} cuenta(s) con contraseña (registradas o la administración). ` +
          `"${nombre}" las borraría. Si es intencional, repite el comando con -- --forzar.`,
      );
    }
  }
  if (nombre === 'migrar') await migrar(pool, logger);
  else await comandos[nombre as 'sembrar' | 'reiniciar'](pool, logger, { usuariosPrueba });
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
