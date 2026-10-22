/** Datos de la base local de desarrollo (`npm run db:local`). Solo local: no son secretos. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PUERTO_DB_LOCAL = Number(process.env.DB_LOCAL_PUERTO ?? 5433);
/**
 * Base propia en UTF-8. En Windows el clúster nace con la codificación del sistema (WIN1252),
 * que no admite todos los caracteres del esquema y los datos; por eso no se usa la base `postgres`.
 */
export const NOMBRE_DB_LOCAL = 'comunidad';
const BASE_URL_LOCAL = `postgresql://postgres:postgres@localhost:${PUERTO_DB_LOCAL}`;
export const URL_ADMIN_DB_LOCAL = `${BASE_URL_LOCAL}/postgres`;
export const URL_DB_LOCAL = `${BASE_URL_LOCAL}/${NOMBRE_DB_LOCAL}`;
export const DIRECTORIO_DB_LOCAL = path.resolve(
  fileURLToPath(new URL('../../../', import.meta.url)),
  '.postgres-local',
);
/** Archivo que indica que la base local está lista (esquema y datos cargados). */
export const SENAL_DB_LOCAL = path.join(DIRECTORIO_DB_LOCAL, '.lista');
