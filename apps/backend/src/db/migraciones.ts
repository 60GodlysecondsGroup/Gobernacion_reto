import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import type { Logger } from '../lib/logger.js';
import type { PoolDeDatos } from './database.js';

const DIR_MIGRACIONES = fileURLToPath(new URL('../../db/migraciones/', import.meta.url));
const ARCHIVO_SEED = fileURLToPath(new URL('../../db/seed/datos_demo.sql', import.meta.url));

async function enTransaccion(
  pool: PoolDeDatos,
  trabajo: (cliente: pg.PoolClient) => Promise<void>,
) {
  const cliente = await pool.connect();
  try {
    await cliente.query('begin');
    await trabajo(cliente);
    await cliente.query('commit');
  } catch (error) {
    await cliente.query('rollback');
    throw error;
  } finally {
    cliente.release();
  }
}

/** Aplica, en orden y una sola vez, los archivos `db/migraciones/NNNN_*.sql` pendientes. */
export async function migrar(pool: PoolDeDatos, logger: Logger): Promise<string[]> {
  await pool.query(`
    create schema if not exists app;
    create table if not exists app.migraciones (
      nombre text primary key,
      aplicada_en timestamptz not null default now()
    );
  `);

  const { rows } = await pool.query<{ nombre: string }>('select nombre from app.migraciones');
  const aplicadas = new Set(rows.map((fila) => fila.nombre));
  const archivos = (await readdir(DIR_MIGRACIONES))
    .filter((archivo) => archivo.endsWith('.sql'))
    .sort();

  const nuevas: string[] = [];
  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) continue;
    const sql = await readFile(path.join(DIR_MIGRACIONES, archivo), 'utf8');
    await enTransaccion(pool, async (cliente) => {
      await cliente.query(sql);
      await cliente.query('insert into app.migraciones (nombre) values ($1)', [archivo]);
    });
    logger.info(`Migración aplicada: ${archivo}`);
    nuevas.push(archivo);
  }

  if (nuevas.length === 0) logger.info('El esquema ya estaba al día.');
  return nuevas;
}

/** Borra los datos y carga de nuevo los datos sintéticos de demostración (Anexo B.7). */
export async function sembrar(pool: PoolDeDatos, logger: Logger): Promise<void> {
  const sql = await readFile(ARCHIVO_SEED, 'utf8');
  await enTransaccion(pool, async (cliente) => {
    await cliente.query(sql);
  });
  logger.info('Datos sintéticos de demostración cargados.');
}

/** Elimina el esquema `app` completo y lo reconstruye con migraciones + seed. Solo para desarrollo. */
export async function reiniciar(pool: PoolDeDatos, logger: Logger): Promise<void> {
  await pool.query('drop schema if exists app cascade');
  logger.info('Esquema "app" eliminado.');
  await migrar(pool, logger);
  await sembrar(pool, logger);
}
