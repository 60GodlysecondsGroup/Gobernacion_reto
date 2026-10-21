/**
 * Fase 2 · Seguridad base, contra la base real del .env (npm run test:db).
 * Deja la base como estaba: restaura el perfil de LunaDemo, reactiva reglas y borra los
 * eventos DLP que generan las pruebas.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { cargarConfig } from '../../src/config/env.js';
import { crearPool, type PoolDeDatos } from '../../src/db/database.js';
import { leerReglasDlpSemilla } from '../../src/db/migraciones.js';
import { crearLogger } from '../../src/lib/logger.js';
import { MENSAJE_BLOQUEO } from '../../src/modules/dlp/dlp.analizador.js';
import { crearRepositorioDlp } from '../../src/modules/dlp/dlp.repository.js';
import { crearServicioDlp } from '../../src/modules/dlp/dlp.service.js';
import { configPrueba } from '../apoyo.js';

const logger = crearLogger('silencioso');
const UUID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';

let pool: PoolDeDatos;
let app: ReturnType<typeof crearApp>;
let inicio: Date;
let lunaOriginal: { alias: string; intereses: string[]; avatar: string };
const ids: Record<string, string> = {};

beforeAll(async () => {
  pool = crearPool(cargarConfig().baseDeDatos);
  app = crearApp({ db: pool, logger, config: configPrueba, ttlReglasDlpMs: 0 });
  inicio = new Date((await pool.query('select now() as ahora')).rows[0].ahora);

  const usuarios = await pool.query(`select codigo, id_usuario from app.usuario`);
  for (const fila of usuarios.rows) ids[fila.codigo] = fila.id_usuario;
  const comunidades = await pool.query(`select rango_edad, id_comunidad from app.comunidad`);
  for (const fila of comunidades.rows) ids[`comunidad_${fila.rango_edad}`] = fila.id_comunidad;

  const luna = await pool.query(
    `select u.alias, u.intereses_generales as intereses, ca.id_personaje as avatar
     from app.usuario u join app.configuracion_avatar ca using (id_usuario)
     where u.codigo = 'Usuario_001'`,
  );
  lunaOriginal = luna.rows[0];
});

afterAll(async () => {
  await pool.query(
    `update app.usuario set alias = $1, intereses_generales = $2 where codigo = 'Usuario_001'`,
    [lunaOriginal.alias, lunaOriginal.intereses],
  );
  await pool.query(`update app.configuracion_avatar set id_personaje = $1 where id_usuario = $2`, [
    lunaOriginal.avatar,
    ids.Usuario_001,
  ]);
  await pool.query(`update app.regla_dlp set estado = 'activa'`);
  await pool.query(`delete from app.evento_dlp where fecha >= $1`, [inicio]);
  await pool.end();
});

/** Inicia sesión con un usuario sintético y devuelve la cookie. */
async function entrar(codigo: string): Promise<string> {
  const res = await request(app).post('/api/sesion').send({ codigo });
  expect(res.status).toBe(201);
  const cookies = res.headers['set-cookie'] as unknown as string[];
  return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

const como = (cookie: string) => ({
  get: (ruta: string) => request(app).get(ruta).set('Cookie', cookie),
  put: (ruta: string, cuerpo: object) => request(app).put(ruta).set('Cookie', cookie).send(cuerpo),
});

describe('Acceso de demostración', () => {
  it('ofrece al menos un usuario por rango y uno por rol', async () => {
    const res = await request(app).get('/api/sesion/usuarios-demo');
    const usuarios: { rol: string; rango: string | null }[] = res.body.usuarios;

    expect(new Set(usuarios.map((u) => u.rango).filter(Boolean))).toEqual(
      new Set(['10–12 años', '13–15 años', '16–17 años', '18–22 años']),
    );
    expect(new Set(usuarios.map((u) => u.rol))).toEqual(
      new Set(['usuario', 'moderador', 'admin_plataforma', 'gestor_fuentes']),
    );
  });

  it('LunaDemo entra a su comunidad 13–15, con cookie HttpOnly y sin datos de edad', async () => {
    const res = await request(app).post('/api/sesion').send({ codigo: 'Usuario_001' });

    expect(res.status).toBe(201);
    expect(res.headers['set-cookie']?.[0]).toMatch(/HttpOnly/i);
    expect(res.headers['set-cookie']?.[0]).toMatch(/SameSite=Lax/i);
    expect(res.body.usuario).toMatchObject({
      alias: 'LunaDemo',
      rol: 'usuario',
      comunidad: { nombre: 'Comunidad B' },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/edad|nacimiento/i);
  });

  it('rechaza un usuario de prueba inexistente o campos extra', async () => {
    expect((await request(app).post('/api/sesion').send({ codigo: 'Usuario_999' })).status).toBe(
      404,
    );
    const extra = await request(app)
      .post('/api/sesion')
      .send({ codigo: 'Usuario_001', rol: 'admin' });
    expect(extra.status).toBe(400);
  });

  it('cerrar sesión borra la cookie', async () => {
    const res = await request(app)
      .delete('/api/sesion')
      .set('Cookie', await entrar('Usuario_001'));
    expect(res.status).toBe(204);
    expect(res.headers['set-cookie']?.[0]).toMatch(/sesion=;/);
  });
});

describe('TRL-01 · Segmentación por edad', () => {
  let luna: ReturnType<typeof como>;
  beforeAll(async () => {
    luna = como(await entrar('Usuario_001'));
  });

  it('el usuario del rango B solo ve su comunidad', async () => {
    const propia = await luna.get('/api/comunidad');
    expect(propia.body.comunidad).toMatchObject({ nombre: 'Comunidad B', rango: '13–15 años' });

    const lista = await luna.get('/api/comunidades');
    expect(lista.body.comunidades.map((c: { nombre: string }) => c.nombre)).toEqual([
      'Comunidad B',
    ]);
  });

  it('por identificador directo, otra comunidad responde igual que una inexistente', async () => {
    const inexistente = await luna.get(`/api/comunidades/${UUID_INEXISTENTE}`);
    expect(inexistente.status).toBe(404);

    for (const referencia of ['A', 'C', 'D', ids.comunidad_A, ids.comunidad_C, ids.comunidad_D]) {
      const res = await luna.get(`/api/comunidades/${referencia}`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(inexistente.body);
    }

    expect((await luna.get('/api/comunidades/B')).status).toBe(200);
    expect((await luna.get(`/api/comunidades/${ids.comunidad_B}`)).status).toBe(200);
  });

  it('la búsqueda solo encuentra personas del mismo rango', async () => {
    const todos = await luna.get('/api/perfiles?buscar=Demo');
    expect(todos.body.perfiles.map((p: { alias: string }) => p.alias).sort()).toEqual([
      'LunaDemo',
      'SolDemo',
    ]);

    for (const aliasDeOtroRango of ['Rio', 'Nube', 'Mar', 'Moderador']) {
      const res = await luna.get(`/api/perfiles?buscar=${aliasDeOtroRango}`);
      expect(res.body.perfiles).toEqual([]);
    }
  });

  it('el perfil de alguien de otro rango responde igual que uno inexistente', async () => {
    const inexistente = await luna.get(`/api/perfiles/${UUID_INEXISTENTE}`);
    for (const codigo of ['Usuario_003', 'Usuario_004', 'Usuario_005', 'Moderador_001']) {
      const res = await luna.get(`/api/perfiles/${ids[codigo]}`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(inexistente.body);
    }

    const sol = await luna.get(`/api/perfiles/${ids.Usuario_002}`);
    expect(sol.status).toBe(200);
    expect(Object.keys(sol.body.perfil).sort()).toEqual(['alias', 'avatar', 'id', 'intereses']);
  });

  it('el personal sin comunidad asignada no entra a contenido comunitario', async () => {
    const moderador = como(await entrar('Moderador_001'));
    const res = await moderador.get('/api/comunidad');
    expect(res.status).toBe(403);
    expect(res.body.error.codigo).toBe('SIN_COMUNIDAD');
  });
});

describe('Permisos por rol en rutas de moderación', () => {
  it.each([
    ['Usuario_001', 403],
    ['Gestor_001', 403],
    ['Moderador_001', 200],
    ['Admin_001', 200],
  ])('%s → GET /api/moderacion/incidencias-dlp responde %i', async (codigo, estado) => {
    const res = await como(await entrar(codigo)).get('/api/moderacion/incidencias-dlp');
    expect(res.status).toBe(estado);
  });
});

describe('Perfil protegido con DLP', () => {
  let luna: ReturnType<typeof como>;
  beforeAll(async () => {
    luna = como(await entrar('Usuario_001'));
  });

  const perfilValido = { alias: 'LunaDemo', intereses: ['lectura'], avatar: 'base-azul' };

  it('muestra el perfil propio con alias, intereses y avatar, nunca la edad', async () => {
    const res = await luna.get('/api/perfil');
    expect(res.body.perfil.alias).toBe('LunaDemo');
    expect(res.body.opcionesAvatar).toHaveLength(3);
    expect(JSON.stringify(res.body)).not.toMatch(/edad|nacimiento|rango/i);
  });

  it.each([
    ['TRL-04 · teléfono', { intereses: ['Escríbeme al 3000000000'] }, 'intereses'],
    ['TRL-05 · red social', { intereses: ['Búscame en Instagram'] }, 'intereses'],
    ['TRL-06 · dirección', { intereses: ['Calle Ficticia 123'] }, 'intereses'],
    ['teléfono en el alias', { alias: 'Luna3000000000' }, 'alias'],
  ])('bloquea %s con el mensaje estándar y no guarda nada', async (_caso, cambio, campo) => {
    const res = await luna.put('/api/perfil', { ...perfilValido, ...cambio });

    expect(res.status).toBe(422);
    expect(res.body.error).toEqual({
      codigo: 'CONTENIDO_BLOQUEADO',
      mensaje: MENSAJE_BLOQUEO,
      detalles: { campo },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/3000000000|instagram|ficticia/i);

    const actual = await luna.get('/api/perfil');
    expect(actual.body.perfil.alias).toBe('LunaDemo');
    expect(actual.body.perfil.intereses).toEqual(lunaOriginal.intereses);
  });

  it('registra el evento DLP sin guardar el texto bloqueado', async () => {
    const { rows } = await pool.query(
      `select e.tipo_contenido, e.categoria, e.resultado, r.codigo as regla
       from app.evento_dlp e left join app.regla_dlp r using (id_regla)
       where e.id_usuario = $1 and e.fecha >= $2`,
      [ids.Usuario_001, inicio],
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tipo_contenido: 'perfil',
          categoria: 'contacto',
          resultado: 'bloqueado',
        }),
        expect.objectContaining({ categoria: 'redes_externas' }),
        expect.objectContaining({ categoria: 'ubicacion' }),
      ]),
    );

    const columnas = await pool.query(
      `select column_name from information_schema.columns
       where table_schema = 'app' and table_name = 'evento_dlp'`,
    );
    // Solo metadatos: ninguna columna puede guardar el texto del mensaje.
    expect(columnas.rows.map((c) => c.column_name).sort()).toEqual([
      'accion',
      'categoria',
      'fecha',
      'id_evento',
      'id_regla',
      'id_usuario',
      'resultado',
      'tipo_contenido',
    ]);
  });

  it('el moderador ve las incidencias por categoría, sin texto ni autor', async () => {
    const res = await como(await entrar('Moderador_001')).get('/api/moderacion/incidencias-dlp');
    const contacto = res.body.resumen.find(
      (r: { categoria: string }) => r.categoria === 'contacto',
    );
    expect(contacto.total).toBeGreaterThanOrEqual(1);
    expect(res.body.recientes[0]).toEqual({
      fecha: expect.any(String),
      categoria: expect.any(String),
      nombreCategoria: expect.any(String),
      tipoContenido: 'perfil',
      regla: expect.any(String),
      accion: 'bloquear',
      resultado: 'bloqueado',
    });
  });

  it('guarda un perfil válido', async () => {
    const res = await luna.put('/api/perfil', {
      alias: 'LunaDemo',
      intereses: ['lectura', 'música', 'astronomía'],
      avatar: 'base-verde',
    });
    expect(res.status).toBe(200);
    expect(res.body.perfil).toMatchObject({
      intereses: ['lectura', 'música', 'astronomía'],
      avatar: { id: 'base-verde' },
    });
  });

  it('rechaza campos que no son del perfil (no se puede cambiar el rango)', async () => {
    const res = await luna.put('/api/perfil', { ...perfilValido, rango_edad: 'D' });
    expect(res.status).toBe(400);
    expect((await luna.get('/api/comunidad')).body.comunidad.nombre).toBe('Comunidad B');
  });

  it('no permite usar el alias de otra persona', async () => {
    const res = await luna.put('/api/perfil', { ...perfilValido, alias: 'soldemo' });
    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe('ALIAS_EN_USO');
  });

  it('un moderador no puede personalizar su avatar (A.2)', async () => {
    const moderador = como(await entrar('Moderador_001'));
    const { perfil } = (await moderador.get('/api/perfil')).body;
    const otro = perfil.avatar.id === 'base-azul' ? 'base-coral' : 'base-azul';
    const res = await moderador.put('/api/perfil', {
      alias: perfil.alias,
      intereses: [],
      avatar: otro,
    });
    expect(res.status).toBe(403);
  });
});

describe('Reglas DLP en datos (app.regla_dlp)', () => {
  it('la base tiene activas las mismas reglas del seed', async () => {
    const { rows } = await pool.query(`select codigo from app.regla_dlp where estado = 'activa'`);
    const semilla = await leerReglasDlpSemilla();
    expect(rows.map((r) => r.codigo).sort()).toEqual(semilla.map((r) => r.codigo).sort());
  });

  it('desactivar una regla en la base cambia el comportamiento sin tocar código', async () => {
    const dlp = crearServicioDlp({
      repositorio: crearRepositorioDlp(pool, logger),
      logger,
      ttlReglasMs: 0,
    });
    const contexto = { tipoContenido: 'hilo', idUsuario: ids.Usuario_001! } as const;

    expect((await dlp.revisar('3000000000', contexto)).permitido).toBe(false);
    try {
      await pool.query(
        `update app.regla_dlp set estado = 'inactiva' where codigo = 'contacto-telefono'`,
      );
      expect((await dlp.revisar('3000000000', contexto)).permitido).toBe(true);
    } finally {
      await pool.query(
        `update app.regla_dlp set estado = 'activa' where codigo = 'contacto-telefono'`,
      );
    }
  });
});
