import { crearServidor } from './app.js';
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

if (config.sesion.secretoGenerado) {
  logger.warn('Sin SESSION_SECRET: se usa uno temporal y las sesiones se pierden al reiniciar.');
}
if (config.accesoDemo) {
  logger.info('Acceso de demostración habilitado (selector de usuarios sintéticos).');
}

const { app, salas, tiempoReal } = crearServidor({ db: pool, logger, config });

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
  // Luego reconcilia las salas: tras un reinicio nadie está conectado.
  pool
    .query('select 1')
    .then(() => logger.info('Base de datos conectada'))
    .then(() => salas.reconciliar())
    .then((vacias) => logger.info('Salas reconciliadas', { salasVacias: vacias }))
    .catch((errorDb: Error) =>
      logger.warn('No se pudo preparar la base de datos', { error: errorDb.message }),
    );
});

// WebSocket de salas en /ws/salas/:id, sobre el mismo puerto.
servidor.on('upgrade', (req, socket, cabecera) => tiempoReal.manejarUpgrade(req, socket, cabecera));

function apagar(senal: string) {
  logger.info(`Señal ${senal} recibida, cerrando el backend…`);
  setTimeout(() => process.exit(1), 5_000).unref();
  salas.detener();
  tiempoReal.cerrar();
  servidor.close(() => {
    pool.end().finally(() => process.exit(0));
  });
}

process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
