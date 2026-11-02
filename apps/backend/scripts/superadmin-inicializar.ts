/**
 * Inicializa la primera cuenta de superadministración, desde la consola del servidor (con acceso a
 * la base del entorno). Es la única forma de crear el primer superadmin: no hay ruta HTTP, ni
 * credenciales por defecto. Después, la sección Superadmin del panel gestiona el resto.
 *
 *   npm run superadmin:inicializar -- --correo persona@entidad.gov.co
 *       → regulariza la única cuenta admin_plataforma (p. ej. AdminDemo): le asigna el correo y
 *         una contraseña nueva y la sube a superadmin, conservando su id y su historial.
 *   npm run superadmin:inicializar -- --correo … --alias AdminDemo      → una cuenta concreta
 *   npm run superadmin:inicializar -- --correo … --nombre "Ana Torres"  → crea una cuenta nueva
 *   npm run superadmin:inicializar -- --correo … --alias … --recuperacion
 *       → solo si ya hay superadmin pero nadie puede entrar (contraseña perdida, etc.)
 *
 * La contraseña se escribe sin que se vea (dos veces) y nunca se imprime ni se registra: solo se
 * guarda su hash scrypt. Se cierran las sesiones previas de la cuenta y queda constancia en el
 * registro de auditoría (sin el hash ni la contraseña).
 */
import { parseArgs } from 'node:util';
import { cargarConfig } from '../src/config/env.js';
import { crearPool } from '../src/db/database.js';
import { crearLogger } from '../src/lib/logger.js';
import {
  ErrorInicializacion,
  inicializarSuperadmin,
} from '../src/modules/superadmin/superadmin.inicializacion.js';
import { leerContrasenaNueva } from './consola.js';

const { values } = parseArgs({
  options: {
    correo: { type: 'string' },
    alias: { type: 'string' },
    nombre: { type: 'string' },
    recuperacion: { type: 'boolean', default: false },
  },
});

const config = cargarConfig();
const logger = crearLogger(config.nivelLog === 'silencioso' ? 'info' : config.nivelLog);

const pool = crearPool(config.baseDeDatos);
try {
  if (!values.correo) {
    throw new ErrorInicializacion(
      'Indica el correo de acceso: npm run superadmin:inicializar -- --correo <correo>',
    );
  }
  const para = values.nombre ?? values.alias ?? 'la cuenta de administración';
  const contrasena = await leerContrasenaNueva(para, logger);
  const resultado = await inicializarSuperadmin(pool, {
    correo: values.correo,
    contrasena,
    alias: values.alias,
    nombre: values.nombre,
    recuperacion: values.recuperacion,
  });
  logger.info(
    `${resultado.nombre} ${resultado.cuentaNueva ? 'creada como' : `(antes ${resultado.rolAnterior}) ahora es`} ` +
      `superadministración. Sesiones cerradas: ${resultado.sesionesCerradas}. ` +
      `Entra en /acceso/personal con ${resultado.correo}; la sección Superadmin está en /panel/superadmin.`,
  );
} catch (error) {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}
