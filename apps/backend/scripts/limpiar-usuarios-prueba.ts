/**
 * Elimina las cuentas sintéticas de prueba de la base del .env, conservando la administración.
 *
 *   npm run usuarios:limpiar-prueba                  → simulación: muestra el inventario, no borra
 *   npm run usuarios:limpiar-prueba -- --confirmar   → borra, en una sola transacción
 *
 * Criterios (todos a la vez, nunca por el alias): código de la semilla de prueba o Simulado_NNN,
 * sin contraseña y sin rol de administración (src/db/usuarios-prueba.ts). Las cuentas registradas
 * por personas tienen contraseña y nunca entran en la lista. Deshabilitado con NODE_ENV=production.
 */
import { parseArgs } from 'node:util';
import { cargarConfig } from '../src/config/env.js';
import { crearPool } from '../src/db/database.js';
import { enTransaccion } from '../src/db/migraciones.js';
import {
  eliminarUsuariosPrueba,
  inventariarUsuariosPrueba,
  type InventarioUsuariosPrueba,
} from '../src/db/usuarios-prueba.js';
import { crearLogger } from '../src/lib/logger.js';

const { values } = parseArgs({ options: { confirmar: { type: 'boolean', default: false } } });
const config = cargarConfig();
const logger = crearLogger(config.nivelLog === 'silencioso' ? 'info' : config.nivelLog);

if (config.entorno === 'production') {
  logger.error('La limpieza de cuentas de prueba está deshabilitada con NODE_ENV=production.');
  process.exit(1);
}

function mostrar(inventario: InventarioUsuariosPrueba) {
  const { candidatas, administracion, otrasCuentas } = inventario;
  console.log(`\nCuentas de prueba encontradas: ${candidatas.length}`);
  if (candidatas.length) {
    console.table(
      candidatas.map(({ id: _id, ...cuenta }) => ({ ...cuenta, bloqueo: cuenta.bloqueo ?? '—' })),
    );
  }
  console.log('Administración (se conserva):');
  console.table(administracion);
  console.log(`Otras cuentas (registradas, no se tocan): ${otrasCuentas}\n`);
}

const base = new URL(config.baseDeDatos.url);
logger.info(`Base: ${base.hostname}${base.pathname}`);

const pool = crearPool(config.baseDeDatos);
try {
  const inventario = await inventariarUsuariosPrueba(pool);
  mostrar(inventario);

  if (inventario.administracion.length === 0) {
    throw new Error('No hay ninguna cuenta de administración: no se borra nada por seguridad.');
  }
  const bloqueadas = inventario.candidatas.filter((cuenta) => cuenta.bloqueo);
  if (bloqueadas.length) {
    logger.warn(`${bloqueadas.length} cuenta(s) no se pueden borrar sin perder trazabilidad.`);
  }

  if (!values.confirmar) {
    logger.info('Simulación: no se borró nada. Para borrar, repite con -- --confirmar.');
  } else if (inventario.candidatas.length === bloqueadas.length) {
    logger.info('No hay cuentas de prueba que borrar.');
  } else {
    const resultado = await enTransaccion(pool, (cliente) => eliminarUsuariosPrueba(cliente));
    logger.info('Limpieza aplicada', resultado);
    mostrar(await inventariarUsuariosPrueba(pool));
  }
} catch (error) {
  logger.error('Falló la limpieza', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
} finally {
  await pool.end();
}
