import { crearApp } from './app.js';
import { cargarConfig, type Config } from './config/env.js';
import { crearPool } from './db/database.js';
import { crearLogger } from './lib/logger.js';

let config: Config;
try {
  config = cargarConfig();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const logger = crearLogger(config.nivelLog);
const pool = crearPool(config.baseDeDatos);
pool.on('error', (error) => {
  logger.error('Error en una conexión inactiva de la base de datos', { error: error.message });
});

const app = crearApp({ db: pool, logger, origenesPermitidos: config.origenesPermitidos });

const servidor = app.listen(config.puerto, (error) => {
  if (error) {
    logger.error(`No se pudo abrir el puerto ${config.puerto}`, { error: error.message });
    process.exit(1);
  }
  logger.info(`Backend escuchando en http://localhost:${config.puerto}`, {
    entorno: config.entorno,
    cors: config.origenesPermitidos,
  });

  // Abre la primera conexión ya: avisa pronto si DATABASE_URL falla y evita la espera en la primera consulta.
  pool
    .query('select 1')
    .then(() => logger.info('Base de datos conectada'))
    .catch((errorDb: Error) =>
      logger.warn('No se pudo conectar a la base de datos', { error: errorDb.message }),
    );
});

function apagar(senal: string) {
  logger.info(`Señal ${senal} recibida, cerrando el backend…`);
  setTimeout(() => process.exit(1), 5_000).unref();
  servidor.close(() => {
    pool.end().finally(() => process.exit(0));
  });
}

process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
