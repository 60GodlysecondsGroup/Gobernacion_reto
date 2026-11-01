import { crearServidor } from './app.js';
import { cargarConfig, type Config } from './config/env.js';
import { crearPool } from './db/database.js';
import { AYUDA_BASE } from './http/errores.js';
import { crearLogger } from './lib/logger.js';
import { crearCoordinacionMemoria } from './modules/salas/salas.coordinacion.js';
import { crearCoordinacionRedis } from './modules/salas/salas.coordinacion.redis.js';

let config: Config;
try {
  config = cargarConfig();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const logger = crearLogger(config.nivelLog);

// DATABASE_URL copiada de .env.example sin completar: se avisa con claridad desde el arranque.
if (
  /@HOST(:|\/)/.test(config.baseDeDatos.url) ||
  config.baseDeDatos.url.includes('USUARIO:CONTRASENA')
) {
  logger.error(
    'DATABASE_URL todavía tiene el marcador de .env.example (HOST). La API responderá 503 hasta que lo cambies.',
    { ayuda: AYUDA_BASE },
  );
}
const pool = crearPool(config.baseDeDatos);
pool.on('error', (error) => {
  logger.error('Error en una conexión inactiva de la base de datos', { error: error.message });
});

if (config.sesion.secretoGenerado) {
  logger.warn('Sin SESSION_SECRET: se usa uno temporal y las sesiones se pierden al reiniciar.');
}

// Salas compartidas entre instancias (Redis) o, solo en desarrollo y con un único backend, en la
// memoria de este proceso. La configuración ya exige REDIS_URL en producción y en Vercel.
const coordinacion = config.redis.url
  ? crearCoordinacionRedis({
      url: config.redis.url,
      prefijo: config.redis.prefijo,
      presenciaMs: config.salas.presenciaMs,
      logger,
    })
  : crearCoordinacionMemoria({ presenciaMs: config.salas.presenciaMs });
if (!config.redis.url) {
  logger.warn(
    'Sin REDIS_URL: las salas viven en la memoria de este proceso. Sirve con un solo backend; para varios, usa Redis (npm run redis:local).',
  );
}

const { app, salas, tiempoReal } = crearServidor({ db: pool, logger, config, coordinacion });

/**
 * Arranque de una instancia, sin nada destructivo: con varias instancias, que esta arranque no
 * significa que nadie esté conectado. Abre la primera conexión a la base (avisa pronto si
 * DATABASE_URL falla) y a la coordinación de salas. Las migraciones no corren aquí
 * (npm run db:migrate); lo vencido lo limpia el mantenimiento de las salas.
 */
function arrancar() {
  pool
    .query('select 1')
    .then(() => logger.info('Base de datos conectada'))
    .catch((errorDb: Error) =>
      logger.warn('No se pudo conectar con la base de datos', {
        error: errorDb.message,
        ayuda: AYUDA_BASE,
      }),
    );
  salas
    .iniciar()
    .then(() =>
      logger.info('Salas en tiempo real listas', {
        coordinacion: config.redis.url ? 'redis' : 'memoria',
      }),
    )
    .catch((error: Error) =>
      logger.warn('La coordinación de salas no responde; se reintentará con la próxima entrada', {
        error: error.message,
      }),
    );
}

// En Vercel (vercel.json) la plataforma intercepta listen(): se queda con este servidor (y su
// WebSocket) sin abrir el puerto. Allí se arranca con la primera solicitud de cada instancia y no
// al cargar el módulo, porque el build también lo carga para inspeccionarlo.
const servidor = app.listen(config.puerto, (error) => {
  if (error) {
    logger.error(`No se pudo abrir el puerto ${config.puerto}`, { error: error.message });
    process.exit(1);
  }
  logger.info(`Backend escuchando en http://localhost:${config.puerto}`, {
    entorno: config.entorno,
    cors: config.origenesPermitidos,
  });
  if (!config.enVercel) arrancar();
});
if (config.enVercel) servidor.once('request', arrancar);

// WebSocket de salas en /ws/salas/:id, sobre el mismo puerto.
servidor.on('upgrade', (req, socket, cabecera) => tiempoReal.manejarUpgrade(req, socket, cabecera));

function apagar(senal: string) {
  logger.info(`Señal ${senal} recibida, cerrando el backend…`);
  setTimeout(() => process.exit(1), 5_000).unref();
  // No libera cupos ni presencias: quien estaba en esta instancia se reconecta a otra.
  salas.detener();
  tiempoReal.cerrar();
  servidor.close(() => {
    Promise.allSettled([coordinacion.cerrar(), pool.end()]).finally(() => process.exit(0));
  });
}

process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));

// El mismo servidor (con su `upgrade`) también como exportación por defecto: es la forma que la
// documentación de Vercel usa para WebSockets; listen() cubre a los cargadores que lo interceptan.
export default servidor;
