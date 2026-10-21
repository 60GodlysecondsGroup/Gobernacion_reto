import pg from 'pg';
import type { Config } from '../config/env.js';

/** Contrato mínimo de acceso a datos. Los repositorios dependen de esto, no de `pg`. */
export type Database = {
  query<Fila extends pg.QueryResultRow = pg.QueryResultRow>(
    sql: string,
    parametros?: unknown[],
  ): Promise<pg.QueryResult<Fila>>;
};

export type PoolDeDatos = pg.Pool;

function opcionesSsl(modo: Config['baseDeDatos']['ssl']): pg.PoolConfig['ssl'] {
  if (modo === 'disable') return false;
  // "require" equivale a sslmode=require de libpq: conexión cifrada sin verificar el certificado.
  if (modo === 'require') return { rejectUnauthorized: false };
  return { rejectUnauthorized: true };
}

/** Quita `sslmode` de la URL: si se deja, `pg` lo antepone a la opción `ssl` configurada aquí. */
function urlSinSslmode(url: string): string {
  const parseada = new URL(url);
  parseada.searchParams.delete('sslmode');
  return parseada.toString();
}

export function crearPool(config: Config['baseDeDatos']): PoolDeDatos {
  return new pg.Pool({
    connectionString: urlSinSslmode(config.url),
    ssl: opcionesSsl(config.ssl),
    // El pooler de Supabase limita las conexiones por proyecto; para la demo bastan pocas.
    max: 5,
    // Abrir una conexión (TLS + autenticación) tarda ~2 s contra Supabase: se conservan abiertas.
    idleTimeoutMillis: 10 * 60_000,
    keepAlive: true,
    connectionTimeoutMillis: 10_000,
    application_name: 'backend-prototipo',
  });
}
