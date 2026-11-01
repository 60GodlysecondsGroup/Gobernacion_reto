/**
 * Cuentas de personal (moderación y gestión de fuentes) creadas por la administración, con acceso
 * por correo y contraseña, contra la base local de pruebas (npm run test:db). Las cuentas que crea
 * se borran al final. Los cambios de rol y de estado corren en una transacción que se revierte: el
 * registro de auditoría es de solo inserción y otras pruebas cuentan esas acciones.
 */
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { cargarConfig } from '../../src/config/env.js';
import { crearPool, type PoolDeDatos } from '../../src/db/database.js';
import { crearLogger } from '../../src/lib/logger.js';
import { verificarContrasena } from '../../src/modules/seguridad/contrasena.js';
import { cookieDe, configPrueba } from '../apoyo.js';

const logger = crearLogger('silencioso');
const CONTRASENA = 'faro-del-llano-42';
// Las pruebas comparten IP (127.0.0.1): límites holgados salvo en la app que los ensaya.
const SIN_LIMITES = {
  fallosPorCuenta: 1000,
  fallosPorIp: 1000,
  registrosPorIp: 1000,
  ventanaMs: 60_000,
};

type App = ReturnType<typeof crearApp>;

let pool: PoolDeDatos;
let app: App;
const cookies: Record<string, string> = {};
const ids: Record<string, string> = {};

let contador = 0;
const sufijo = () => `${Date.now().toString(36)}${contador++}`;
/** Correos de esta prueba: el dominio `.test` no existe y permite limpiar al final. */
const correoNuevo = () => `persona.${sufijo()}@personal.test`;
const nombreNuevo = () => `Equipo ${sufijo()}`;

const cookieSesion = (res: { headers: Record<string, unknown> }) =>
  ((res.headers['set-cookie'] as string[] | undefined) ?? []).find((c) => c.startsWith('sesion='));
const soloValor = (setCookie: string) => setCookie.split(';')[0]!;

const comoAdmin = (aplicacion = app) => ({
  get: (ruta: string) => request(aplicacion).get(ruta).set('Cookie', cookies.admin!),
  post: (ruta: string, cuerpo: object) =>
    request(aplicacion).post(ruta).set('Cookie', cookies.admin!).send(cuerpo),
  patch: (ruta: string, cuerpo: object) =>
    request(aplicacion).patch(ruta).set('Cookie', cookies.admin!).send(cuerpo),
});

function crearCuenta(datos: Record<string, unknown> = {}, aplicacion = app) {
  return comoAdmin(aplicacion).post('/api/admin/personal', {
    nombre: nombreNuevo(),
    correo: correoNuevo(),
    contrasena: CONTRASENA,
    confirmacion: CONTRASENA,
    rol: 'moderador',
    ...datos,
  });
}

const entrarConCorreo = (correo: string, contrasena = CONTRASENA, aplicacion = app) =>
  request(aplicacion).post('/api/sesion/personal').send({ correo, contrasena });

/** Crea una cuenta de personal y entra con ella: devuelve su id, correo, nombre y cookie. */
async function personalConSesion(rol: 'moderador' | 'gestor_fuentes', aplicacion = app) {
  const correo = correoNuevo();
  const nombre = nombreNuevo();
  const creada = await crearCuenta({ correo, nombre, rol }, aplicacion);
  expect(creada.status).toBe(201);
  const res = await entrarConCorreo(correo, CONTRASENA, aplicacion);
  expect(res.status).toBe(201);
  return {
    id: creada.body.cuenta.id as string,
    correo,
    nombre,
    cookie: soloValor(cookieSesion(res)!),
  };
}

const quienSoy = async (cookie: string, aplicacion = app) =>
  (await request(aplicacion).get('/api/sesion').set('Cookie', cookie)).body.usuario;

/** Ejecuta la prueba con una app sobre una transacción que se revierte al terminar. */
async function enTransaccionRevertida(prueba: (app: App, cliente: pg.PoolClient) => Promise<void>) {
  const cliente = await pool.connect();
  try {
    await cliente.query('begin');
    await prueba(
      crearApp({ db: cliente, logger, config: configPrueba, limitesAcceso: SIN_LIMITES }),
      cliente,
    );
  } finally {
    await cliente.query('rollback');
    cliente.release();
  }
}

beforeAll(async () => {
  pool = crearPool(cargarConfig().baseDeDatos);
  app = crearApp({ db: pool, logger, config: configPrueba, limitesAcceso: SIN_LIMITES });
  for (const [clave, codigo] of [
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
  await pool.query(
    `delete from app.usuario where codigo like 'Cuenta\\_%' and correo like '%@personal.test'`,
  );
  await pool.end();
});

describe('Creación de cuentas de personal', () => {
  it('la administración crea una cuenta de moderación', async () => {
    const correo = correoNuevo();
    const nombre = nombreNuevo();
    const res = await crearCuenta({ nombre, correo, rol: 'moderador' });

    expect(res.status).toBe(201);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.cuenta).toMatchObject({ nombre, correo, rol: 'moderador', estado: 'activo' });
    // Nunca devuelve la contraseña ni su hash.
    expect(JSON.stringify(res.body)).not.toMatch(/faro-del-llano|scrypt|hash|contrasena/i);

    const { rows } = await pool.query(
      `select u.rol, u.rango_edad, u.codigo, u.estado
       from app.usuario u where u.id_usuario = $1`,
      [res.body.cuenta.id],
    );
    expect(rows[0]).toMatchObject({ rol: 'moderador', rango_edad: null, estado: 'activo' });
    expect(rows[0].codigo).toMatch(/^Cuenta_[0-9A-F]{10}$/);
  });

  it('la administración crea una cuenta de gestión de fuentes', async () => {
    const res = await crearCuenta({ rol: 'gestor_fuentes' });
    expect(res.status).toBe(201);
    expect(res.body.cuenta.rol).toBe('gestor_fuentes');
  });

  it('guarda el correo normalizado (sin espacios y en minúsculas)', async () => {
    const correo = correoNuevo();
    const res = await crearCuenta({ correo: `  ${correo.toUpperCase()} ` });
    expect(res.status).toBe(201);
    expect(res.body.cuenta.correo).toBe(correo);
  });

  it('la contraseña se guarda solo como hash scrypt, nunca en claro', async () => {
    const res = await crearCuenta();
    const { rows } = await pool.query(
      'select hash_contrasena as hash from app.credencial where id_usuario = $1',
      [res.body.cuenta.id],
    );
    const hash = rows[0].hash as string;
    expect(hash).toMatch(/^scrypt\$131072\$8\$1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
    expect(hash).not.toContain(CONTRASENA);
    expect(await verificarContrasena(CONTRASENA, hash)).toBe(true);
    expect(await verificarContrasena('otra-clave-cualquiera', hash)).toBe(false);

    // Ninguna otra columna ni tabla la guarda en claro.
    const fuga = await pool.query(
      `select 1 from app.usuario u where u.id_usuario = $1 and row_to_json(u)::text like $2
       union all
       select 1 from app.registro_auditoria r where r.detalle::text like $2`,
      [res.body.cuenta.id, `%${CONTRASENA}%`],
    );
    expect(fuga.rowCount).toBe(0);
  });

  it('deja constancia en el registro de auditoría, solo con el rol', async () => {
    const correo = correoNuevo();
    const res = await crearCuenta({ correo, rol: 'gestor_fuentes' });
    const { rows } = await pool.query(
      `select accion, detalle, id_usuario_actor as actor from app.registro_auditoria
       where entidad = 'usuario' and id_entidad = $1`,
      [res.body.cuenta.id],
    );
    expect(rows).toEqual([
      {
        accion: 'crear_cuenta_personal',
        detalle: { rolNuevo: 'gestor_fuentes' },
        actor: ids.Admin_001,
      },
    ]);
    expect(JSON.stringify(rows)).not.toContain(correo);
  });

  it('rechaza correos repetidos, también con otras mayúsculas', async () => {
    const correo = correoNuevo();
    expect((await crearCuenta({ correo })).status).toBe(201);
    const repetida = await crearCuenta({ correo: correo.toUpperCase() });
    expect(repetida.status).toBe(409);
    expect(repetida.body.error).toMatchObject({
      codigo: 'CORREO_EN_USO',
      detalles: { campo: 'correo' },
    });
  });

  it('dos altas simultáneas con el mismo correo: solo una gana', async () => {
    const correo = correoNuevo();
    const estados = (await Promise.all([crearCuenta({ correo }), crearCuenta({ correo })]))
      .map((r) => r.status)
      .sort();
    expect(estados).toEqual([201, 409]);
  });

  it('rechaza un nombre que ya usa otra cuenta (también un nametag de joven)', async () => {
    const nombre = nombreNuevo();
    expect((await crearCuenta({ nombre })).status).toBe(201);
    for (const repetido of [nombre.toUpperCase(), 'lunademo']) {
      const res = await crearCuenta({ nombre: repetido });
      expect(res.status, repetido).toBe(409);
      expect(res.body.error).toMatchObject({
        codigo: 'NOMBRE_EN_USO',
        detalles: { campo: 'nombre' },
      });
    }
  });

  it('valida cada campo en el backend', async () => {
    const vacia = await comoAdmin().post('/api/admin/personal', {});
    expect(vacia.status).toBe(400);
    const campos = vacia.body.error.detalles.map((d: { campo: string }) => d.campo);
    expect(campos).toEqual(
      expect.arrayContaining(['nombre', 'correo', 'contrasena', 'confirmacion', 'rol']),
    );

    const casos: [Record<string, unknown>, string][] = [
      [{ correo: 'sin-arroba' }, 'correo'],
      [{ correo: 'a@b' }, 'correo'],
      [{ nombre: 'ab' }, 'nombre'],
      [{ nombre: 'Ana  Gómez' }, 'nombre'],
      [{ nombre: 'ana@correo.co' }, 'nombre'],
      [{ contrasena: 'corta', confirmacion: 'corta' }, 'contrasena'],
      [{ contrasena: '12345678', confirmacion: '12345678' }, 'contrasena'],
      [{ confirmacion: 'otra-cosa-distinta' }, 'confirmacion'],
    ];
    for (const [datos, campo] of casos) {
      const res = await crearCuenta(datos);
      expect(res.status, JSON.stringify(datos)).toBe(400);
      expect(res.body.error.detalles.map((d: { campo: string }) => d.campo)).toContain(campo);
    }

    const nombre = nombreNuevo();
    const conNombre = await crearCuenta({
      nombre,
      contrasena: `${nombre}-x`,
      confirmacion: `${nombre}-x`,
    });
    expect(conNombre.status).toBe(400);
    expect(conNombre.body.error.detalles).toEqual([
      { campo: 'contrasena', mensaje: 'La contraseña no puede contener el nombre de la cuenta.' },
    ]);
  });

  it('solo asigna roles de personal y no acepta otros campos', async () => {
    for (const rol of ['admin_plataforma', 'usuario', 'superadmin']) {
      const res = await crearCuenta({ rol });
      expect(res.status, rol).toBe(400);
    }
    for (const extra of [{ estado: 'activo' }, { codigo: 'Admin_002' }, { rango: 'B' }]) {
      expect((await crearCuenta(extra)).status, JSON.stringify(extra)).toBe(400);
    }
    const { rows } = await pool.query(
      `select count(*)::int as n from app.usuario
       where rol = 'admin_plataforma' and correo like '%@personal.test'`,
    );
    expect(rows[0].n).toBe(0);
  });

  it('nadie sin el permiso puede crear, listar ni cambiar cuentas de personal', async () => {
    const objetivo = (await crearCuenta()).body.cuenta.id as string;
    const nuevo = await personalConSesion('moderador');
    const sinPermiso: [string, string | undefined][] = [
      ['sin sesión', undefined],
      ['joven', cookies.joven],
      ['moderación', cookies.moderador],
      ['gestión de fuentes', cookies.gestor],
      ['moderación creada aquí', nuevo.cookie],
    ];
    for (const [quien, cookie] of sinPermiso) {
      const esperado = cookie ? 403 : 401;
      const conCookie = <T extends request.Test>(r: T) => (cookie ? r.set('Cookie', cookie) : r);
      const alta = await conCookie(request(app).post('/api/admin/personal')).send({
        nombre: nombreNuevo(),
        correo: correoNuevo(),
        contrasena: CONTRASENA,
        confirmacion: CONTRASENA,
        rol: 'moderador',
      });
      expect(alta.status, `${quien}: crear`).toBe(esperado);
      expect((await conCookie(request(app).get('/api/admin/personal'))).status, quien).toBe(
        esperado,
      );
      const cambio = await conCookie(request(app).patch(`/api/admin/personal/${objetivo}`)).send({
        rol: 'gestor_fuentes',
      });
      expect(cambio.status, `${quien}: cambiar rol`).toBe(esperado);
    }
  });
});

describe('Acceso del personal con correo y contraseña', () => {
  it('entra con correo (sin distinguir mayúsculas) y contraseña, en una cookie HttpOnly', async () => {
    const correo = correoNuevo();
    const nombre = nombreNuevo();
    await crearCuenta({ correo, nombre, rol: 'moderador' });

    const res = await request(app)
      .post('/api/sesion/personal')
      .send({ correo: ` ${correo.toUpperCase()}`, contrasena: CONTRASENA });
    expect(res.status).toBe(201);
    const cookie = cookieSesion(res)!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.usuario).toMatchObject({ alias: nombre, rol: 'moderador', comunidad: null });
    expect(res.body.usuario.permisos).toContain('revisar_reportes');
    expect(res.body.usuario.permisos).not.toContain('gestionar_personal');
    expect(JSON.stringify(res.body)).not.toMatch(/faro-del-llano|scrypt|token|correo/i);
    expect(await quienSoy(soloValor(cookie))).toMatchObject({ rol: 'moderador' });
  });

  it('contraseña incorrecta y correo inexistente responden exactamente igual', async () => {
    const correo = correoNuevo();
    await crearCuenta({ correo });
    const mala = await entrarConCorreo(correo, 'no-es-la-clave-1');
    const inexistente = await entrarConCorreo(correoNuevo());
    for (const res of [mala, inexistente]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          codigo: 'CREDENCIALES_INVALIDAS',
          mensaje: 'El correo o la contraseña no son correctos.',
        },
      });
      expect(cookieSesion(res)).toBeUndefined();
    }
  });

  it('rechaza campos vacíos o extra', async () => {
    expect((await request(app).post('/api/sesion/personal').send({})).status).toBe(400);
    const extra = await request(app)
      .post('/api/sesion/personal')
      .send({ correo: correoNuevo(), contrasena: CONTRASENA, rol: 'admin_plataforma' });
    expect(extra.status).toBe(400);
  });

  it('el personal no puede entrar por «Iniciar con mi Avatar» con su nombre', async () => {
    const { nombre } = await personalConSesion('gestor_fuentes');
    const res = await request(app)
      .post('/api/sesion')
      .send({ alias: nombre, contrasena: CONTRASENA });
    expect(res.status).toBe(401);
    expect(res.body.error.codigo).toBe('CREDENCIALES_INVALIDAS');
    expect(cookieSesion(res)).toBeUndefined();
  });

  it('las cuentas de jóvenes no tienen correo ni entran por el acceso del personal', async () => {
    const res = await entrarConCorreo('lunademo');
    expect(res.status).toBe(401);
    await expect(
      pool.query(
        `update app.usuario set correo = 'luna@personal.test' where codigo = 'Usuario_001'`,
      ),
    ).rejects.toMatchObject({ code: '23514', constraint: 'usuario_correo_solo_personal' });
  });

  it('el flujo de jóvenes sigue funcionando: registro y entrada con nametag', async () => {
    const alias = `Joven${sufijo()}`;
    const registro = await request(app)
      .post('/api/sesion/registro')
      .send({
        alias,
        contrasena: CONTRASENA,
        rango: 'B',
        intereses: [],
        avatar: {
          personaje: 'tono-miel',
          cabello: 'cabello-corto',
          rasgos: 'rasgos-sonrisa',
          prenda: 'prenda-camiseta',
          accesorio: null,
        },
      });
    try {
      expect(registro.status).toBe(201);
      const entrada = await request(app)
        .post('/api/sesion')
        .send({ alias, contrasena: CONTRASENA });
      expect(entrada.status).toBe(201);
      expect(entrada.body.usuario).toMatchObject({
        rol: 'usuario',
        comunidad: { nombre: 'Comunidad B' },
      });
      // Un joven no tiene acceso por correo: su nametag no sirve como correo.
      expect((await entrarConCorreo(alias)).status).toBe(401);
    } finally {
      await pool.query(`delete from app.usuario where codigo like 'Cuenta\\_%' and alias = $1`, [
        alias,
      ]);
    }
  });

  it('tras varios fallos bloquea ese correo, incluso con la contraseña correcta', async () => {
    const limitada = crearApp({
      db: pool,
      logger,
      config: configPrueba,
      limitesAcceso: { ...SIN_LIMITES, fallosPorCuenta: 3 },
    });
    const correo = correoNuevo();
    await crearCuenta({ correo });
    for (let i = 0; i < 3; i++) {
      expect((await entrarConCorreo(correo, 'clave-equivocada', limitada)).status).toBe(401);
    }
    const bloqueada = await entrarConCorreo(correo, CONTRASENA, limitada);
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.body.error.codigo).toBe('DEMASIADOS_INTENTOS');
  });
});

describe('Cada rol accede solo a lo suyo', () => {
  /** Rutas exclusivas de la administración: ningún rol de personal debe pasar. */
  const SOLO_ADMIN: [string, string, object?][] = [
    ['get', '/api/admin/personal'],
    ['get', '/api/admin/comunidades'],
    ['get', '/api/admin/categorias'],
    ['get', '/api/admin/salas'],
    ['post', '/api/admin/salas', { comunidad: 'B', categoria: 'vida-academica' }],
    ['patch', '/api/admin/reglas-dlp/categorias/contacto', { estado: 'inactiva' }],
    ['post', '/api/admin/asistente', { mensaje: 'hola' }],
  ];

  async function estado(cookie: string, [metodo, ruta, cuerpo]: [string, string, object?]) {
    const r = request(app)[metodo as 'get' | 'post' | 'patch'](ruta).set('Cookie', cookie);
    return (await (cuerpo ? r.send(cuerpo) : r)).status;
  }

  it('moderación: reportes e incidencias sí; fuentes y administración no', async () => {
    const { cookie } = await personalConSesion('moderador');
    expect(await estado(cookie, ['get', '/api/moderacion/reportes'])).toBe(200);
    expect(await estado(cookie, ['get', '/api/moderacion/incidencias-dlp'])).toBe(200);
    expect(await estado(cookie, ['get', '/api/admin/resumen'])).toBe(200);
    expect(await estado(cookie, ['get', '/api/gestion/fuentes'])).toBe(403);
    expect(await estado(cookie, ['post', '/api/comunidad/hilos', { titulo: 'x' }])).toBe(403);
    for (const ruta of SOLO_ADMIN) expect(await estado(cookie, ruta), ruta[1]).toBe(403);
  });

  it('gestión de fuentes: fuentes sí; moderación y administración no', async () => {
    const { cookie } = await personalConSesion('gestor_fuentes');
    expect(await estado(cookie, ['get', '/api/gestion/fuentes'])).toBe(200);
    for (const ruta of [
      '/api/moderacion/reportes',
      '/api/moderacion/incidencias-dlp',
      '/api/admin/resumen',
      '/api/admin/usuarios',
      '/api/salas',
      '/api/comunidad',
    ]) {
      expect(await estado(cookie, ['get', ruta]), ruta).toBe(403);
    }
    for (const ruta of SOLO_ADMIN) expect(await estado(cookie, ruta), ruta[1]).toBe(403);
  });

  it('la moderación no puede suspender a la administración, a otro personal ni a sí misma', async () => {
    const yo = await personalConSesion('moderador');
    const otro = (await crearCuenta({ rol: 'gestor_fuentes' })).body.cuenta.id as string;
    for (const id of [ids.Admin_001!, otro, yo.id]) {
      const res = await request(app)
        .patch(`/api/admin/usuarios/${id}`)
        .set('Cookie', yo.cookie)
        .send({ estado: 'suspendido' });
      expect(res.status).toBe(403);
    }
    const { rows } = await pool.query(
      'select estado from app.usuario where id_usuario = any($1::uuid[])',
      [[ids.Admin_001, otro, yo.id]],
    );
    expect(rows.every((r) => r.estado === 'activo')).toBe(true);
  });
});

describe('Gestión administrativa del personal', () => {
  it('lista solo cuentas de personal, con nombre, correo, rol y estado', async () => {
    const correo = correoNuevo();
    const creada = (await crearCuenta({ correo, rol: 'gestor_fuentes' })).body.cuenta;
    const res = await comoAdmin().get('/api/admin/personal');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.cuentas).toContainEqual({
      id: creada.id,
      nombre: creada.nombre,
      correo,
      rol: 'gestor_fuentes',
      estado: 'activo',
      fechaRegistro: creada.fechaRegistro,
    });
    const roles = new Set(res.body.cuentas.map((c: { rol: string }) => c.rol));
    expect([...roles].every((rol) => rol === 'moderador' || rol === 'gestor_fuentes')).toBe(true);
    // Las cuentas sintéticas antiguas aparecen sin correo (no pueden entrar).
    expect(res.body.cuentas).toContainEqual(
      expect.objectContaining({ id: ids.Moderador_001, correo: null }),
    );
    expect(JSON.stringify(res.body)).not.toMatch(/scrypt|hash/i);
  });

  it('cambia el rol y rige de inmediato en la sesión abierta', async () => {
    await enTransaccionRevertida(async (enTx, cliente) => {
      const persona = await personalConSesion('moderador', enTx);
      expect(await quienSoy(persona.cookie, enTx)).toMatchObject({ rol: 'moderador' });

      const res = await comoAdmin(enTx).patch(`/api/admin/personal/${persona.id}`, {
        rol: 'gestor_fuentes',
      });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ rol: 'gestor_fuentes', cambio: true });

      const ahora = await quienSoy(persona.cookie, enTx);
      expect(ahora.rol).toBe('gestor_fuentes');
      expect(ahora.permisos).toContain('gestionar_fuentes');
      const reportes = await request(enTx)
        .get('/api/moderacion/reportes')
        .set('Cookie', persona.cookie);
      expect(reportes.status).toBe(403);

      const registros = async () =>
        (
          await cliente.query(
            `select accion, detalle from app.registro_auditoria
             where entidad = 'usuario' and id_entidad = $1 and accion = 'cambiar_rol_usuario'`,
            [persona.id],
          )
        ).rows;
      expect(await registros()).toEqual([
        {
          accion: 'cambiar_rol_usuario',
          detalle: { rolAnterior: 'moderador', rolNuevo: 'gestor_fuentes' },
        },
      ]);

      // Repetir el mismo rol no cambia nada ni deja otro registro.
      const igual = await comoAdmin(enTx).patch(`/api/admin/personal/${persona.id}`, {
        rol: 'gestor_fuentes',
      });
      expect(igual.body).toEqual({ rol: 'gestor_fuentes', cambio: false });
      expect(await registros()).toHaveLength(1);
    });
  });

  it('no permite asignar administración ni tocar cuentas que no son de personal', async () => {
    const persona = (await crearCuenta()).body.cuenta.id as string;
    for (const rol of ['admin_plataforma', 'usuario']) {
      const res = await comoAdmin().patch(`/api/admin/personal/${persona}`, { rol });
      expect(res.status, rol).toBe(400);
    }
    expect(
      (
        await comoAdmin().patch(`/api/admin/personal/${persona}`, {
          rol: 'moderador',
          estado: 'activo',
        })
      ).status,
    ).toBe(400);
    // Un joven o la administración no existen para esta ruta.
    for (const id of [ids.Usuario_001!, ids.Admin_001!, 'no-es-un-uuid']) {
      const res = await comoAdmin().patch(`/api/admin/personal/${id}`, { rol: 'moderador' });
      expect(res.status, id).toBe(404);
    }
    const { rows } = await pool.query(
      `select codigo, rol from app.usuario where codigo in ('Usuario_001', 'Admin_001') order by codigo`,
    );
    expect(rows).toEqual([
      { codigo: 'Admin_001', rol: 'admin_plataforma' },
      { codigo: 'Usuario_001', rol: 'usuario' },
    ]);
  });

  it('desactivar quita el acceso de inmediato; al reactivar hay que entrar de nuevo', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const persona = await personalConSesion('moderador', enTx);

      const desactivar = await comoAdmin(enTx).patch(`/api/admin/usuarios/${persona.id}`, {
        estado: 'suspendido',
      });
      expect(desactivar.status).toBe(200);
      expect(await quienSoy(persona.cookie, enTx)).toBeNull();
      const bloqueada = await entrarConCorreo(persona.correo, CONTRASENA, enTx);
      expect(bloqueada.status).toBe(403);
      expect(bloqueada.body.error.codigo).toBe('CUENTA_NO_ACTIVA');
      expect(cookieSesion(bloqueada)).toBeUndefined();

      const reactivar = await comoAdmin(enTx).patch(`/api/admin/usuarios/${persona.id}`, {
        estado: 'activo',
      });
      expect(reactivar.status).toBe(200);
      // Las sesiones se revocaron al desactivar: la cookie anterior ya no sirve.
      expect(await quienSoy(persona.cookie, enTx)).toBeNull();
      const otraVez = await entrarConCorreo(persona.correo, CONTRASENA, enTx);
      expect(otraVez.status).toBe(201);
      expect(await quienSoy(soloValor(cookieSesion(otraVez)!), enTx)).toMatchObject({
        rol: 'moderador',
      });
    });
  });
});
