import type pg from 'pg';
import { createClient } from 'redis';
import type { Dependencias } from '../src/app.js';
import type { Database } from '../src/db/database.js';
import { NOMBRE_COOKIE_SESION } from '../src/modules/seguridad/sesion.middleware.js';
import { abrirSesionInterna } from '../src/modules/seguridad/sesion.service.js';

export const ORIGEN_FRONTEND = 'http://localhost:3000';

/** Configuración fija para pruebas: nunca lee el .env ni secretos reales. */
export const configPrueba: Dependencias['config'] = {
  origenesPermitidos: [ORIGEN_FRONTEND],
  sesion: {
    secreto: 'secreto-solo-para-pruebas-automatizadas-0000',
    secretoGenerado: false,
    duracionMs: 60 * 60 * 1000,
    duracionRecordadaMs: 24 * 60 * 60 * 1000,
    cookieSegura: false,
  },
  salas: { cierreSegundos: 180, latidoMs: 10_000, presenciaMs: 30_000 },
  openai: { model: 'gpt-5.4-mini' },
};

/**
 * Cookie de sesión de una cuenta sintética de prueba (Usuario_001, Moderador_001…). Esas cuentas
 * no tienen contraseña: la sesión se abre directamente en la base, igual que la abriría un inicio
 * de sesión correcto. La API no ofrece ningún acceso sin contraseña.
 */
export async function cookieDe(db: Database, codigo: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'select id_usuario as id from app.usuario where codigo = $1',
    [codigo],
  );
  if (!rows[0]) throw new Error(`No existe la cuenta de prueba ${codigo}`);
  const token = await abrirSesionInterna(
    db,
    configPrueba.sesion.secreto,
    rows[0].id,
    configPrueba.sesion.duracionMs,
  );
  return `${NOMBRE_COOKIE_SESION}=${token}`;
}

/**
 * Database sobre un único cliente (una transacción de prueba) que encola las consultas en orden.
 * Así el tiempo real puede usarlo con varias conexiones a la vez sin pisarse.
 */
export function enCola(cliente: pg.PoolClient): Database {
  let cola: Promise<unknown> = Promise.resolve();
  return {
    query: ((sql: string, parametros?: unknown[]) => {
      const resultado = cola.then(() => cliente.query(sql, parametros));
      cola = resultado.catch(() => undefined);
      return resultado;
    }) as Database['query'],
  };
}

/** Redis de las pruebas con varias instancias (npm run redis:local). */
export const URL_REDIS_PRUEBAS = process.env.REDIS_URL_PRUEBAS ?? 'redis://localhost:6379';

/** true si responde el Redis de pruebas; si no, esas pruebas se omiten diciendo por qué. */
export async function redisDisponible(): Promise<boolean> {
  const cliente = createClient({
    url: URL_REDIS_PRUEBAS,
    socket: { connectTimeout: 1500, reconnectStrategy: false },
  });
  cliente.on('error', () => {});
  try {
    await cliente.connect();
    await cliente.ping();
    return true;
  } catch {
    console.warn(
      'Sin Redis para pruebas: se omiten las pruebas con varias instancias (npm run redis:local).',
    );
    return false;
  } finally {
    if (cliente.isOpen) await cliente.close();
  }
}

/** Espera hasta que `obtener()` cumpla la condición (o falla al vencer el plazo). */
export async function hasta<T>(
  obtener: () => Promise<T>,
  condicion: (valor: T) => boolean,
  limiteMs = 10_000,
) {
  const inicio = Date.now();
  for (;;) {
    const valor = await obtener();
    if (condicion(valor)) return valor;
    if (Date.now() - inicio > limiteMs) throw new Error('La condición no se cumplió a tiempo');
    await new Promise((r) => setTimeout(r, 100));
  }
}
