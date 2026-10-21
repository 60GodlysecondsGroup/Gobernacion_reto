/**
 * Sincroniza las fuentes institucionales con el archivo de carga, sin tocar el resto de datos:
 *   npm run fuentes:cargar                     → usa db/seed/fuentes_institucionales.json
 *   npm run fuentes:cargar -- ruta/archivo.json → usa otro archivo
 * Crea las nuevas, actualiza las que cambian y desactiva las que ya no figuran (no borra).
 * Todo cambio queda en la bitácora. Si el archivo tiene errores, no se carga nada.
 */
import path from 'node:path';
import { cargarConfig } from '../src/config/env.js';
import { crearPool } from '../src/db/database.js';
import { enTransaccion } from '../src/db/migraciones.js';
import { crearLogger } from '../src/lib/logger.js';
import {
  ARCHIVO_FUENTES,
  cargarFuentes,
  leerFuentes,
} from '../src/modules/fuentes/fuentes.carga.js';

const ruta = process.argv[2]
  ? path.resolve(process.env.INIT_CWD ?? process.cwd(), process.argv[2])
  : ARCHIVO_FUENTES;
const config = cargarConfig();
const logger = crearLogger(config.nivelLog === 'silencioso' ? 'info' : config.nivelLog);
const pool = crearPool(config.baseDeDatos);

try {
  const entradas = await leerFuentes(ruta);
  const resumen = await enTransaccion(pool, (cliente) =>
    cargarFuentes(cliente, entradas, `Carga desde ${path.basename(ruta)}.`),
  );
  logger.info(`Fuentes sincronizadas desde ${path.basename(ruta)}`, {
    creadas: resumen.creadas.length,
    actualizadas: resumen.actualizadas.length,
    desactivadas: resumen.desactivadas.length,
    sinCambios: resumen.sinCambios.length,
  });
  for (const [tipo, codigos] of Object.entries(resumen)) {
    if (tipo !== 'sinCambios' && codigos.length > 0)
      logger.info(`  ${tipo}: ${codigos.join(', ')}`);
  }
} catch (error) {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}
