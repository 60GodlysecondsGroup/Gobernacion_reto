import { createServer } from 'node:http';
import { crearServidor } from './app.js';
import { cargarConfig, type Config } from './config/env.js';
import { crearPool, type PoolDeDatos } from './db/database.js';
import { AYUDA_BASE } from './http/errores.js';
import {
  datosError,
  emitirDiagnostico,
  presenciaVariablesObligatorias,
} from './lib/diagnostico.js';
import { crearLogger } from './lib/logger.js';
import {
  crearCoordinacionMemoria,
  type CoordinacionSalas,
} from './modules/salas/salas.coordinacion.js';
import { crearCoordinacionRedis } from './modules/salas/salas.coordinacion.redis.js';

emitirDiagnostico('info', 'backend.proceso.iniciado', {
  node: process.version,
  vercel: Boolean(process.env.VERCEL),
});

process.on('uncaughtExceptionMonitor', (error, origen) => {
  emitirDiagnostico('error', 'backend.excepcion_no_capturada', {
    origen,
    ...datosError(error),
  });
});

process.on('unhandledRejection', (motivo) => {
  emitirDiagnostico('error', 'backend.promesa_rechazada_sin_manejo', datosError(motivo));
  // Mantiene el comportamiento fatal por defecto: solo registra y vuelve a lanzar el rechazo.
  queueMicrotask(() => {
    throw motivo;
  });
});

let config: Config;
emitirDiagnostico('info', 'backend.configuracion.validacion.inicio');
try {
  config = cargarConfig();
  emitirDiagnostico('info', 'backend.configuracion.validada', {
    variablesObligatorias: presenciaVariablesObligatorias(),
    vercel: config.enVercel,
    entorno: config.entorno,
  });
} catch (error) {
  emitirDiagnostico('error', 'backend.configuracion.invalida', {
    variablesObligatorias: presenciaVariablesObligatorias(),
    ...datosError(error, true),
  });

  throw error;
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
emitirDiagnostico('info', 'backend.postgres.pool.creacion.inicio');
let pool: PoolDeDatos;
try {
  pool = crearPool(config.baseDeDatos);
} catch (error) {
  emitirDiagnostico('error', 'backend.postgres.pool.creacion.fallida', datosError(error));
  throw error;
}
emitirDiagnostico('info', 'backend.postgres.pool.creado', {
  maxConexiones: 5,
  timeoutConexionMs: 10_000,
});
pool.on('error', (error) => {
  logger.error('Error en una conexión inactiva de la base de datos', {
    error: datosError(error),
  });
});

if (config.sesion.secretoGenerado) {
  logger.warn('Sin SESSION_SECRET: se usa uno temporal y las sesiones se pierden al reiniciar.');
}

// Salas compartidas entre instancias (Redis) o, solo en desarrollo y con un único backend, en la
// memoria de este proceso. La configuración ya exige REDIS_URL en producción y en Vercel.
let coordinacion: CoordinacionSalas;
emitirDiagnostico('info', 'backend.redis.cliente.creacion.inicio', {
  transporte: config.redis.url ? 'tcp' : 'memoria',
});
try {
  coordinacion = config.redis.url
    ? crearCoordinacionRedis({
        url: config.redis.url,
        prefijo: config.redis.prefijo,
        presenciaMs: config.salas.presenciaMs,
        logger,
      })
    : crearCoordinacionMemoria({ presenciaMs: config.salas.presenciaMs });
  emitirDiagnostico('info', 'backend.redis.cliente.creacion.correcta', {
    transporte: config.redis.url ? 'tcp' : 'memoria',
  });
} catch (error) {
  emitirDiagnostico('error', 'backend.redis.cliente.creacion.fallida', datosError(error, true));
  throw error;
}
if (!config.redis.url) {
  logger.warn(
    'Sin REDIS_URL: las salas viven en la memoria de este proceso. Sirve con un solo backend; para varios, usa Redis (npm run redis:local).',
  );
}

emitirDiagnostico('info', 'backend.express.creacion.inicio');
let app: ReturnType<typeof crearServidor>['app'];
let salas: ReturnType<typeof crearServidor>['salas'];
let tiempoReal: ReturnType<typeof crearServidor>['tiempoReal'];
let inicio: Promise<void> | null = null;
try {
  ({ app, salas, tiempoReal } = crearServidor({
    db: pool,
    logger,
    config,
    coordinacion,
    prepararSolicitud: arrancar,
  }));
  emitirDiagnostico('info', 'backend.express.creacion.correcta');
} catch (error) {
  emitirDiagnostico('error', 'backend.express.creacion.fallida', datosError(error));
  throw error;
}

/**
 * Arranque de una instancia, sin nada destructivo: con varias instancias, que esta arranque no
 * significa que nadie esté conectado. Abre la primera conexión a la base (avisa pronto si
 * DATABASE_URL falla) y a la coordinación de salas. Las migraciones no corren aquí
 * (npm run db:migrate); lo vencido lo limpia el mantenimiento de las salas.
 */
function arrancar(): Promise<void> {
  if (inicio) return inicio;

  emitirDiagnostico('info', 'backend.inicializacion.primera_solicitud');
  const postgres = (async () => {
    emitirDiagnostico('info', 'backend.postgres.prueba_conexion.inicio');
    try {
      await pool.query('select 1');
      emitirDiagnostico('info', 'backend.postgres.prueba_conexion.correcta');
      logger.info('Base de datos conectada');
    } catch (errorDb) {
      emitirDiagnostico('error', 'backend.postgres.prueba_conexion.fallida', datosError(errorDb));
      logger.warn('No se pudo conectar con la base de datos', {
        error: datosError(errorDb),
        ayuda: AYUDA_BASE,
      });
    }
  })();
  const redis = (async () => {
    emitirDiagnostico('info', 'backend.redis.inicializacion_salas.inicio', {
      transporte: config.redis.url ? 'tcp' : 'memoria',
    });
    try {
      await salas.iniciar();
      emitirDiagnostico('info', 'backend.redis.inicializacion_salas.correcta');
      logger.info('Salas en tiempo real listas', {
        coordinacion: config.redis.url ? 'redis' : 'memoria',
      });
    } catch (error) {
      emitirDiagnostico(
        'error',
        'backend.redis.inicializacion_salas.fallida',
        datosError(error, true),
      );
      logger.warn('La coordinación de salas no responde; se reintentará con la próxima entrada', {
        error: datosError(error, true),
      });
    }
  })();
  inicio = Promise.all([postgres, redis]).then(() => undefined);
  return inicio;
}

// Vercel recibe el servidor sin abrir un puerto; localmente escuchamos en BACKEND_PORT.
emitirDiagnostico('info', 'backend.http.servidor.creacion.inicio', { enVercel: config.enVercel });
const servidor = createServer(app);
emitirDiagnostico('info', 'backend.http.servidor.creado', { enVercel: config.enVercel });

// WebSocket de salas en /ws/salas/:id, sobre el mismo puerto.
servidor.on('upgrade', (req, socket, cabecera) => {
  void arrancar().then(() => tiempoReal.manejarUpgrade(req, socket, cabecera));
});

if (config.enVercel) {
  emitirDiagnostico('info', 'backend.http.listen.omitido', { motivo: 'vercel' });
} else {
  emitirDiagnostico('info', 'backend.http.listen.inicio', { puerto: config.puerto });
  servidor.on('error', (error) => {
    emitirDiagnostico('error', 'backend.http.listen.fallido', datosError(error, true));
    logger.error(`No se pudo abrir el puerto ${config.puerto}`, { error: datosError(error, true) });
  });
  servidor.listen(config.puerto, () => {
    emitirDiagnostico('info', 'backend.http.listen.correcto', { puerto: config.puerto });
    logger.info(`Backend escuchando en http://localhost:${config.puerto}`, {
      entorno: config.entorno,
      cors: config.origenesPermitidos,
    });
    void arrancar();
  });
}

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
