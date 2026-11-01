import EmbeddedPostgres from 'embedded-postgres';
import type { Logger } from '../src/lib/logger.js';
import { DIRECTORIO_DB_LOCAL, PUERTO_DB_LOCAL } from './db-local.config.js';

/**
 * Servidor PostgreSQL embebido del clúster local (`.postgres-local/`). Lo comparten
 * `npm run db:local` y `npm run test:db`.
 */
export function crearServidorLocal(logger: Logger) {
  return new EmbeddedPostgres({
    databaseDir: DIRECTORIO_DB_LOCAL,
    port: PUERTO_DB_LOCAL,
    user: 'postgres',
    password: 'postgres',
    persistent: true,
    // UTF-8 y sin configuración regional del sistema, igual en Windows, macOS y Linux.
    initdbFlags: ['--encoding=UTF8', '--no-locale'],
    // En un usuario administrador de Linux (contenedores), PostgreSQL no arranca como root.
    createPostgresUser: process.platform !== 'win32' && process.getuid?.() === 0,
    onLog: () => {},
    onError: (error) => {
      const texto = error instanceof Error ? error.message : String(error);
      if (texto.trim()) logger.warn('PostgreSQL local', { mensaje: texto.trim().slice(0, 300) });
    },
  });
}
