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
import { crearRepositorioHilos } from './modules/comunidad/hilos.repository.js';
import { rutasHilos } from './modules/comunidad/hilos.routes.js';
import { crearServicioHilos } from './modules/comunidad/hilos.service.js';
import { crearRepositorioDlp } from './modules/dlp/dlp.repository.js';
import { crearServicioDlp } from './modules/dlp/dlp.service.js';
import { crearRepositorioFuentes } from './modules/fuentes/fuentes.repository.js';
import { rutasFuentes } from './modules/fuentes/fuentes.routes.js';
import { crearServicioFuentes } from './modules/fuentes/fuentes.service.js';
import { crearRepositorioModeracion } from './modules/moderacion/moderacion.repository.js';
import { rutasModeracion } from './modules/moderacion/moderacion.routes.js';
import { crearRepositorioAvatar } from './modules/avatar/avatar.repository.js';
import { rutasAvatar } from './modules/avatar/avatar.routes.js';
import { crearServicioAvatar } from './modules/avatar/avatar.service.js';
import { crearRepositorioPerfil } from './modules/perfil/perfil.repository.js';
import { rutasPerfil } from './modules/perfil/perfil.routes.js';
import { rutasOrientacion } from './modules/orientacion/orientacion.routes.js';
import { crearServicioOrientacion } from './modules/orientacion/orientacion.service.js';
import { crearServicioPerfil } from './modules/perfil/perfil.service.js';
import { crearRepositorioReportes } from './modules/reportes/reportes.repository.js';
import { rutasReportes } from './modules/reportes/reportes.routes.js';
import { crearServicioReportes } from './modules/reportes/reportes.service.js';
import { crearGestorSalas, type GestorSalas } from './modules/salas/salas.gestor.js';
import { crearRepositorioSalas } from './modules/salas/salas.repository.js';
import { rutasSalas } from './modules/salas/salas.routes.js';
import { crearTiempoRealSalas, type TiempoRealSalas } from './modules/salas/salas.ws.js';
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
  config: Pick<Config, 'origenesPermitidos' | 'sesion' | 'accesoDemo' | 'salas'>;
  /** Reemplazable cuando exista la verificación de edad definitiva. */
  proveedorRango?: ProveedorRangoEdad;
  ttlReglasDlpMs?: number;
  /** Ajustes de tiempo de las salas (las pruebas los acortan). */
  intervalosSalas?: {
    movimientoMs?: number;
    mensajeMs?: number;
    guardadoMs?: number;
    latidoMs?: number;
  };
};

export type Servidor = {
  app: Express;
  /** Estado en memoria de las salas en tiempo real. */
  salas: GestorSalas;
  /** WebSocket de salas: se conecta al evento `upgrade` del servidor HTTP. */
  tiempoReal: TiempoRealSalas;
};

/** Solo la aplicación HTTP (las pruebas que no usan salas en tiempo real). */
export const crearApp = (dependencias: Dependencias): Express => crearServidor(dependencias).app;

/**
 * Construye la aplicación HTTP y el tiempo real de salas, sin abrir el puerto.
 * Capas por módulo: rutas (HTTP) → servicio (reglas) → repositorio (SQL).
 */
export function crearServidor({
  db,
  logger,
  config,
  proveedorRango = proveedorRangoSintetico,
  ttlReglasDlpMs,
  intervalosSalas = {},
}: Dependencias): Servidor {
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
  const servicioComunidad = crearServicioComunidad(comunidades);
  app.use('/api', rutasComunidad(servicioComunidad));
  app.use(
    '/api',
    rutasHilos(
      crearServicioHilos({
        repositorio: crearRepositorioHilos(db),
        comunidades: servicioComunidad,
        dlp,
      }),
    ),
  );
  app.use(
    '/api',
    rutasReportes(
      crearServicioReportes({
        repositorio: crearRepositorioReportes(db),
        comunidades: servicioComunidad,
        dlp,
      }),
    ),
  );
  app.use(
    '/api',
    rutasPerfil(crearServicioPerfil({ repositorio: crearRepositorioPerfil(db), dlp })),
  );
  app.use('/api', rutasAvatar(crearServicioAvatar(crearRepositorioAvatar(db))));
  app.use('/api', rutasModeracion(crearRepositorioModeracion(db)));
  const fuentes = crearRepositorioFuentes(db);
  app.use('/api', rutasOrientacion(crearServicioOrientacion(fuentes)));
  app.use('/api', rutasFuentes(crearServicioFuentes(fuentes)));

  const repositorioSalas = crearRepositorioSalas(db);
  app.use('/api', rutasSalas(repositorioSalas, servicioComunidad));
  const salas = crearGestorSalas({
    repositorio: repositorioSalas,
    comunidades: servicioComunidad,
    dlp,
    logger,
    cierreSegundos: config.salas.cierreSegundos,
    intervaloMovimientoMs: intervalosSalas.movimientoMs,
    intervaloMensajeMs: intervalosSalas.mensajeMs,
    retrasoGuardadoMs: intervalosSalas.guardadoMs,
  });
  const tiempoReal = crearTiempoRealSalas({
    gestor: salas,
    sesiones,
    origenesPermitidos: config.origenesPermitidos,
    logger,
    latidoMs: intervalosSalas.latidoMs,
  });

  app.use(rutaNoEncontrada);
  app.use(manejadorDeErrores(logger));

  return { app, salas, tiempoReal };
}
