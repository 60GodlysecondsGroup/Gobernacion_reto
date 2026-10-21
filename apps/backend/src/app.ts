import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Database } from './db/database.js';
import { manejadorDeErrores, rutaNoEncontrada } from './http/errores.js';
import { registroDeSolicitudes } from './http/registro-solicitudes.js';
import type { Logger } from './lib/logger.js';
import { crearRepositorioSistema } from './modules/sistema/sistema.repository.js';
import { rutasSistema } from './modules/sistema/sistema.routes.js';
import { crearServicioSistema } from './modules/sistema/sistema.service.js';

export type Dependencias = {
  db: Database;
  logger: Logger;
  origenesPermitidos: string[];
};

/**
 * Construye la aplicación HTTP sin abrir el puerto (las pruebas la usan directamente).
 * Capas por módulo: rutas (HTTP) → servicio (reglas) → repositorio (SQL).
 */
export function crearApp({ db, logger, origenesPermitidos }: Dependencias): Express {
  const app = express();

  app.use(registroDeSolicitudes(logger));
  app.use(helmet());
  app.use(cors({ origin: origenesPermitidos, credentials: true }));
  app.use(express.json({ limit: '50kb' }));

  const sistema = crearServicioSistema(crearRepositorioSistema(db), logger);
  app.use('/api', rutasSistema(sistema));

  app.use(rutaNoEncontrada);
  app.use(manejadorDeErrores(logger));

  return app;
}
