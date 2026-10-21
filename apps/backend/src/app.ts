import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Config } from './config/env.js';
import type { Database } from './db/database.js';
import { manejadorDeErrores, rutaNoEncontrada } from './http/errores.js';
import { verificarOrigen } from './http/origen.js';
import { registroDeSolicitudes } from './http/registro-solicitudes.js';
import type { Logger } from './lib/logger.js';
import { crearRepositorioComunidades } from './modules/comunidad/comunidad.repository.js';
import { rutasComunidad } from './modules/comunidad/comunidad.routes.js';
import { crearServicioComunidad } from './modules/comunidad/comunidad.service.js';
import { crearRepositorioDlp } from './modules/dlp/dlp.repository.js';
import { crearServicioDlp } from './modules/dlp/dlp.service.js';
import { crearRepositorioFuentes } from './modules/fuentes/fuentes.repository.js';
import { rutasFuentes } from './modules/fuentes/fuentes.routes.js';
import { crearServicioFuentes } from './modules/fuentes/fuentes.service.js';
import { crearRepositorioModeracion } from './modules/moderacion/moderacion.repository.js';
import { rutasModeracion } from './modules/moderacion/moderacion.routes.js';
import { crearRepositorioPerfil } from './modules/perfil/perfil.repository.js';
import { rutasPerfil } from './modules/perfil/perfil.routes.js';
import { rutasOrientacion } from './modules/orientacion/orientacion.routes.js';
import { crearServicioOrientacion } from './modules/orientacion/orientacion.service.js';
import { crearServicioPerfil } from './modules/perfil/perfil.service.js';
import {
  proveedorRangoSintetico,
  type ProveedorRangoEdad,
} from './modules/seguridad/rango-edad.js';
import { cargarSesion } from './modules/seguridad/sesion.middleware.js';
import { rutasSesion } from './modules/seguridad/sesion.routes.js';
import { crearServicioSesion } from './modules/seguridad/sesion.service.js';
import { crearRepositorioUsuarios } from './modules/seguridad/usuarios.repository.js';
import { crearRepositorioSistema } from './modules/sistema/sistema.repository.js';
import { rutasSistema } from './modules/sistema/sistema.routes.js';
import { crearServicioSistema } from './modules/sistema/sistema.service.js';

export type Dependencias = {
  db: Database;
  logger: Logger;
  config: Pick<Config, 'origenesPermitidos' | 'sesion' | 'accesoDemo'>;
  /** Reemplazable cuando exista la verificación de edad definitiva. */
  proveedorRango?: ProveedorRangoEdad;
  ttlReglasDlpMs?: number;
};

/**
 * Construye la aplicación HTTP sin abrir el puerto (las pruebas la usan directamente).
 * Capas por módulo: rutas (HTTP) → servicio (reglas) → repositorio (SQL).
 */
export function crearApp({
  db,
  logger,
  config,
  proveedorRango = proveedorRangoSintetico,
  ttlReglasDlpMs,
}: Dependencias): Express {
  const app = express();

  app.use(registroDeSolicitudes(logger));
  app.use(helmet());
  app.use(cors({ origin: config.origenesPermitidos, credentials: true }));
  app.use(verificarOrigen(config.origenesPermitidos));
  app.use(express.json({ limit: '50kb' }));

  const comunidades = crearRepositorioComunidades(db);
  const sesiones = crearServicioSesion({
    usuarios: crearRepositorioUsuarios(db),
    comunidades,
    proveedorRango,
    secreto: config.sesion.secreto,
    duracionMs: config.sesion.duracionMs,
  });
  const dlp = crearServicioDlp({
    repositorio: crearRepositorioDlp(db, logger),
    logger,
    ttlReglasMs: ttlReglasDlpMs,
  });

  app.use(cargarSesion(sesiones));

  app.use('/api', rutasSistema(crearServicioSistema(crearRepositorioSistema(db), logger)));
  app.use(
    '/api',
    rutasSesion(sesiones, {
      accesoDemo: config.accesoDemo,
      duracionMs: config.sesion.duracionMs,
      cookieSegura: config.sesion.cookieSegura,
    }),
  );
  app.use('/api', rutasComunidad(crearServicioComunidad(comunidades)));
  app.use(
    '/api',
    rutasPerfil(crearServicioPerfil({ repositorio: crearRepositorioPerfil(db), dlp })),
  );
  app.use('/api', rutasModeracion(crearRepositorioModeracion(db)));
  const fuentes = crearRepositorioFuentes(db);
  app.use('/api', rutasOrientacion(crearServicioOrientacion(fuentes)));
  app.use('/api', rutasFuentes(crearServicioFuentes(fuentes)));

  app.use(rutaNoEncontrada);
  app.use(manejadorDeErrores(logger));

  return app;
}
