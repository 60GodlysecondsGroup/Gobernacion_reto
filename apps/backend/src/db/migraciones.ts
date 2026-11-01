import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import type { Logger } from '../lib/logger.js';
import { cargarFuentes, leerFuentes } from '../modules/fuentes/fuentes.carga.js';
import type { PoolDeDatos } from './database.js';

const DIR_MIGRACIONES = fileURLToPath(new URL('../../db/migraciones/', import.meta.url));
const ARCHIVO_SEED = fileURLToPath(new URL('../../db/seed/datos_base.sql', import.meta.url));
/** Cuentas sintéticas de prueba: solo para la base local (db:local, test:db). */
const ARCHIVO_USUARIOS_PRUEBA = fileURLToPath(
  new URL('../../db/seed/usuarios_prueba.sql', import.meta.url),
);
export const ARCHIVO_REGLAS_DLP = fileURLToPath(
  new URL('../../db/seed/reglas_dlp.json', import.meta.url),
);

export type ReglaDlpSemilla = {
  codigo: string;
  categoria: string;
  descripcion: string;
  patron: string;
  accion?: 'bloquear' | 'advertir' | 'registrar';
};

export async function leerReglasDlpSemilla(): Promise<ReglaDlpSemilla[]> {
  return JSON.parse(await readFile(ARCHIVO_REGLAS_DLP, 'utf8')) as ReglaDlpSemilla[];
}

/** Ejecuta `trabajo` en una transacción con un cliente dedicado: todo o nada. */
export async function enTransaccion<T>(
  pool: PoolDeDatos,
  trabajo: (cliente: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const cliente = await pool.connect();
  try {
    await cliente.query('begin');
    const resultado = await trabajo(cliente);
    await cliente.query('commit');
    return resultado;
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

export type OpcionesSemilla = {
  /** Agrega las cuentas sintéticas de prueba y su contenido. Solo en la base local. */
  usuariosPrueba?: boolean;
};

/**
 * Borra los datos y carga de nuevo los datos base (Anexo B.7: comunidades, salas, catálogo,
 * cuenta de administración), las reglas DLP predeterminadas (`db/seed/reglas_dlp.json`), las
 * fuentes institucionales (`db/seed/fuentes_institucionales.json`) y, si se piden, las cuentas
 * de prueba (`db/seed/usuarios_prueba.sql`).
 */
export async function sembrar(
  pool: PoolDeDatos,
  logger: Logger,
  { usuariosPrueba = false }: OpcionesSemilla = {},
): Promise<void> {
  const sql = await readFile(ARCHIVO_SEED, 'utf8');
  const sqlPrueba = usuariosPrueba ? await readFile(ARCHIVO_USUARIOS_PRUEBA, 'utf8') : null;
  const reglas = await leerReglasDlpSemilla();
  const fuentes = await leerFuentes();
  await enTransaccion(pool, async (cliente) => {
    await cliente.query(sql);
    for (const regla of reglas) {
      await cliente.query(
        `insert into app.regla_dlp (codigo, categoria, descripcion, patron, accion)
         values ($1, $2, $3, $4, $5)`,
        [
          regla.codigo,
          regla.categoria,
          regla.descripcion,
          regla.patron,
          regla.accion ?? 'bloquear',
        ],
      );
    }
    await cargarFuentes(cliente, fuentes, 'Carga inicial desde fuentes_institucionales.json.');
    if (sqlPrueba) await cliente.query(sqlPrueba);
  });
  logger.info(
    `Datos base, ${reglas.length} reglas DLP y ${fuentes.length} fuentes institucionales cargados` +
      (usuariosPrueba ? ', con las cuentas sintéticas de prueba.' : ' (sin cuentas de prueba).'),
  );
}

/**
 * Cuentas con contraseña en la base (0 si el esquema aún no existe). `db:seed` y `db:reset` las
 * borrarían: los scripts piden confirmación explícita antes.
 */
export async function contarCuentasConContrasena(pool: PoolDeDatos): Promise<number> {
  const { rows } = await pool.query<{ existe: boolean }>(
    "select to_regclass('app.credencial') is not null as existe",
  );
  if (!rows[0]?.existe) return 0;
  const conteo = await pool.query<{ total: number }>(
    'select count(*)::int as total from app.credencial',
  );
  return conteo.rows[0]?.total ?? 0;
}

/** Elimina el esquema `app` completo y lo reconstruye con migraciones + seed. Solo para desarrollo. */
export async function reiniciar(
  pool: PoolDeDatos,
  logger: Logger,
  opciones: OpcionesSemilla = {},
): Promise<void> {
  await pool.query('drop schema if exists app cascade');
  logger.info('Esquema "app" eliminado.');
  await migrar(pool, logger);
  await sembrar(pool, logger, opciones);
}
