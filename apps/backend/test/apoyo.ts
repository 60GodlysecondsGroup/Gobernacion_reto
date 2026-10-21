import type pg from 'pg';
import type { Dependencias } from '../src/app.js';
import type { Database } from '../src/db/database.js';

export const ORIGEN_FRONTEND = 'http://localhost:3000';

/** Configuración fija para pruebas: nunca lee el .env ni secretos reales. */
export const configPrueba: Dependencias['config'] = {
  origenesPermitidos: [ORIGEN_FRONTEND],
  sesion: {
    secreto: 'secreto-solo-para-pruebas-automatizadas-0000',
    secretoGenerado: false,
    duracionMs: 60 * 60 * 1000,
    cookieSegura: false,
  },
  accesoDemo: true,
  salas: { cierreSegundos: 180 },
};

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
