/**
 * Define (o restablece) la contraseña de una cuenta de administración o superadministración, desde
 * la consola del servidor. Sirve sobre todo antes de inicializar la superadministración; después,
 * la sección Superadmin del panel restablece las contraseñas de la administración.
 *
 *   npm run admin:contrasena                       → la cuenta admin_plataforma (si hay una sola)
 *   npm run admin:contrasena -- --alias AdminDemo   → una cuenta concreta
 *   npm run admin:contrasena -- --reemplazar        → cambia una contraseña que ya existe
 *
 * La contraseña se escribe sin que se vea (dos veces) y nunca se imprime ni se registra: solo se
 * guarda su hash scrypt. Al reemplazarla se cierran todas las sesiones abiertas de esa cuenta.
 * Queda constancia en el registro de auditoría (sin el hash).
 */
import { parseArgs } from 'node:util';
import { cargarConfig } from '../src/config/env.js';
import { crearPool } from '../src/db/database.js';
import { crearLogger } from '../src/lib/logger.js';
import { hashearContrasena, problemaDeContrasena } from '../src/modules/seguridad/contrasena.js';
import { crearRepositorioSesiones } from '../src/modules/seguridad/sesiones.repository.js';
import { crearRepositorioUsuarios } from '../src/modules/seguridad/usuarios.repository.js';
import { leerContrasenaNueva } from './consola.js';

const { values } = parseArgs({
  options: { alias: { type: 'string' }, reemplazar: { type: 'boolean', default: false } },
});

const config = cargarConfig();
const logger = crearLogger(config.nivelLog === 'silencioso' ? 'info' : config.nivelLog);

const pool = crearPool(config.baseDeDatos);
try {
  const { rows: admins } = await pool.query<{
    id: string;
    alias: string;
    estado: string;
    correo: string | null;
    tieneContrasena: boolean;
  }>(
    `select u.id_usuario as id, u.alias, u.estado, u.correo,
            exists (select 1 from app.credencial c where c.id_usuario = u.id_usuario) as "tieneContrasena"
     from app.usuario u
     where u.rol in ('admin_plataforma', 'superadmin')
       and ($1::text is null or lower(u.alias) = lower($1))
     order by u.codigo`,
    [values.alias ?? null],
  );

  if (admins.length === 0) {
    throw new Error(
      values.alias
        ? `No hay una cuenta de administración con el nametag «${values.alias}».`
        : 'No hay ninguna cuenta de administración en la base.',
    );
  }
  if (admins.length > 1) {
    throw new Error(
      `Hay varias cuentas de administración (${admins.map((a) => a.alias).join(', ')}). ` +
        'Indica cuál con -- --alias <nametag>.',
    );
  }
  const admin = admins[0]!;
  if (admin.estado !== 'activo') {
    logger.warn(
      `La cuenta ${admin.alias} está «${admin.estado}»: no podrá entrar hasta reactivarla.`,
    );
  }
  if (admin.tieneContrasena && !values.reemplazar) {
    throw new Error(
      `${admin.alias} ya tiene contraseña. Para cambiarla usa -- --reemplazar ` +
        '(cierra todas sus sesiones abiertas).',
    );
  }

  const contrasena = await leerContrasenaNueva(admin.alias, logger);

  const problema = problemaDeContrasena(contrasena, admin.alias);
  if (problema) throw new Error(`${problema} No se cambió nada.`);

  const resultado = await crearRepositorioUsuarios(pool).guardarContrasena(
    admin.id,
    await hashearContrasena(contrasena),
  );
  const cerradas = await crearRepositorioSesiones(pool).revocarTodas(admin.id);
  logger.info(
    `Contraseña ${resultado === 'creada' ? 'definida' : 'reemplazada'} para ${admin.alias}. ` +
      `Sesiones cerradas: ${cerradas}. ` +
      (admin.correo
        ? `Ya puede entrar en /acceso/personal con su correo (${admin.correo}).`
        : 'Ya puede entrar en /acceso con su nametag. Para pasarla a correo: npm run superadmin:inicializar.'),
  );
} catch (error) {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}
