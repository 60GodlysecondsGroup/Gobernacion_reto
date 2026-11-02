import { enTransaccion } from '../../db/migraciones.js';
import type { PoolDeDatos } from '../../db/database.js';
import { esquemaNombreCuenta } from '../administracion/administracion.service.js';
import { hashearContrasena, problemaDeContrasena } from '../seguridad/contrasena.js';
import { esquemaCorreo, nuevoCodigo } from '../seguridad/sesion.service.js';

/**
 * Inicialización del primer superadmin (bootstrap). Solo la usa `npm run superadmin:inicializar`
 * desde la consola del servidor, con acceso directo a la base: no existe ninguna ruta HTTP que
 * convierta a alguien en superadmin, ni credenciales por defecto.
 *
 *  - Regulariza una administración existente (Admin_001 nace sin correo): le asigna correo y
 *    contraseña y la sube a superadmin sin cambiar su id, así que conserva su contenido y su
 *    historial. O bien crea una cuenta nueva si se indica `nombre`.
 *  - Se niega si ya hay un superadmin activo que puede entrar (con contraseña), salvo en modo
 *    `recuperacion` (todas las personas con superadministración perdieron el acceso).
 *  - Cierra las sesiones previas de la cuenta y deja registro de auditoría sin secretos.
 */
export type OpcionesInicializacion = {
  correo: string;
  contrasena: string;
  /** Nametag de la administración que se regulariza. Sin él, la única administración que haya. */
  alias?: string;
  /** Crea una cuenta nueva con este nombre en lugar de regularizar una existente. */
  nombre?: string;
  recuperacion?: boolean;
};

export type ResultadoInicializacion = {
  id: string;
  nombre: string;
  correo: string;
  cuentaNueva: boolean;
  rolAnterior: string | null;
  sesionesCerradas: number;
};

/** Error esperado de la inicialización: el mensaje se muestra tal cual en la consola. */
export class ErrorInicializacion extends Error {}

export async function inicializarSuperadmin(
  pool: PoolDeDatos,
  opciones: OpcionesInicializacion,
): Promise<ResultadoInicializacion> {
  const correo = esquemaCorreo.safeParse(opciones.correo);
  if (!correo.success) {
    throw new ErrorInicializacion(`Correo no válido: ${correo.error.issues[0]?.message ?? ''}`);
  }
  if (opciones.alias && opciones.nombre) {
    throw new ErrorInicializacion('Indica --alias (regularizar) o --nombre (crear), no ambos.');
  }
  const nombre =
    opciones.nombre === undefined ? null : esquemaNombreCuenta.safeParse(opciones.nombre);
  if (nombre && !nombre.success) {
    throw new ErrorInicializacion(`Nombre no válido: ${nombre.error.issues[0]?.message ?? ''}`);
  }

  try {
    return await enTransaccion(pool, async (cliente) => {
      // Mismo candado que el disparador del último superadmin: dos inicializaciones (o una
      // inicialización y un cambio desde el panel) no se cruzan.
      await cliente.query(`select pg_advisory_xact_lock(hashtext('app.ultimo_superadmin'))`);

      const { rows: vigentes } = await cliente.query<{ alias: string }>(
        `select u.alias from app.usuario u
         where u.rol = 'superadmin' and u.estado = 'activo'
           and exists (select 1 from app.credencial c where c.id_usuario = u.id_usuario)`,
      );
      if (vigentes.length > 0 && !opciones.recuperacion) {
        throw new ErrorInicializacion(
          `Ya hay superadministración activa (${vigentes.map((v) => v.alias).join(', ')}). ` +
            'Gestiona las cuentas desde la sección Superadmin del panel. Solo si nadie puede ' +
            'entrar, repite con --recuperacion.',
        );
      }

      const { rows: duenoCorreo } = await cliente.query<{ alias: string; id: string }>(
        'select id_usuario as id, alias from app.usuario where correo = $1',
        [correo.data],
      );

      let cuenta: { id: string; alias: string; rol: string | null; estado: string | null };
      if (nombre) {
        if (duenoCorreo[0]) throw new ErrorInicializacion('Ese correo ya lo usa otra cuenta.');
        cuenta = { id: '', alias: nombre.data, rol: null, estado: null };
      } else {
        const { rows: candidatas } = await cliente.query<{
          id: string;
          alias: string;
          rol: string;
          estado: string;
        }>(
          `select id_usuario as id, alias, rol, estado from app.usuario
           where ($1::text is not null and lower(alias) = lower($1)
                  and rol in ('admin_plataforma', 'superadmin'))
              or ($1::text is null and rol = 'admin_plataforma')
           order by codigo`,
          [opciones.alias ?? null],
        );
        if (candidatas.length === 0) {
          throw new ErrorInicializacion(
            opciones.alias
              ? `No hay una cuenta de administración con el nametag «${opciones.alias}».`
              : 'No hay ninguna cuenta de administración. Crea una nueva con -- --nombre "<Nombre>".',
          );
        }
        if (candidatas.length > 1) {
          throw new ErrorInicializacion(
            `Hay varias cuentas de administración (${candidatas.map((c) => c.alias).join(', ')}). ` +
              'Indica cuál con -- --alias <nametag>.',
          );
        }
        cuenta = candidatas[0]!;
        if (duenoCorreo[0] && duenoCorreo[0].id !== cuenta.id) {
          throw new ErrorInicializacion('Ese correo ya lo usa otra cuenta.');
        }
      }

      const problema = problemaDeContrasena(
        opciones.contrasena,
        cuenta.alias,
        'La contraseña no puede contener el nombre de la cuenta.',
      );
      if (problema) throw new ErrorInicializacion(`${problema} No se cambió nada.`);
      const hash = await hashearContrasena(opciones.contrasena);

      let sesionesCerradas = 0;
      if (nombre) {
        const { rows } = await cliente.query<{ id: string }>(
          `insert into app.usuario (codigo, alias, rol, correo)
           values ($1, $2, 'superadmin', $3) returning id_usuario as id`,
          [nuevoCodigo(), cuenta.alias, correo.data],
        );
        cuenta.id = rows[0]!.id;
      } else {
        await cliente.query(
          `update app.usuario set rol = 'superadmin', correo = $2, estado = 'activo'
           where id_usuario = $1`,
          [cuenta.id, correo.data],
        );
        const cierre = await cliente.query(
          `update app.sesion set fecha_revocacion = now()
           where id_usuario = $1 and fecha_revocacion is null`,
          [cuenta.id],
        );
        sesionesCerradas = cierre.rowCount ?? 0;
      }
      await cliente.query(
        `insert into app.credencial (id_usuario, hash_contrasena) values ($1, $2)
         on conflict (id_usuario) do update set hash_contrasena = excluded.hash_contrasena`,
        [cuenta.id, hash],
      );
      await cliente.query(
        `insert into app.registro_auditoria (id_usuario_actor, accion, entidad, id_entidad, detalle)
         values (null, 'inicializar_superadmin', 'cuenta_administracion', $1, $2::jsonb)`,
        [
          cuenta.id,
          JSON.stringify({
            origen: 'consola',
            cuentaNueva: Boolean(nombre),
            rolAnterior: cuenta.rol,
            estadoAnterior: cuenta.estado,
            recuperacion: Boolean(opciones.recuperacion),
          }),
        ],
      );

      return {
        id: cuenta.id,
        nombre: cuenta.alias,
        correo: correo.data,
        cuentaNueva: Boolean(nombre),
        rolAnterior: cuenta.rol,
        sesionesCerradas,
      };
    });
  } catch (error) {
    const { code, constraint } = error as { code?: string; constraint?: string };
    if (code === '23505' && constraint === 'usuario_alias_unico') {
      throw new ErrorInicializacion('Ese nombre ya lo usa otra cuenta.');
    }
    if (code === '23505' && constraint === 'usuario_correo_unico') {
      throw new ErrorInicializacion('Ese correo ya lo usa otra cuenta.');
    }
    throw error;
  }
}
