/**
 * El contrato de la coordinación contra un Redis real (npm run redis:local). Cada ejecución usa
 * un prefijo propio y borra sus claves al terminar: no toca otros datos del mismo Redis.
 */
import { randomUUID } from 'node:crypto';
import { createClient } from 'redis';
import { afterAll, describe, it } from 'vitest';
import { crearLogger } from '../../src/lib/logger.js';
import { crearCoordinacionRedis } from '../../src/modules/salas/salas.coordinacion.redis.js';
import { contratoCoordinacion } from '../coordinacion.contrato.js';
import { URL_REDIS_PRUEBAS, redisDisponible } from '../apoyo.js';

const prefijo = `prueba:${randomUUID()}:`;
const logger = crearLogger('silencioso');

if (await redisDisponible()) {
  contratoCoordinacion('Redis', async (presenciaMs) => {
    const uno = crearCoordinacionRedis({ url: URL_REDIS_PRUEBAS, prefijo, presenciaMs, logger });
    const dos = crearCoordinacionRedis({ url: URL_REDIS_PRUEBAS, prefijo, presenciaMs, logger });
    return {
      uno,
      dos,
      cerrar: async () => {
        await Promise.all([uno.cerrar(), dos.cerrar()]);
      },
    };
  });

  afterAll(async () => {
    const cliente = createClient({ url: URL_REDIS_PRUEBAS });
    await cliente.connect();
    for await (const claves of cliente.scanIterator({ MATCH: `${prefijo}*`, COUNT: 500 })) {
      if (claves.length) await cliente.del(claves);
    }
    await cliente.close();
  });
} else {
  describe('Coordinación de salas · Redis', () => {
    it.skip(`sin Redis en ${URL_REDIS_PRUEBAS} (npm run redis:local)`, () => {});
  });
}
