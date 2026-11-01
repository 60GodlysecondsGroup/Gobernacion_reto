/**
 * «Iniciar con mi Avatar»: registro, inicio y cierre de sesión, contra la base local de pruebas
 * (npm run test:db). Las cuentas que crea se borran al final; la limpieza de cuentas de prueba se
 * ensaya dentro de una transacción que se revierte.
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { cargarConfig } from '../../src/config/env.js';
import { crearPool, type PoolDeDatos } from '../../src/db/database.js';
import {
  CODIGOS_USUARIOS_PRUEBA,
  eliminarUsuariosPrueba,
  inventariarUsuariosPrueba,
} from '../../src/db/usuarios-prueba.js';
import { crearLogger } from '../../src/lib/logger.js';
import { hashearContrasena } from '../../src/modules/seguridad/contrasena.js';
import { abrirSesionInterna } from '../../src/modules/seguridad/sesion.service.js';
import { crearToken } from '../../src/modules/seguridad/sesion.token.js';
import { crearRepositorioUsuarios } from '../../src/modules/seguridad/usuarios.repository.js';
import { configPrueba } from '../apoyo.js';

const logger = crearLogger('silencioso');
const CONTRASENA = 'luciernaga-azul-27';
const AVATAR = {
  personaje: 'tono-canela',
  cabello: 'cabello-rizado',
  rasgos: 'rasgos-pecas',
  prenda: 'prenda-buzo',
  accesorio: null,
};
// Las pruebas comparten IP (127.0.0.1): límites holgados salvo en la app que los ensaya.
const SIN_LIMITES = {
  fallosPorCuenta: 1000,
  fallosPorIp: 1000,
  registrosPorIp: 1000,
  ventanaMs: 60_000,
};

let pool: PoolDeDatos;
let app: ReturnType<typeof crearApp>;
let idAdmin: string;
const creados = new Set<string>();

let contador = 0;
const aliasNuevo = () => `Prueba${Date.now().toString(36)}${contador++}`;

const cookieSesion = (res: { headers: Record<string, unknown> }) =>
  ((res.headers['set-cookie'] as string[] | undefined) ?? []).find((c) => c.startsWith('sesion='));
const soloValor = (setCookie: string) => setCookie.split(';')[0]!;

function registrar(datos: Record<string, unknown> = {}, aplicacion = app) {
  const alias = (datos.alias as string | undefined) ?? aliasNuevo();
  creados.add(alias.toLowerCase());
  return request(aplicacion)
    .post('/api/sesion/registro')
    .send({
      alias,
      contrasena: CONTRASENA,
      rango: 'C',
      intereses: ['Música', 'música', 'Dibujo'],
      avatar: AVATAR,
      ...datos,
    });
}

/** Registra una cuenta nueva y devuelve su alias y la cookie de su sesión. */
async function cuentaNueva(): Promise<{ alias: string; cookie: string }> {
  const alias = aliasNuevo();
  const res = await registrar({ alias });
  expect(res.status).toBe(201);
  return { alias, cookie: soloValor(cookieSesion(res)!) };
}

const quienSoy = async (cookie: string) =>
  (await request(app).get('/api/sesion').set('Cookie', cookie)).body.usuario;

const contarAlias = async (alias: string) =>
  (
    await pool.query('select count(*)::int as n from app.usuario where lower(alias) = lower($1)', [
      alias,
    ])
  ).rows[0].n as number;

beforeAll(async () => {
  pool = crearPool(cargarConfig().baseDeDatos);
  app = crearApp({ db: pool, logger, config: configPrueba, limitesAcceso: SIN_LIMITES });
  const { rows } = await pool.query(
    `select id_usuario from app.usuario where codigo = 'Admin_001'`,
  );
  idAdmin = rows[0].id_usuario;
});

afterAll(async () => {
  // Solo cuentas registradas aquí (Cuenta_…): nunca las sintéticas, aunque se haya usado su alias.
  await pool.query(
    `delete from app.usuario where codigo like 'Cuenta\\_%' and lower(alias) = any($1::text[])`,
    [[...creados]],
  );
  await pool.query('delete from app.credencial where id_usuario = $1', [idAdmin]);
  await pool.end();
});

describe('Opciones del formulario de registro', () => {
  it('se consultan sin sesión: rangos de edad y catálogo de avatar', async () => {
    const res = await request(app).get('/api/sesion/registro');
    expect(res.status).toBe(200);
    expect(res.body.rangos).toEqual([
      { codigo: 'A', etiqueta: '10–12 años' },
      { codigo: 'B', etiqueta: '13–15 años' },
      { codigo: 'C', etiqueta: '16–17 años' },
      { codigo: 'D', etiqueta: '18–22 años' },
    ]);
    const tipos = new Set(res.body.catalogo.map((e: { tipo: string }) => e.tipo));
    expect(tipos).toEqual(new Set(['personaje', 'cabello', 'rasgo', 'prenda', 'accesorio']));
  });
});

describe('Registro', () => {
  it('crea la cuenta, inicia la sesión y guarda nametag, rango, hobbies y avatar', async () => {
    const alias = aliasNuevo();
    const res = await registrar({ alias });

    expect(res.status).toBe(201);
    const cookie = cookieSesion(res)!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);
    // Sin «Recordarme»: cookie de sesión del navegador (sin Max-Age ni Expires).
    expect(cookie).not.toMatch(/Max-Age|Expires/i);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.usuario).toMatchObject({
      alias,
      rol: 'usuario',
      comunidad: { nombre: 'Comunidad C' },
    });
    expect(res.body.usuario.permisos).not.toContain('gestionar_usuarios');
    // Nunca devuelve la contraseña, su hash ni el token.
    expect(JSON.stringify(res.body)).not.toMatch(/luciernaga|scrypt|token|contrasena/i);

    const { rows } = await pool.query(
      `select u.codigo, u.rol, u.estado, u.rango_edad, u.intereses_generales, c.hash_contrasena
       from app.usuario u join app.credencial c using (id_usuario) where u.alias = $1`,
      [alias],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].codigo).toMatch(/^Cuenta_[0-9A-F]{10}$/);
    expect(rows[0]).toMatchObject({ rol: 'usuario', estado: 'activo', rango_edad: 'C' });
    expect(rows[0].intereses_generales).toEqual(['Música', 'Dibujo']);
    expect(rows[0].hash_contrasena).toMatch(/^scrypt\$131072\$8\$1\$/);
    expect(rows[0].hash_contrasena).not.toContain(CONTRASENA);

    // Al recargar la página, la cookie recupera la sesión, el avatar y los hobbies.
    const valor = soloValor(cookie);
    expect(await quienSoy(valor)).toMatchObject({ alias, rol: 'usuario' });
    const avatar = await request(app).get('/api/avatar').set('Cookie', valor);
    expect(avatar.body.configuracion).toEqual(AVATAR);
    const perfil = await request(app).get('/api/perfil').set('Cookie', valor);
    expect(perfil.body.perfil).toMatchObject({ alias, intereses: ['Música', 'Dibujo'] });
    expect(perfil.body.perfil.avatar).toMatchObject({ personaje: 'tono-canela' });
  });

  it('con «Recordarme» la cookie es persistente', async () => {
    const res = await registrar({ recordar: true });
    expect(res.status).toBe(201);
    expect(cookieSesion(res)).toMatch(/Max-Age=86400/);
  });

  it('rechaza datos inválidos indicando cada campo', async () => {
    const vacio = await request(app).post('/api/sesion/registro').send({});
    expect(vacio.status).toBe(400);
    const campos = vacio.body.error.detalles.map((d: { campo: string }) => d.campo);
    expect(campos).toEqual(expect.arrayContaining(['alias', 'contrasena', 'rango']));

    const casos: [Record<string, unknown>, string][] = [
      [{ alias: 'con espacios' }, 'alias'],
      [{ alias: 'ab' }, 'alias'],
      [{ rango: 'E' }, 'rango'],
      [{ intereses: Array.from({ length: 11 }, (_, i) => `hobby${i}`) }, 'intereses'],
      [{ contrasena: '1234' }, 'contrasena'],
      [{ contrasena: '12345678' }, 'contrasena'],
    ];
    for (const [datos, campo] of casos) {
      const alias = (datos.alias as string) ?? aliasNuevo();
      const res = await registrar({ ...datos, alias });
      expect(res.status, JSON.stringify(datos)).toBe(400);
      expect(res.body.error.detalles.map((d: { campo: string }) => d.campo)).toContain(campo);
      expect(await contarAlias(alias)).toBe(0);
    }
  });

  it('no acepta una contraseña que contenga el nametag', async () => {
    const res = await registrar({ alias: 'Rayito77', contrasena: 'soyrayito77!' });
    expect(res.status).toBe(400);
    expect(res.body.error.detalles).toEqual([
      { campo: 'contrasena', mensaje: 'Tu contraseña no puede contener tu nametag.' },
    ]);
  });

  it('el avatar solo admite elementos del catálogo y del tipo correcto', async () => {
    for (const avatar of [
      { ...AVATAR, personaje: 'https://ejemplo.com/foto.png' },
      { ...AVATAR, prenda: 'cabello-corto' },
      { ...AVATAR, foto: 'x' },
    ]) {
      const res = await registrar({ avatar });
      expect(res.status).toBe(400);
      expect(res.body.error.codigo).toBe('AVATAR_INVALIDO');
    }
    const sinAvatar = await registrar({ avatar: undefined });
    expect(sinAvatar.status).toBe(400);
    expect(sinAvatar.body.error.detalles).toContainEqual({
      campo: 'avatar',
      mensaje: 'Elige tu avatar.',
    });
  });

  it('el nametag y los hobbies pasan por el DLP', async () => {
    const alias = aliasNuevo();
    const res = await registrar({ alias, intereses: ['búscame en instagram'] });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({
      codigo: 'CONTENIDO_BLOQUEADO',
      detalles: { campo: 'intereses' },
    });
    expect(await contarAlias(alias)).toBe(0);
  });

  it('nadie puede asignarse un rol, un estado o un código', async () => {
    for (const extra of [
      { rol: 'admin_plataforma' },
      { estado: 'activo' },
      { codigo: 'Admin_002' },
      { permisos: ['gestionar_usuarios'] },
    ]) {
      const alias = aliasNuevo();
      const res = await registrar({ alias, ...extra });
      expect(res.status).toBe(400);
      expect(await contarAlias(alias)).toBe(0);
    }
  });

  it('el nametag es único sin distinguir mayúsculas', async () => {
    const alias = aliasNuevo();
    expect((await registrar({ alias })).status).toBe(201);

    const repetido = await registrar({ alias: alias.toUpperCase() });
    expect(repetido.status).toBe(409);
    expect(repetido.body.error).toMatchObject({
      codigo: 'ALIAS_EN_USO',
      detalles: { campo: 'alias' },
    });
    expect(cookieSesion(repetido)).toBeUndefined();

    expect((await registrar({ alias: 'lunademo' })).status).toBe(409);
  });

  it('dos registros simultáneos con el mismo nametag: solo uno gana', async () => {
    const alias = aliasNuevo();
    const estados = (await Promise.all([registrar({ alias }), registrar({ alias })])).map(
      (res) => res.status,
    );
    expect(estados.sort()).toEqual([201, 409]);
    expect(await contarAlias(alias)).toBe(1);
  });
});

describe('Inicio de sesión', () => {
  let alias: string;
  beforeAll(async () => {
    ({ alias } = await cuentaNueva());
  });

  it('entra con nametag (sin distinguir mayúsculas) y contraseña', async () => {
    const res = await request(app)
      .post('/api/sesion')
      .send({ alias: alias.toLowerCase(), contrasena: CONTRASENA });
    expect(res.status).toBe(201);
    expect(res.body.usuario).toMatchObject({ alias, comunidad: { nombre: 'Comunidad C' } });
    expect(await quienSoy(soloValor(cookieSesion(res)!))).toMatchObject({ alias });
  });

  it('contraseña incorrecta y nametag inexistente responden exactamente igual', async () => {
    const incorrecta = await request(app)
      .post('/api/sesion')
      .send({ alias, contrasena: 'no-es-la-contrasena' });
    const inexistente = await request(app)
      .post('/api/sesion')
      .send({ alias: 'NadieSeLlamaAsi', contrasena: CONTRASENA });
    for (const res of [incorrecta, inexistente]) {
      expect(res.status).toBe(401);
      expect(res.body.error).toEqual({
        codigo: 'CREDENCIALES_INVALIDAS',
        mensaje: 'El nametag o la contraseña no son correctos.',
      });
      expect(cookieSesion(res)).toBeUndefined();
    }
  });

  it('rechaza campos vacíos o extra', async () => {
    expect((await request(app).post('/api/sesion').send({ alias })).status).toBe(400);
    expect(
      (await request(app).post('/api/sesion').send({ alias, contrasena: CONTRASENA, rol: 'x' }))
        .status,
    ).toBe(400);
  });

  it('entrar otra vez cierra la sesión anterior del mismo navegador', async () => {
    const primera = soloValor(
      cookieSesion(await request(app).post('/api/sesion').send({ alias, contrasena: CONTRASENA }))!,
    );
    const segunda = await request(app)
      .post('/api/sesion')
      .set('Cookie', primera)
      .send({ alias, contrasena: CONTRASENA });
    expect(segunda.status).toBe(201);
    expect(await quienSoy(primera)).toBeNull();
    expect(await quienSoy(soloValor(cookieSesion(segunda)!))).toMatchObject({ alias });
  });

  it('una cuenta suspendida pierde su sesión y no puede volver a entrar', async () => {
    const cuenta = await cuentaNueva();
    await pool.query(`update app.usuario set estado = 'suspendido' where alias = $1`, [
      cuenta.alias,
    ]);
    expect(await quienSoy(cuenta.cookie)).toBeNull();
    const res = await request(app)
      .post('/api/sesion')
      .send({ alias: cuenta.alias, contrasena: CONTRASENA });
    expect(res.status).toBe(403);
    expect(res.body.error.codigo).toBe('CUENTA_NO_ACTIVA');
    expect(cookieSesion(res)).toBeUndefined();
  });
});

describe('Cierre de sesión', () => {
  it('revoca la sesión en el servidor: una copia de la cookie deja de servir', async () => {
    const { alias, cookie } = await cuentaNueva();
    const res = await request(app).delete('/api/sesion').set('Cookie', cookie);
    expect(res.status).toBe(204);
    expect(cookieSesion(res)).toMatch(/^sesion=;/);

    expect(await quienSoy(cookie)).toBeNull();
    expect((await request(app).get('/api/perfil').set('Cookie', cookie)).status).toBe(401);
    const { rows } = await pool.query(
      `select s.fecha_revocacion is not null as revocada
       from app.sesion s join app.usuario u using (id_usuario) where u.alias = $1`,
      [alias],
    );
    expect(rows).toEqual([{ revocada: true }]);
  });

  it('un token bien firmado pero sin sesión en la base no da acceso', async () => {
    const token = crearToken(randomUUID(), configPrueba.sesion.secreto, 60_000);
    expect((await request(app).get('/api/perfil').set('Cookie', `sesion=${token}`)).status).toBe(
      401,
    );
  });

  it('una sesión vencida en la base no da acceso aunque el token siga vigente', async () => {
    const { rows } = await pool.query(
      `select id_usuario from app.usuario where codigo = 'Usuario_001'`,
    );
    const token = await abrirSesionInterna(
      pool,
      configPrueba.sesion.secreto,
      rows[0].id_usuario,
      60_000,
    );
    await pool.query(
      `update app.sesion set fecha_creacion = now() - interval '2 hours',
                             fecha_expiracion = now() - interval '1 hour'
       where id_sesion = (select id_sesion from app.sesion order by fecha_creacion desc limit 1)`,
    );
    expect(await quienSoy(`sesion=${token}`)).toBeNull();
  });
});

describe('Rutas privadas y privilegios', () => {
  it('sin sesión, las rutas privadas responden 401', async () => {
    for (const ruta of ['/api/perfil', '/api/avatar', '/api/comunidad', '/api/admin/resumen']) {
      expect((await request(app).get(ruta)).status, ruta).toBe(401);
    }
  });

  it('una cuenta recién registrada es joven: no entra a moderación ni administración', async () => {
    const { cookie } = await cuentaNueva();
    for (const ruta of ['/api/admin/resumen', '/api/admin/usuarios', '/api/moderacion/reportes']) {
      expect((await request(app).get(ruta).set('Cookie', cookie)).status, ruta).toBe(403);
    }
  });
});

describe('Límite de intentos', () => {
  const limitada = () =>
    crearApp({
      db: pool,
      logger,
      config: configPrueba,
      limitesAcceso: { fallosPorCuenta: 3, fallosPorIp: 100, registrosPorIp: 2, ventanaMs: 60_000 },
    });

  it('tras varios fallos bloquea ese nametag, incluso con la contraseña correcta', async () => {
    const { alias } = await cuentaNueva();
    const aplicacion = limitada();
    for (let i = 0; i < 3; i++) {
      const res = await request(aplicacion)
        .post('/api/sesion')
        .send({ alias, contrasena: 'equivocada-123' });
      expect(res.status).toBe(401);
    }
    const bloqueado = await request(aplicacion)
      .post('/api/sesion')
      .send({ alias, contrasena: CONTRASENA });
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.error.codigo).toBe('DEMASIADOS_INTENTOS');
  });

  it('limita los registros por IP', async () => {
    const aplicacion = limitada();
    expect((await registrar({}, aplicacion)).status).toBe(201);
    expect((await registrar({}, aplicacion)).status).toBe(201);
    expect((await registrar({}, aplicacion)).status).toBe(429);
  });
});

describe('Administración y cuentas de prueba', () => {
  const CONTRASENA_ADMIN = 'clave-admin-solo-pruebas-9';

  it('Admin_001 entra con la contraseña definida por consola', async () => {
    const usuarios = crearRepositorioUsuarios(pool);
    expect(
      await usuarios.guardarContrasena(idAdmin, await hashearContrasena(CONTRASENA_ADMIN)),
    ).toBe('creada');

    const res = await request(app)
      .post('/api/sesion')
      .send({ alias: 'AdminDemo', contrasena: CONTRASENA_ADMIN });
    expect(res.status).toBe(201);
    expect(res.body.usuario).toMatchObject({ rol: 'admin_plataforma', comunidad: null });
    expect(res.body.usuario.permisos).toContain('gestionar_usuarios');
    const cookie = soloValor(cookieSesion(res)!);
    expect((await request(app).get('/api/admin/resumen').set('Cookie', cookie)).status).toBe(200);

    const { rows } = await pool.query(
      `select accion, detalle from app.registro_auditoria
       where entidad = 'usuario' and id_entidad = $1 order by id_registro desc limit 1`,
      [idAdmin],
    );
    expect(rows[0]).toEqual({ accion: 'establecer_contrasena', detalle: { origen: 'consola' } });
    expect(JSON.stringify(rows)).not.toMatch(/scrypt|clave-admin/);

    expect(
      await usuarios.guardarContrasena(idAdmin, await hashearContrasena('otra-clave-77')),
    ).toBe('reemplazada');
  });

  it('las cuentas de prueba no pueden entrar por ninguna vía', async () => {
    expect((await request(app).post('/api/sesion').send({ codigo: 'Usuario_001' })).status).toBe(
      400,
    );
    expect((await request(app).get('/api/sesion/usuarios-demo')).status).toBe(404);
    for (const alias of ['LunaDemo', 'ModeradorDemo', 'GestorDemo']) {
      const res = await request(app).post('/api/sesion').send({ alias, contrasena: CONTRASENA });
      expect(res.status, alias).toBe(401);
    }
  });

  it('la limpieza borra solo las cuentas de prueba y conserva la administración', async () => {
    const cliente = await pool.connect();
    try {
      await cliente.query('begin');
      // Una cuenta con contraseña nunca es «de prueba», aunque su código lo parezca.
      await cliente.query(
        `insert into app.credencial (id_usuario, hash_contrasena)
         select id_usuario, $1 from app.usuario where codigo = 'Usuario_005'`,
        [await hashearContrasena('contrasena-de-mar-5')],
      );
      const antes = await inventariarUsuariosPrueba(cliente);
      expect(antes.candidatas.map((c) => c.codigo).sort()).toEqual(
        CODIGOS_USUARIOS_PRUEBA.filter((codigo) => codigo !== 'Usuario_005').sort(),
      );
      expect(antes.candidatas.every((c) => c.bloqueo === null)).toBe(true);
      expect(antes.administracion.map((c) => c.codigo)).toEqual(['Admin_001']);
      const otras = antes.otrasCuentas;

      const resultado = await eliminarUsuariosPrueba(cliente);
      expect(resultado.cuentas).toBe(6);

      const despues = await inventariarUsuariosPrueba(cliente);
      expect(despues.candidatas).toEqual([]);
      expect(despues.administracion).toEqual([
        expect.objectContaining({ codigo: 'Admin_001', alias: 'AdminDemo', tieneAvatar: true }),
      ]);
      expect(despues.otrasCuentas).toBe(otras);
      const { rows } = await cliente.query(
        `select codigo from app.usuario where codigo = any($1::text[])`,
        [[...CODIGOS_USUARIOS_PRUEBA]],
      );
      expect(rows.map((fila) => fila.codigo)).toEqual(['Usuario_005']);
    } finally {
      await cliente.query('rollback');
      cliente.release();
    }
  });
});
