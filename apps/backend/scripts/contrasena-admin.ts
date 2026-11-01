/**
 * Define (o restablece) la contraseña de la cuenta de administración, desde la consola del
 * servidor. Es la única forma de hacerlo: no existe una ruta HTTP para esto.
 *
 *   npm run admin:contrasena                       → la cuenta admin_plataforma (si hay una sola)
 *   npm run admin:contrasena -- --alias AdminDemo   → una cuenta concreta
 *   npm run admin:contrasena -- --reemplazar        → cambia una contraseña que ya existe
 *
 * La contraseña se escribe sin que se vea (dos veces) y nunca se imprime ni se registra: solo se
 * guarda su hash scrypt. Al reemplazarla se cierran todas las sesiones abiertas de esa cuenta.
 * Queda constancia en el registro de auditoría (sin el hash).
 */
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { cargarConfig } from '../src/config/env.js';
import { crearPool } from '../src/db/database.js';
import { crearLogger } from '../src/lib/logger.js';
import { hashearContrasena, problemaDeContrasena } from '../src/modules/seguridad/contrasena.js';
import { crearRepositorioSesiones } from '../src/modules/seguridad/sesiones.repository.js';
import { crearRepositorioUsuarios } from '../src/modules/seguridad/usuarios.repository.js';

const { values } = parseArgs({
  options: { alias: { type: 'string' }, reemplazar: { type: 'boolean', default: false } },
});

const config = cargarConfig();
const logger = crearLogger(config.nivelLog === 'silencioso' ? 'info' : config.nivelLog);

/** Lee una línea sin mostrar lo que se escribe (terminal interactiva). */
function preguntarOculto(pregunta: string): Promise<string> {
  const entrada = process.stdin;
  process.stdout.write(pregunta);
  entrada.setRawMode(true);
  entrada.resume();
  entrada.setEncoding('utf8');
  let valor = '';
  return new Promise((resolver, rechazar) => {
    const terminar = () => {
      entrada.off('data', alTeclear);
      entrada.setRawMode(false);
      entrada.pause();
      process.stdout.write('\n');
    };
    function alTeclear(texto: string) {
      for (const caracter of texto) {
        if (caracter === '\r' || caracter === '\n') {
          terminar();
          return resolver(valor);
        }
        if (caracter === '\u0003') {
          terminar();
          return rechazar(new Error('Cancelado.'));
        }
        if (caracter === '\u007f' || caracter === '\b') valor = valor.slice(0, -1);
        else valor += caracter;
      }
    }
    entrada.on('data', alTeclear);
  });
}

/** Sin terminal (entrada redirigida): la primera línea de la entrada estándar. */
async function leerPrimeraLinea(): Promise<string> {
  const lector = createInterface({ input: process.stdin });
  for await (const linea of lector) {
    lector.close();
    return linea;
  }
  return '';
}

const pool = crearPool(config.baseDeDatos);
try {
  const { rows: admins } = await pool.query<{
    id: string;
    alias: string;
    estado: string;
    tieneContrasena: boolean;
  }>(
    `select u.id_usuario as id, u.alias, u.estado,
            exists (select 1 from app.credencial c where c.id_usuario = u.id_usuario) as "tieneContrasena"
     from app.usuario u
     where u.rol = 'admin_plataforma' and ($1::text is null or lower(u.alias) = lower($1))
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

  let contrasena: string;
  if (process.stdin.isTTY) {
    console.log(`Nueva contraseña para ${admin.alias} (no se mostrará al escribir).`);
    contrasena = await preguntarOculto('Contraseña: ');
    if ((await preguntarOculto('Repítela: ')) !== contrasena) {
      throw new Error('Las contraseñas no coinciden. No se cambió nada.');
    }
  } else {
    logger.warn(
      'La entrada no es una terminal interactiva: se toma la primera línea de la entrada estándar.',
    );
    contrasena = await leerPrimeraLinea();
  }

  const problema = problemaDeContrasena(contrasena, admin.alias);
  if (problema) throw new Error(`${problema} No se cambió nada.`);

  const resultado = await crearRepositorioUsuarios(pool).guardarContrasena(
    admin.id,
    await hashearContrasena(contrasena),
  );
  const cerradas = await crearRepositorioSesiones(pool).revocarTodas(admin.id);
  logger.info(
    `Contraseña ${resultado === 'creada' ? 'definida' : 'reemplazada'} para ${admin.alias}. ` +
      `Sesiones cerradas: ${cerradas}. Ya puede entrar en /acceso con su nametag.`,
  );
} catch (error) {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}
