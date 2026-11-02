/**
 * Superadministración: jerarquía SUPERADMIN / ADMINISTRACIÓN, gestión de cuentas de
 * administración, protección del último superadmin e inicialización por consola, contra la base
 * local de pruebas (npm run test:db).
 *
 * Casi todo corre en transacciones que se revierten: el registro de auditoría es de solo
 * inserción y Admin_001 / Superadmin_001 deben quedar como estaban para las demás pruebas. Solo
 * la prueba de concurrencia confirma cambios (dos conexiones), por SQL y deshaciéndolos al final.
 */
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { cargarConfig } from '../../src/config/env.js';
import { crearPool, type Database, type PoolDeDatos } from '../../src/db/database.js';
import { crearLogger } from '../../src/lib/logger.js';
import { verificarContrasena } from '../../src/modules/seguridad/contrasena.js';
import { NOMBRE_COOKIE_SESION } from '../../src/modules/seguridad/sesion.middleware.js';
import { abrirSesionInterna } from '../../src/modules/seguridad/sesion.service.js';
import {
  ErrorInicializacion,
  inicializarSuperadmin,
} from '../../src/modules/superadmin/superadmin.inicializacion.js';
import { configPrueba, cookieDe } from '../apoyo.js';

const logger = crearLogger('silencioso');
const CONTRASENA = 'faro-del-llano-42';
const OTRA_CONTRASENA = 'garza-morena-77';
const SIN_LIMITES = {
  fallosPorCuenta: 1000,
  fallosPorIp: 1000,
  registrosPorIp: 1000,
  ventanaMs: 60_000,
};
const RUTA = '/api/superadmin/administradores';

type App = ReturnType<typeof crearApp>;

let pool: PoolDeDatos;
let app: App;
const cookies: Record<string, string> = {};
const ids: Record<string, string> = {};

let contador = 0;
const sufijo = () => `${Date.now().toString(36)}${contador++}`;
/** Correos de esta prueba: el dominio `.test` no existe. */
const correoNuevo = () => `admin.${sufijo()}@superadmin.test`;
const nombreNuevo = () => `Admin ${sufijo()}`;

const cookieSesion = (res: { headers: Record<string, unknown> }) =>
  ((res.headers['set-cookie'] as string[] | undefined) ?? []).find((c) => c.startsWith('sesion='));
const soloValor = (setCookie: string) => setCookie.split(';')[0]!;

/** Cliente HTTP con la cookie dada (o sin sesión). */
const como = (aplicacion: App, cookie?: string) => {
  const conCookie = (r: request.Test) => (cookie ? r.set('Cookie', cookie) : r);
  return {
    get: (ruta: string) => conCookie(request(aplicacion).get(ruta)),
    post: (ruta: string, cuerpo: object = {}) =>
      conCookie(request(aplicacion).post(ruta)).send(cuerpo),
    patch: (ruta: string, cuerpo: object = {}) =>
      conCookie(request(aplicacion).patch(ruta)).send(cuerpo),
  };
};

const entrarConCorreo = (aplicacion: App, correo: string, contrasena = CONTRASENA) =>
  request(aplicacion).post('/api/sesion/personal').send({ correo, contrasena });

const quienSoy = async (aplicacion: App, cookie: string) =>
  (await request(aplicacion).get('/api/sesion').set('Cookie', cookie)).body.usuario;

async function cookiePorId(db: Database, idUsuario: string) {
  const token = await abrirSesionInterna(
    db,
    configPrueba.sesion.secreto,
    idUsuario,
    configPrueba.sesion.duracionMs,
  );
  return `${NOMBRE_COOKIE_SESION}=${token}`;
}

const nuevaApp = (db: Database) =>
  crearApp({ db, logger, config: configPrueba, limitesAcceso: SIN_LIMITES });

/** Crea una cuenta de administración como Superadmin_001 y devuelve su id, correo y nombre. */
async function crearAdministracion(
  aplicacion: App,
  datos: Record<string, unknown> = {},
): Promise<{ id: string; correo: string; nombre: string }> {
  const correo = correoNuevo();
  const nombre = nombreNuevo();
  const res = await como(aplicacion, cookies.superadmin).post(RUTA, {
    nombre,
    correo,
    contrasena: CONTRASENA,
    confirmacion: CONTRASENA,
    rol: 'admin_plataforma',
    ...datos,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return { id: res.body.cuenta.id as string, correo, nombre };
}

/**
 * Cliente de una transacción que se revierte al final, con `connect()` para el código que abre
 * su propia transacción (la inicialización): sus begin/commit/rollback pasan a ser puntos de
 * guardado dentro de la transacción de la prueba.
 */
function poolSobre(cliente: pg.PoolClient): PoolDeDatos {
  const anidado = {
    query: (sql: string, parametros?: unknown[]) => {
      const orden = sql.trim().toLowerCase();
      if (orden === 'begin') return cliente.query('savepoint inicializacion');
      if (orden === 'commit') return cliente.query('release savepoint inicializacion');
      if (orden === 'rollback') return cliente.query('rollback to savepoint inicializacion');
      return cliente.query(sql, parametros);
    },
    release: () => undefined,
  };
  return {
    connect: async () => anidado,
    query: cliente.query.bind(cliente),
  } as unknown as PoolDeDatos;
}

/** Ejecuta la prueba con una app sobre una transacción que se revierte al terminar. */
async function enTransaccionRevertida(prueba: (app: App, cliente: pg.PoolClient) => Promise<void>) {
  const cliente = await pool.connect();
  try {
    await cliente.query('begin');
    await prueba(nuevaApp(cliente), cliente);
  } finally {
    await cliente.query('rollback');
    cliente.release();
  }
}

const auditoriaDe = async (db: Database, idEntidad: string) =>
  (
    await db.query<{ accion: string; detalle: Record<string, unknown>; actor: string | null }>(
      `select accion, detalle, id_usuario_actor as actor from app.registro_auditoria
       where entidad = 'cuenta_administracion' and id_entidad = $1 order by id_registro`,
      [idEntidad],
    )
  ).rows;

beforeAll(async () => {
  pool = crearPool(cargarConfig().baseDeDatos);
  app = nuevaApp(pool);
  for (const [clave, codigo] of [
    ['superadmin', 'Superadmin_001'],
    ['admin', 'Admin_001'],
    ['moderador', 'Moderador_001'],
    ['gestor', 'Gestor_001'],
    ['joven', 'Usuario_001'],
  ] as const) {
    cookies[clave] = await cookieDe(pool, codigo);
  }
  for (const fila of (await pool.query(`select codigo, id_usuario from app.usuario`)).rows) {
    ids[fila.codigo] = fila.id_usuario;
  }
});

afterAll(async () => {
  await pool.end();
});

describe('Acceso a la sección Superadmin', () => {
  it('un superadmin consulta las cuentas de administración sin datos sensibles', async () => {
    const res = await como(app, cookies.superadmin).get(RUTA);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    const codigos = res.body.cuentas.map((c: { id: string }) => c.id);
    expect(codigos).toEqual(expect.arrayContaining([ids.Superadmin_001, ids.Admin_001]));
    // Solo cuentas de administración: ni personal ni jóvenes.
    expect(codigos).not.toContain(ids.Moderador_001);
    expect(codigos).not.toContain(ids.Usuario_001);
    expect(res.body.cuentas.find((c: { id: string }) => c.id === ids.Admin_001)).toMatchObject({
      nombre: 'AdminDemo',
      correo: null,
      rol: 'admin_plataforma',
      estado: 'activo',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/scrypt|hash/i);
  });

  it('la sesión del superadmin anuncia el permiso; la de la administración no', async () => {
    expect((await quienSoy(app, cookies.superadmin!)).permisos).toContain(
      'gestionar_administradores',
    );
    const admin = await quienSoy(app, cookies.admin!);
    expect(admin.rol).toBe('admin_plataforma');
    expect(admin.permisos).not.toContain('gestionar_administradores');
  });

  it('el superadmin conserva las funciones administrativas de siempre', async () => {
    for (const ruta of ['/api/admin/resumen', '/api/admin/personal', '/api/admin/salas']) {
      expect((await como(app, cookies.superadmin).get(ruta)).status, ruta).toBe(200);
    }
  });

  it('administración, personal y jóvenes reciben 403; sin sesión, 401 (también por API directa)', async () => {
    const objetivo = ids.Admin_001!;
    const solicitudes: [string, string, object?][] = [
      ['get', RUTA],
      [
        'post',
        RUTA,
        { nombre: 'X', correo: 'x@x.co', contrasena: 'a', confirmacion: 'a', rol: 'superadmin' },
      ],
      ['patch', `${RUTA}/${objetivo}`, { correo: 'otro@x.co' }],
      ['patch', `${RUTA}/${objetivo}/rol`, { rol: 'superadmin' }],
      ['patch', `${RUTA}/${objetivo}/estado`, { estado: 'suspendido' }],
      ['post', `${RUTA}/${objetivo}/contrasena`, { contrasena: 'x', confirmacion: 'x' }],
    ];
    for (const [metodo, ruta, cuerpo] of solicitudes) {
      for (const quien of ['admin', 'moderador', 'gestor', 'joven'] as const) {
        const cliente = como(app, cookies[quien]);
        const res =
          metodo === 'get'
            ? await cliente.get(ruta)
            : await cliente[metodo as 'post' | 'patch'](ruta, cuerpo);
        expect(res.status, `${quien} ${metodo} ${ruta}`).toBe(403);
      }
      const anonimo = como(app);
      const res =
        metodo === 'get'
          ? await anonimo.get(ruta)
          : await anonimo[metodo as 'post' | 'patch'](ruta, cuerpo);
      expect(res.status, `anónimo ${metodo} ${ruta}`).toBe(401);
    }
    // Nada cambió.
    const { rows } = await pool.query(
      `select rol, correo, estado from app.usuario where id_usuario = $1`,
      [objetivo],
    );
    expect(rows[0]).toEqual({ rol: 'admin_plataforma', correo: null, estado: 'activo' });
  });

  it('el registro de acciones de cuentas de administración solo lo ve la superadministración', async () => {
    await enTransaccionRevertida(async (enTx) => {
      await crearAdministracion(enTx);
      const deSuper = await como(enTx, cookies.superadmin).get(
        '/api/admin/auditoria?entidad=cuenta_administracion',
      );
      expect(deSuper.status).toBe(200);
      expect(deSuper.body.registros[0]).toMatchObject({
        accion: 'crear_cuenta_administracion',
        entidad: 'cuenta_administracion',
        actor: { id: ids.Superadmin_001 },
      });
      const deAdmin = await como(enTx, cookies.admin).get(
        '/api/admin/auditoria?entidad=cuenta_administracion',
      );
      expect(deAdmin.status).toBe(200);
      expect(deAdmin.body.registros).toEqual([]);
    });
  });
});

describe('Gestión de cuentas de administración', () => {
  it('crea una administración con correo y contraseña (solo el hash) y queda registrada', async () => {
    await enTransaccionRevertida(async (enTx, cliente) => {
      const correo = correoNuevo();
      const nombre = nombreNuevo();
      const res = await como(enTx, cookies.superadmin).post(RUTA, {
        nombre,
        correo: `  ${correo.toUpperCase()} `,
        contrasena: CONTRASENA,
        confirmacion: CONTRASENA,
        rol: 'admin_plataforma',
      });
      expect(res.status).toBe(201);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body.cuenta).toMatchObject({
        nombre,
        correo,
        rol: 'admin_plataforma',
        estado: 'activo',
        tieneContrasena: true,
        sesionesAbiertas: 0,
      });
      expect(JSON.stringify(res.body)).not.toMatch(/faro-del-llano|scrypt|hash_/i);

      const { rows } = await cliente.query(
        `select u.rol, u.rango_edad, c.hash_contrasena as hash
         from app.usuario u join app.credencial c using (id_usuario) where u.id_usuario = $1`,
        [res.body.cuenta.id],
      );
      expect(rows[0]).toMatchObject({ rol: 'admin_plataforma', rango_edad: null });
      expect(rows[0].hash).toMatch(/^scrypt\$/);
      expect(await verificarContrasena(CONTRASENA, rows[0].hash)).toBe(true);

      const registros = await auditoriaDe(cliente, res.body.cuenta.id);
      expect(registros).toEqual([
        {
          accion: 'crear_cuenta_administracion',
          detalle: { rolNuevo: 'admin_plataforma' },
          actor: ids.Superadmin_001,
        },
      ]);
      expect(JSON.stringify(registros)).not.toMatch(/@|faro|scrypt/);

      // Entra con su correo, administra y no ve la sección Superadmin.
      const entrada = await entrarConCorreo(enTx, correo);
      expect(entrada.status).toBe(201);
      expect(entrada.body.usuario.rol).toBe('admin_plataforma');
      const cookie = soloValor(cookieSesion(entrada)!);
      expect((await como(enTx, cookie).get('/api/admin/resumen')).status).toBe(200);
      expect((await como(enTx, cookie).get(RUTA)).status).toBe(403);
    });
  });

  // Sin transacción: un duplicado aborta la transacción de la prueba, y aquí nada se guarda.
  it('valida los datos y rechaza campos extra, roles ajenos y duplicados', async () => {
    {
      const base = {
        nombre: nombreNuevo(),
        correo: correoNuevo(),
        contrasena: CONTRASENA,
        confirmacion: CONTRASENA,
        rol: 'admin_plataforma',
      };
      const superadmin = como(app, cookies.superadmin);
      const casos: [string, object, number][] = [
        ['estado extra', { ...base, estado: 'activo' }, 400],
        ['código extra', { ...base, codigo: 'Admin_999' }, 400],
        ['rol de joven', { ...base, rol: 'usuario' }, 400],
        ['rol de personal', { ...base, rol: 'moderador' }, 400],
        ['correo inválido', { ...base, correo: 'no-es-correo' }, 400],
        ['contraseña corta', { ...base, contrasena: 'corta', confirmacion: 'corta' }, 400],
        ['confirmación distinta', { ...base, confirmacion: 'otra-cosa-123' }, 400],
        ['correo de otra cuenta', { ...base, correo: 'superadmin.demo@prueba.test' }, 409],
        ['nombre de otra cuenta', { ...base, nombre: 'AdminDemo' }, 409],
      ];
      for (const [caso, cuerpo, estado] of casos) {
        expect((await superadmin.post(RUTA, cuerpo)).status, caso).toBe(estado);
      }
      const duplicado = await superadmin.post(RUTA, {
        ...base,
        correo: 'SUPERADMIN.demo@prueba.test',
      });
      expect(duplicado.body.error.codigo).toBe('CORREO_EN_USO');
      const { rows } = await pool.query(
        `select count(*)::int as total from app.usuario where alias = $1`,
        [base.nombre],
      );
      expect(rows[0].total).toBe(0);
    }
  });

  it('regulariza la administración sin correo: correo, contraseña y acceso por «Acceso del equipo»', async () => {
    await enTransaccionRevertida(async (enTx, cliente) => {
      const superadmin = como(enTx, cookies.superadmin);
      const correo = correoNuevo();
      const editar = await superadmin.patch(`${RUTA}/${ids.Admin_001}`, { correo });
      expect(editar.status).toBe(200);
      expect(editar.body.cuenta).toMatchObject({ correo, rol: 'admin_plataforma' });
      const clave = await superadmin.post(`${RUTA}/${ids.Admin_001}/contrasena`, {
        contrasena: CONTRASENA,
        confirmacion: CONTRASENA,
      });
      expect(clave.status).toBe(200);
      expect(clave.body.cuenta.tieneContrasena).toBe(true);

      const entrada = await entrarConCorreo(enTx, correo);
      expect(entrada.status).toBe(201);
      expect(entrada.body.usuario).toMatchObject({ alias: 'AdminDemo', rol: 'admin_plataforma' });
      // Con correo ya no entra por el acceso con nametag.
      const porNametag = await request(enTx)
        .post('/api/sesion')
        .send({ alias: 'AdminDemo', contrasena: CONTRASENA });
      expect(porNametag.status).toBe(401);

      expect((await auditoriaDe(cliente, ids.Admin_001!)).map((r) => r.accion)).toEqual([
        'actualizar_cuenta_administracion',
        'restablecer_contrasena',
      ]);
      expect((await auditoriaDe(cliente, ids.Admin_001!))[0]!.detalle).toEqual({
        campos: ['correo'],
      });
    });
  });

  it('desactivar quita el acceso de inmediato aunque tenga sesiones emitidas', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const cuenta = await crearAdministracion(enTx);
      const cookie = soloValor(cookieSesion(await entrarConCorreo(enTx, cuenta.correo))!);
      expect((await como(enTx, cookie).get('/api/admin/resumen')).status).toBe(200);

      const superadmin = como(enTx, cookies.superadmin);
      const desactivar = await superadmin.patch(`${RUTA}/${cuenta.id}/estado`, {
        estado: 'suspendido',
      });
      expect(desactivar.status).toBe(200);
      expect(desactivar.body.cuenta).toMatchObject({ estado: 'suspendido', sesionesAbiertas: 0 });
      expect(await quienSoy(enTx, cookie)).toBeNull();
      expect((await como(enTx, cookie).get('/api/admin/resumen')).status).toBe(401);
      const bloqueada = await entrarConCorreo(enTx, cuenta.correo);
      expect(bloqueada.status).toBe(403);
      expect(bloqueada.body.error.codigo).toBe('CUENTA_NO_ACTIVA');

      // «bloqueado» es una medida de moderación: aquí solo activar o desactivar.
      expect(
        (await superadmin.patch(`${RUTA}/${cuenta.id}/estado`, { estado: 'bloqueado' })).status,
      ).toBe(400);

      const reactivar = await superadmin.patch(`${RUTA}/${cuenta.id}/estado`, { estado: 'activo' });
      expect(reactivar.status).toBe(200);
      // La cookie anterior se revocó: hay que entrar de nuevo.
      expect(await quienSoy(enTx, cookie)).toBeNull();
      expect((await entrarConCorreo(enTx, cuenta.correo)).status).toBe(201);
    });
  });

  it('restablecer la contraseña invalida la anterior y cierra las sesiones', async () => {
    await enTransaccionRevertida(async (enTx, cliente) => {
      const cuenta = await crearAdministracion(enTx);
      const cookie = soloValor(cookieSesion(await entrarConCorreo(enTx, cuenta.correo))!);
      const res = await como(enTx, cookies.superadmin).post(`${RUTA}/${cuenta.id}/contrasena`, {
        contrasena: OTRA_CONTRASENA,
        confirmacion: OTRA_CONTRASENA,
      });
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toMatch(/garza|scrypt/);
      expect(await quienSoy(enTx, cookie)).toBeNull();
      expect((await entrarConCorreo(enTx, cuenta.correo, CONTRASENA)).status).toBe(401);
      expect((await entrarConCorreo(enTx, cuenta.correo, OTRA_CONTRASENA)).status).toBe(201);
      const registros = await auditoriaDe(cliente, cuenta.id);
      expect(registros.at(-1)).toMatchObject({
        accion: 'restablecer_contrasena',
        detalle: { origen: 'superadmin' },
      });
      expect(JSON.stringify(registros)).not.toMatch(/garza|scrypt/);
    });
  });

  it('sube a superadmin, baja a administración y revoca privilegios a un rol de personal', async () => {
    await enTransaccionRevertida(async (enTx, cliente) => {
      const cuenta = await crearAdministracion(enTx);
      const superadmin = como(enTx, cookies.superadmin);

      const subir = await superadmin.patch(`${RUTA}/${cuenta.id}/rol`, { rol: 'superadmin' });
      expect(subir.status).toBe(200);
      expect(subir.body).toMatchObject({ cambio: true, cuenta: { rol: 'superadmin' } });
      const cookie = soloValor(cookieSesion(await entrarConCorreo(enTx, cuenta.correo))!);
      expect((await como(enTx, cookie).get(RUTA)).status).toBe(200);

      // Bajar de nivel cierra sus sesiones y le quita la sección en la siguiente solicitud.
      const bajar = await superadmin.patch(`${RUTA}/${cuenta.id}/rol`, { rol: 'admin_plataforma' });
      expect(bajar.status).toBe(200);
      expect(await quienSoy(enTx, cookie)).toBeNull();
      const otra = soloValor(cookieSesion(await entrarConCorreo(enTx, cuenta.correo))!);
      expect((await como(enTx, otra).get(RUTA)).status).toBe(403);

      // Revocar la administración: pasa a personal y sale de esta lista.
      const revocar = await superadmin.patch(`${RUTA}/${cuenta.id}/rol`, { rol: 'moderador' });
      expect(revocar.status).toBe(200);
      expect(revocar.body).toMatchObject({ rol: 'moderador', cambio: true, cuenta: null });
      expect(await quienSoy(enTx, otra)).toBeNull();
      const moderador = soloValor(cookieSesion(await entrarConCorreo(enTx, cuenta.correo))!);
      expect((await quienSoy(enTx, moderador)).rol).toBe('moderador');
      expect((await como(enTx, moderador).get('/api/admin/salas')).status).toBe(403);
      // Ya no es una cuenta de administración: esta sección no la encuentra.
      expect(
        (await superadmin.patch(`${RUTA}/${cuenta.id}/rol`, { rol: 'superadmin' })).status,
      ).toBe(404);

      expect((await auditoriaDe(cliente, cuenta.id)).map((r) => [r.accion, r.detalle])).toEqual([
        ['crear_cuenta_administracion', { rolNuevo: 'admin_plataforma' }],
        [
          'cambiar_rol_administracion',
          { rolAnterior: 'admin_plataforma', rolNuevo: 'superadmin', sesionesCerradas: false },
        ],
        [
          'cambiar_rol_administracion',
          { rolAnterior: 'superadmin', rolNuevo: 'admin_plataforma', sesionesCerradas: true },
        ],
        [
          'revocar_privilegios_administracion',
          { rolAnterior: 'admin_plataforma', rolNuevo: 'moderador', sesionesCerradas: true },
        ],
      ]);
    });
  });

  it('no sube a superadmin una cuenta sin correo', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const res = await como(enTx, cookies.superadmin).patch(`${RUTA}/${ids.Admin_001}/rol`, {
        rol: 'superadmin',
      });
      expect(res.status).toBe(409);
      expect(res.body.error.codigo).toBe('CORREO_REQUERIDO');
    });
  });

  it('nadie actúa sobre su propia cuenta y las cuentas ajenas a la administración no existen aquí', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const superadmin = como(enTx, cookies.superadmin);
      const propia = ids.Superadmin_001!;
      for (const [ruta, cuerpo] of [
        [`${RUTA}/${propia}`, { nombre: 'Otro nombre' }],
        [`${RUTA}/${propia}/rol`, { rol: 'admin_plataforma' }],
        [`${RUTA}/${propia}/estado`, { estado: 'suspendido' }],
      ] as const) {
        expect((await superadmin.patch(ruta, cuerpo)).status, ruta).toBe(403);
      }
      expect(
        (
          await superadmin.post(`${RUTA}/${propia}/contrasena`, {
            contrasena: OTRA_CONTRASENA,
            confirmacion: OTRA_CONTRASENA,
          })
        ).status,
      ).toBe(403);
      for (const id of [ids.Usuario_001!, ids.Moderador_001!, 'no-es-un-uuid']) {
        expect(
          (await superadmin.patch(`${RUTA}/${id}/estado`, { estado: 'suspendido' })).status,
          id,
        ).toBe(404);
      }
    });
  });
});

describe('Escalada de privilegios', () => {
  it('la administración no se eleva ni se crea otra administración por el panel general', async () => {
    await enTransaccionRevertida(async (enTx, cliente) => {
      const admin = como(enTx, cookies.admin);
      // Su propia cuenta, por la sección Superadmin: 403 antes de mirar nada.
      expect(
        (await admin.patch(`${RUTA}/${ids.Admin_001}/rol`, { rol: 'superadmin' })).status,
      ).toBe(403);
      // Cuentas de personal con rol de administración: el esquema solo admite personal.
      for (const rol of ['superadmin', 'admin_plataforma']) {
        const crear = await admin.post('/api/admin/personal', {
          nombre: nombreNuevo(),
          correo: correoNuevo(),
          contrasena: CONTRASENA,
          confirmacion: CONTRASENA,
          rol,
        });
        expect(crear.status, rol).toBe(400);
        expect(
          (await admin.patch(`/api/admin/personal/${ids.Moderador_001}`, { rol })).status,
        ).toBe(400);
      }
      // Ni la administración ni la moderación suspenden cuentas de administración.
      for (const [quien, objetivo] of [
        ['admin', ids.Superadmin_001],
        ['moderador', ids.Superadmin_001],
        ['moderador', ids.Admin_001],
        ['superadmin', ids.Admin_001],
      ] as const) {
        const res = await como(enTx, cookies[quien]).patch(`/api/admin/usuarios/${objetivo}`, {
          estado: 'suspendido',
        });
        expect(res.status, `${quien} → ${objetivo}`).toBe(403);
      }
      const { rows } = await cliente.query(
        `select codigo, rol, estado from app.usuario
         where codigo in ('Admin_001', 'Superadmin_001', 'Moderador_001') order by codigo`,
      );
      expect(rows).toEqual([
        { codigo: 'Admin_001', rol: 'admin_plataforma', estado: 'activo' },
        { codigo: 'Moderador_001', rol: 'moderador', estado: 'activo' },
        { codigo: 'Superadmin_001', rol: 'superadmin', estado: 'activo' },
      ]);
    });
  });

  it('el registro público nunca crea cuentas de administración ni superadmin', async () => {
    for (const rol of ['superadmin', 'admin_plataforma']) {
      const res = await request(app)
        .post('/api/sesion/registro')
        .send({
          alias: `Intento${sufijo()}`,
          contrasena: CONTRASENA,
          rango: 'B',
          intereses: [],
          avatar: {},
          rol,
        });
      expect(res.status, rol).toBe(400);
    }
  });

  it('no existe ninguna ruta HTTP para convertirse en superadmin', async () => {
    for (const ruta of [
      '/api/superadmin/inicializar',
      '/api/superadmin',
      '/api/admin/superadmin',
    ]) {
      expect((await como(app, cookies.admin).post(ruta, { correo: 'x@x.co' })).status, ruta).toBe(
        404,
      );
    }
  });

  it('la base rechaza un rol desconocido y un superadmin sin correo', async () => {
    await enTransaccionRevertida(async (_enTx, cliente) => {
      await cliente.query('savepoint caso');
      await expect(
        cliente.query(`update app.usuario set rol = 'root' where codigo = 'Admin_001'`),
      ).rejects.toMatchObject({ code: '23514', constraint: 'usuario_rol_check' });
      await cliente.query('rollback to savepoint caso');
      await expect(
        cliente.query(`update app.usuario set rol = 'superadmin' where codigo = 'Admin_001'`),
      ).rejects.toMatchObject({ code: '23514', constraint: 'usuario_superadmin_con_correo' });
    });
  });
});

describe('Último superadmin activo', () => {
  it('la base impide desactivar, degradar o borrar al último superadmin activo', async () => {
    for (const sentencia of [
      `update app.usuario set estado = 'suspendido' where rol = 'superadmin'`,
      `update app.usuario set rol = 'admin_plataforma' where rol = 'superadmin'`,
      `delete from app.usuario where rol = 'superadmin'`,
    ]) {
      await enTransaccionRevertida(async (_enTx, cliente) => {
        await expect(cliente.query(sentencia), sentencia).rejects.toMatchObject({
          code: '23514',
          constraint: 'ultimo_superadmin_activo',
        });
      });
    }
  });

  it('dos degradaciones cruzadas a la vez nunca dejan la plataforma sin superadmin', async () => {
    // Dos superadmins confirmados (dos conexiones los ven) y Superadmin_001 desactivado: quedan
    // exactamente dos activos. Todo por SQL, sin registros de auditoría (que no se pueden borrar),
    // para dejar la base como estaba al final.
    const { rows: nuevas } = await pool.query<{ id: string }>(
      `insert into app.usuario (codigo, alias, rol, correo)
       select 'Cuenta_' || upper(substr(md5(random()::text), 1, 10)), $1 || n, 'superadmin',
              'concurrencia.' || lower($1) || n || '@superadmin.test'
       from generate_series(1, 2) n
       returning id_usuario as id`,
      [`Concurrencia${sufijo()}`],
    );
    const [a, b] = nuevas.map((fila) => fila.id) as [string, string];
    await pool.query(
      `update app.usuario set estado = 'suspendido' where codigo = 'Superadmin_001'`,
    );
    const degradar = (cliente: pg.PoolClient, id: string) =>
      cliente.query(`update app.usuario set rol = 'admin_plataforma' where id_usuario = $1`, [id]);
    const [uno, dos] = [await pool.connect(), await pool.connect()];
    try {
      // Si la primera se revierte, la segunda (que esperaba el candado) sí puede seguir.
      await uno.query('begin');
      await dos.query('begin');
      await degradar(uno, b);
      const segunda = degradar(dos, a).then(
        () => null,
        (error: unknown) => error,
      );
      await new Promise((r) => setTimeout(r, 200));
      await uno.query('rollback');
      expect(await segunda).toBeNull();
      await dos.query('rollback');

      // Si la primera se confirma, la segunda cuenta después del candado y ya no queda nadie.
      await uno.query('begin');
      await dos.query('begin');
      await degradar(uno, b);
      const bloqueada = degradar(dos, a).then(
        () => null,
        (error: unknown) => error,
      );
      await new Promise((r) => setTimeout(r, 200));
      await uno.query('commit');
      expect(await bloqueada).toMatchObject({
        code: '23514',
        constraint: 'ultimo_superadmin_activo',
      });
      await dos.query('rollback');

      const { rows } = await pool.query(
        `select count(*)::int as activos from app.usuario
         where rol = 'superadmin' and estado = 'activo'`,
      );
      expect(rows[0].activos).toBe(1);
    } finally {
      uno.release();
      dos.release();
      await pool.query(`update app.usuario set estado = 'activo' where codigo = 'Superadmin_001'`);
      await pool.query(`delete from app.usuario where id_usuario = any($1::uuid[])`, [[a, b]]);
    }
  });
});

describe('Inicialización del primer superadmin (consola)', () => {
  const inicializar = (cliente: pg.PoolClient, opciones: Record<string, unknown>) =>
    inicializarSuperadmin(poolSobre(cliente), {
      correo: correoNuevo(),
      contrasena: CONTRASENA,
      ...opciones,
    });

  it('regulariza Admin_001 sin perder su id: correo, contraseña, rol y sesiones cerradas', async () => {
    await enTransaccionRevertida(async (enTx, cliente) => {
      const previa = await cookiePorId(cliente, ids.Admin_001!);
      const correo = correoNuevo();
      const resultado = await inicializar(cliente, { correo, alias: 'admindemo' });
      expect(resultado).toMatchObject({
        id: ids.Admin_001,
        nombre: 'AdminDemo',
        correo,
        cuentaNueva: false,
        rolAnterior: 'admin_plataforma',
      });
      expect(resultado.sesionesCerradas).toBeGreaterThanOrEqual(1);
      expect(await quienSoy(enTx, previa)).toBeNull();

      const entrada = await entrarConCorreo(enTx, correo);
      expect(entrada.status).toBe(201);
      expect(entrada.body.usuario).toMatchObject({ alias: 'AdminDemo', rol: 'superadmin' });
      const cookie = soloValor(cookieSesion(entrada)!);
      expect((await como(enTx, cookie).get(RUTA)).status).toBe(200);
      // Ya no entra con nametag.
      expect(
        (
          await request(enTx)
            .post('/api/sesion')
            .send({ alias: 'AdminDemo', contrasena: CONTRASENA })
        ).status,
      ).toBe(401);

      const registros = await auditoriaDe(cliente, ids.Admin_001!);
      expect(registros).toEqual([
        {
          accion: 'inicializar_superadmin',
          actor: null,
          detalle: {
            origen: 'consola',
            cuentaNueva: false,
            rolAnterior: 'admin_plataforma',
            estadoAnterior: 'activo',
            recuperacion: false,
          },
        },
      ]);
      expect(JSON.stringify(registros)).not.toMatch(/faro|scrypt|@/);

      // Ya hay un superadmin que puede entrar: no se inicializa otro sin --recuperacion.
      await expect(inicializar(cliente, { nombre: nombreNuevo() })).rejects.toBeInstanceOf(
        ErrorInicializacion,
      );
      const recuperada = await inicializar(cliente, {
        alias: 'AdminDemo',
        correo,
        contrasena: OTRA_CONTRASENA,
        recuperacion: true,
      });
      expect(recuperada.rolAnterior).toBe('superadmin');
      expect((await entrarConCorreo(enTx, correo, OTRA_CONTRASENA)).status).toBe(201);
    });
  });

  it('crea una cuenta nueva de superadministración con --nombre', async () => {
    await enTransaccionRevertida(async (enTx, cliente) => {
      const nombre = nombreNuevo();
      const correo = correoNuevo();
      const resultado = await inicializar(cliente, { nombre, correo });
      expect(resultado).toMatchObject({ nombre, correo, cuentaNueva: true, rolAnterior: null });
      const entrada = await entrarConCorreo(enTx, correo);
      expect(entrada.body.usuario).toMatchObject({ alias: nombre, rol: 'superadmin' });
      // Admin_001 no cambió.
      const { rows } = await cliente.query(
        `select rol, correo from app.usuario where codigo = 'Admin_001'`,
      );
      expect(rows[0]).toEqual({ rol: 'admin_plataforma', correo: null });
    });
  });

  it('rechaza datos inválidos sin cambiar nada', async () => {
    await enTransaccionRevertida(async (_enTx, cliente) => {
      const casos: Record<string, unknown>[] = [
        { alias: 'AdminDemo', correo: 'no-es-correo' },
        { alias: 'AdminDemo', contrasena: 'corta' },
        { alias: 'AdminDemo', contrasena: 'xx-admindemo-xx' },
        { alias: 'AdminDemo', correo: 'superadmin.demo@prueba.test' },
        { alias: 'NoExiste' },
        { alias: 'LunaDemo' }, // un joven nunca se convierte en superadmin
        { alias: 'AdminDemo', nombre: 'Ambos' },
        { nombre: 'x' },
      ];
      for (const caso of casos) {
        await expect(inicializar(cliente, caso), JSON.stringify(caso)).rejects.toBeInstanceOf(
          ErrorInicializacion,
        );
      }
      const { rows } = await cliente.query(
        `select count(*)::int as total from app.registro_auditoria where accion = 'inicializar_superadmin'`,
      );
      expect(rows[0].total).toBe(0);
      const admin = await cliente.query(
        `select rol, correo from app.usuario where codigo = 'Admin_001'`,
      );
      expect(admin.rows[0]).toEqual({ rol: 'admin_plataforma', correo: null });
    });
  });
});
