/**
 * Ejecuta un comando de base de datos (migrar | sembrar | reiniciar) contra la base local de
 * `npm run db:local`, sin tocar el .env:  npm run db:reset:local
 */
import { URL_DB_LOCAL } from './db-local.config.js';

process.env.DATABASE_URL = URL_DB_LOCAL;
process.env.DATABASE_SSL = 'disable';
await import('./db.js');
