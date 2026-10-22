/**
 * Fase 7 · Moderación y administración, contra la base del .env.
 * Todo lo que escribe corre en una transacción que se revierte al final: la base queda igual.
 */
import request from 'supertest';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { cargarConfig } from '../../src/config/env.js';
import { crearPool, type PoolDeDatos } from '../../src/db/database.js';
import { crearLogger } from '../../src/lib/logger.js';
import { MENSAJE_BLOQUEO } from '../../src/modules/dlp/dlp.analizador.js';
import { configPrueba } from '../apoyo.js';

const logger = crearLogger('silencioso');
type App = ReturnType<typeof crearApp>;

let pool: PoolDeDatos;
let app: App;
const ids: Record<string, string> = {};

const HILO_LUNA = 'Me cuesta adaptarme a los cambios de este año';

beforeAll(async () => {
  pool = crearPool(cargarConfig().baseDeDatos);
  app = crearApp({ db: pool, logger, config: configPrueba, ttlReglasDlpMs: 0 });
  for (const fila of (await pool.query(`select titulo, id_hilo from app.hilo`)).rows) {
    ids[fila.titulo] = fila.id_hilo;
  }
  for (const fila of (await pool.query(`select codigo, id_usuario from app.usuario`)).rows) {
    ids[fila.codigo] = fila.id_usuario;
  }
});

afterAll(async () => {
  await pool.end();
});

async function enTransaccionRevertida(prueba: (app: App, cliente: pg.PoolClient) => Promise<void>) {
  const cliente = await pool.connect();
  try {
    await cliente.query('begin');
    await prueba(
      crearApp({ db: cliente, logger, config: configPrueba, ttlReglasDlpMs: 0 }),
      cliente,
    );
  } finally {
    await cliente.query('rollback');
    cliente.release();
  }
}

async function entrar(aplicacion: App, codigo: string) {
  const res = await request(aplicacion).post('/api/sesion').send({ codigo });
  expect(res.status).toBe(201);
  const cookie = (res.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
  return {
    get: (ruta: string) => request(aplicacion).get(ruta).set('Cookie', cookie),
    post: (ruta: string, cuerpo: object = {}) =>
      request(aplicacion).post(ruta).set('Cookie', cookie).send(cuerpo),
    patch: (ruta: string, cuerpo: object = {}) =>
      request(aplicacion).patch(ruta).set('Cookie', cookie).send(cuerpo),
    put: (ruta: string, cuerpo: object = {}) =>
      request(aplicacion).put(ruta).set('Cookie', cookie).send(cuerpo),
  };
}

const auditoria = async (cliente: pg.PoolClient, accion: string) =>
  (
    await cliente.query(
      `select r.accion, r.entidad, r.id_entidad, r.detalle, u.codigo as actor
       from app.registro_auditoria r join app.usuario u on u.id_usuario = r.id_usuario_actor
       where r.accion = $1 order by r.fecha, r.id_registro`,
      [accion],
    )
  ).rows;

describe('TRL-11 · reporte de contenido y revisión del moderador', () => {
  it('el reporte llega al panel con motivo, fecha y contenido, y el moderador cambia su estado', async () => {
    await enTransaccionRevertida(async (enTx, cliente) => {
      // 1. LunaDemo (comunidad B) reporta un hilo ficticio de SolDemo.
      const luna = await entrar(enTx, 'Usuario_001');
      const sol = await entrar(enTx, 'Usuario_002');
      const creado = await sol.post('/api/comunidad/hilos', {
        categoria: 'bienestar-cotidiano',
        titulo: 'Hilo ficticio para TRL-11',
        contenido: 'Texto sintético que alguien considera inapropiado.',
      });
      expect(creado.status).toBe(201);
      const idHilo = creado.body.hilo.id;
      const reporte = await luna.post('/api/reportes', {
        tipoContenido: 'hilo',
        idContenido: idHilo,
        categoria: 'contenido_inapropiado',
        descripcion: 'Prueba TRL-11 con datos sintéticos.',
      });
      expect(reporte.body).toEqual({ mensaje: 'Tu reporte fue registrado.' });

      // 2. El moderador lo ve en el panel, entre los pendientes.
      const moderador = await entrar(enTx, 'Moderador_001');
      const lista = await moderador.get('/api/moderacion/reportes?estado=pendiente');
      expect(lista.status).toBe(200);
      const fila = lista.body.reportes.find(
        (r: { tipoContenido: string; motivo: string }) =>
          r.tipoContenido === 'hilo' && r.motivo === 'contenido_inapropiado',
      );
      expect(fila).toMatchObject({ estado: 'pendiente', comunidad: 'Comunidad B' });
      expect(lista.body.conteo.pendiente).toBeGreaterThanOrEqual(1);

      // 3. El detalle trae motivo, fecha y contenido asociado; nunca quién reportó.
      const detalle = await moderador.get(`/api/moderacion/reportes/${fila.id}`);
      expect(detalle.body.reporte).toMatchObject({
        motivo: 'contenido_inapropiado',
        descripcion: 'Prueba TRL-11 con datos sintéticos.',
        contenido: {
          tipo: 'hilo',
          titulo: 'Hilo ficticio para TRL-11',
          autor: { alias: 'SolDemo', estado: 'activo' },
        },
      });
      expect(detalle.body.reporte.fecha).toBeTruthy();
      expect(JSON.stringify(detalle.body)).not.toContain('LunaDemo');
      expect(JSON.stringify(detalle.body)).not.toContain(ids.Usuario_001);

      // 4. Cambia su estado: En revisión → Resuelto.
      const enRevision = await moderador.patch(`/api/moderacion/reportes/${fila.id}`, {
        estado: 'en_revision',
      });
      expect(enRevision.body.reporte.estado).toBe('en_revision');
      const resuelto = await moderador.patch(`/api/moderacion/reportes/${fila.id}`, {
        estado: 'resuelto',
      });
      expect(resuelto.body.reporte).toMatchObject({
        estado: 'resuelto',
        resolucion: 'sin_accion',
        revisor: 'ModeradorDemo',
      });
      expect(resuelto.body.reporte.fechaRevision).toBeTruthy();

      // 5. Cada cambio de estado quedó registrado (quién, qué y cuándo).
      const registros = await auditoria(cliente, 'cambiar_estado_reporte');
      expect(registros.slice(-2)).toEqual([
        expect.objectContaining({
          actor: 'Moderador_001',
          entidad: 'reporte',
          id_entidad: fila.id,
          detalle: { estadoAnterior: 'pendiente', estadoNuevo: 'en_revision' },
        }),
        expect.objectContaining({
          detalle: {
            estadoAnterior: 'en_revision',
            estadoNuevo: 'resuelto',
            resolucion: 'sin_accion',
          },
        }),
      ]);
    });
  });

  it('rechaza transiciones no permitidas y estados inexistentes', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const moderador = await entrar(enTx, 'Moderador_001');
      const { reportes } = (await moderador.get('/api/moderacion/reportes')).body;
      const id = reportes[0].id;
      await moderador.patch(`/api/moderacion/reportes/${id}`, { estado: 'descartado' });
      const invalida = await moderador.patch(`/api/moderacion/reportes/${id}`, {
        estado: 'resuelto',
      });
      expect(invalida.status).toBe(409);
      expect(invalida.body.error.codigo).toBe('TRANSICION_INVALIDA');
      expect(
        (await moderador.patch(`/api/moderacion/reportes/${id}`, { estado: 'archivado' })).status,
      ).toBe(400);
      // Reabrir un reporte cerrado sí está permitido.
      expect(
        (await moderador.patch(`/api/moderacion/reportes/${id}`, { estado: 'en_revision' })).body
          .reporte.estado,
      ).toBe('en_revision');
    });
  });
});

describe('Acciones administrativas sobre el contenido', () => {
  it('un contenido oculto por el moderador deja de mostrarse en la comunidad', async () => {
    await enTransaccionRevertida(async (enTx, cliente) => {
      const moderador = await entrar(enTx, 'Moderador_001');
      const luna = await entrar(enTx, 'Usuario_001');
      const { reportes } = (await moderador.get('/api/moderacion/reportes?estado=pendiente')).body;
      const deRespuesta = reportes.find(
        (r: { tipoContenido: string }) => r.tipoContenido === 'respuesta',
      );
      const textoAcoso = 'Tus preguntas siempre son aburridas';

      const antes = await luna.get(`/api/comunidad/hilos/${ids[HILO_LUNA]}`);
      expect(JSON.stringify(antes.body.respuestas)).toContain(textoAcoso);

      const oculto = await moderador.post(`/api/moderacion/reportes/${deRespuesta.id}/acciones`, {
        accion: 'ocultar_contenido',
      });
      expect(oculto.status).toBe(200);
      expect(oculto.body.reporte).toMatchObject({
        estado: 'en_revision',
        resolucion: 'contenido_oculto',
        contenido: { tipo: 'respuesta', estado: 'oculta' },
      });

      const despues = await luna.get(`/api/comunidad/hilos/${ids[HILO_LUNA]}`);
      expect(JSON.stringify(despues.body.respuestas)).not.toContain(textoAcoso);
      expect(await auditoria(cliente, 'ocultar_contenido')).toEqual([
        expect.objectContaining({ actor: 'Moderador_001', entidad: 'respuesta' }),
      ]);

      // Restaurar lo devuelve a la comunidad.
      await moderador.post(`/api/moderacion/reportes/${deRespuesta.id}/acciones`, {
        accion: 'restaurar_contenido',
      });
      const restaurado = await luna.get(`/api/comunidad/hilos/${ids[HILO_LUNA]}`);
      expect(JSON.stringify(restaurado.body.respuestas)).toContain(textoAcoso);
    });
  });

  it('ocultar un hilo lo saca del listado y su URL responde 404', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const luna = await entrar(enTx, 'Usuario_001');
      const sol = await entrar(enTx, 'Usuario_002');
      await sol.post('/api/reportes', {
        tipoContenido: 'hilo',
        idContenido: ids[HILO_LUNA],
        categoria: 'otro',
      });
      const moderador = await entrar(enTx, 'Moderador_001');
      const { reportes } = (await moderador.get('/api/moderacion/reportes?estado=pendiente')).body;
      const deHilo = reportes.find((r: { tipoContenido: string }) => r.tipoContenido === 'hilo');
      await moderador.post(`/api/moderacion/reportes/${deHilo.id}/acciones`, {
        accion: 'ocultar_contenido',
      });

      expect((await luna.get(`/api/comunidad/hilos/${ids[HILO_LUNA]}`)).status).toBe(404);
      const titulos = (await luna.get('/api/comunidad/hilos')).body.hilos.map(
        (h: { titulo: string }) => h.titulo,
      );
      expect(titulos).not.toContain(HILO_LUNA);
    });
  });

  it('suspender a la persona autora le quita la sesión de inmediato y queda registrado', async () => {
    await enTransaccionRevertida(async (enTx, cliente) => {
      const sol = await entrar(enTx, 'Usuario_002');
      expect((await sol.get('/api/sesion')).body.usuario.alias).toBe('SolDemo');

      const moderador = await entrar(enTx, 'Moderador_001');
      const { reportes } = (await moderador.get('/api/moderacion/reportes?estado=pendiente')).body;
      const deRespuesta = reportes.find(
        (r: { tipoContenido: string }) => r.tipoContenido === 'respuesta',
      );
      const res = await moderador.post(`/api/moderacion/reportes/${deRespuesta.id}/acciones`, {
        accion: 'suspender_autor',
      });
      expect(res.body.reporte).toMatchObject({
        resolucion: 'usuario_suspendido',
        contenido: { autor: { alias: 'SolDemo', estado: 'suspendido' } },
      });
      expect((await sol.get('/api/sesion')).body.usuario).toBeNull();
      expect((await sol.get('/api/comunidad/hilos')).status).toBe(401);
      expect(await auditoria(cliente, 'cambiar_estado_usuario')).toEqual([
        expect.objectContaining({
          actor: 'Moderador_001',
          id_entidad: ids.Usuario_002,
          detalle: expect.objectContaining({ estadoAnterior: 'activo', estadoNuevo: 'suspendido' }),
        }),
      ]);
    });
  });

  it('la moderación no aplica medidas sobre personal ni sobre sí misma', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const moderador = await entrar(enTx, 'Moderador_001');
      expect(
        (await moderador.patch(`/api/admin/usuarios/${ids.Admin_001}`, { estado: 'suspendido' }))
          .status,
      ).toBe(403);
      expect(
        (
          await moderador.patch(`/api/admin/usuarios/${ids.Moderador_001}`, {
            estado: 'suspendido',
          })
        ).status,
      ).toBe(403);
      expect(
        (await moderador.patch(`/api/admin/usuarios/${ids.Usuario_005}`, { estado: 'suspendido' }))
          .body,
      ).toEqual({ estado: 'suspendido', cambio: true });
    });
  });
});

describe('Permisos del panel (verificados en el backend)', () => {
  const rutas = [
    ['get', '/api/moderacion/reportes'],
    ['get', '/api/moderacion/incidencias-dlp'],
    ['get', '/api/admin/resumen'],
    ['get', '/api/admin/usuarios'],
    ['get', '/api/admin/salas'],
    ['get', '/api/admin/reglas-dlp'],
    ['get', '/api/admin/auditoria'],
    ['patch', '/api/admin/reglas-dlp/00000000-0000-4000-8000-000000000000'],
  ] as const;

  it('sin sesión: 401 en todas las rutas del panel', async () => {
    for (const [metodo, ruta] of rutas) {
      expect((await request(app)[metodo](ruta)).status, ruta).toBe(401);
    }
  });

  it('un usuario común no accede al panel ni a sus rutas de API (403)', async () => {
    const luna = await entrar(app, 'Usuario_001');
    for (const [metodo, ruta] of rutas) {
      const res = metodo === 'get' ? await luna.get(ruta) : await luna.patch(ruta);
      expect(res.status, ruta).toBe(403);
    }
  });

  it('el gestor de fuentes no revisa reportes ni administra usuarios', async () => {
    const gestor = await entrar(app, 'Gestor_001');
    expect((await gestor.get('/api/moderacion/reportes')).status).toBe(403);
    expect((await gestor.get('/api/admin/usuarios')).status).toBe(403);
  });

  it('un moderador no modifica fuentes institucionales, reglas DLP, salas ni comunidades', async () => {
    const moderador = await entrar(app, 'Moderador_001');
    const regla = (await pool.query(`select id_regla from app.regla_dlp limit 1`)).rows[0].id_regla;
    const fuente = (await pool.query(`select id_fuente from app.fuente_institucional limit 1`))
      .rows[0].id_fuente;
    const comunidad = (await pool.query(`select id_comunidad from app.comunidad limit 1`)).rows[0]
      .id_comunidad;
    const sala = (await pool.query(`select id_sala from app.sala limit 1`)).rows[0].id_sala;

    expect((await moderador.get('/api/admin/reglas-dlp')).status).toBe(200); // consulta: sí
    expect(
      (await moderador.patch(`/api/admin/reglas-dlp/${regla}`, { estado: 'inactiva' })).status,
    ).toBe(403);
    expect(
      (await moderador.patch('/api/admin/reglas-dlp/categorias/edad', { estado: 'inactiva' }))
        .status,
    ).toBe(403);
    expect(
      (await moderador.post(`/api/gestion/fuentes/${fuente}/desactivacion`, { motivo: 'x' }))
        .status,
    ).toBe(403);
    expect(
      (await moderador.patch(`/api/admin/comunidades/${comunidad}`, { estado: 'inactiva' })).status,
    ).toBe(403);
    expect((await moderador.patch(`/api/admin/salas/${sala}`, { habilitada: false })).status).toBe(
      403,
    );
  });

  it('no existe forma de cambiar el rango de edad de una comunidad ni de una persona', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const admin = await entrar(enTx, 'Admin_001');
      const comunidad = (await pool.query(`select id_comunidad from app.comunidad limit 1`)).rows[0]
        .id_comunidad;
      expect(
        (await admin.patch(`/api/admin/comunidades/${comunidad}`, { rango_edad: 'D' })).status,
      ).toBe(400);
      expect(
        (await admin.patch(`/api/admin/comunidades/${comunidad}`, { codigoRango: 'D' })).status,
      ).toBe(400);
      expect(
        (await admin.patch(`/api/admin/usuarios/${ids.Usuario_001}`, { rango: 'D' })).status,
      ).toBe(400);
    });
  });

  it('el registro de acciones solo muestra a la moderación lo que gestiona', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const admin = await entrar(enTx, 'Admin_001');
      const sala = (
        await pool.query(`select id_sala from app.sala where estado <> 'cerrada' limit 1`)
      ).rows[0].id_sala;
      await admin.patch(`/api/admin/salas/${sala}`, { capacidad: 8 });
      const moderador = await entrar(enTx, 'Moderador_001');
      const vistoPorModerador = (await moderador.get('/api/admin/auditoria')).body.registros;
      expect(vistoPorModerador.map((r: { entidad: string }) => r.entidad)).not.toContain('sala');
      const vistoPorAdmin = (await admin.get('/api/admin/auditoria')).body.registros;
      expect(vistoPorAdmin[0]).toMatchObject({
        accion: 'actualizar_sala',
        entidad: 'sala',
        actor: { alias: 'AdminDemo', rol: 'admin_plataforma' },
        detalle: { capacidad: 8 },
      });
    });
  });
});

describe('Administración', () => {
  it('desactivar una sala la saca de la lista de la comunidad y no admite entradas', async () => {
    await enTransaccionRevertida(async (enTx, cliente) => {
      const admin = await entrar(enTx, 'Admin_001');
      const luna = await entrar(enTx, 'Usuario_001');
      const salas = (await luna.get('/api/salas')).body.salas;
      const bienestar = salas.find((s: { nombre: string }) => s.nombre === 'Bienestar cotidiano');

      const res = await admin.patch(`/api/admin/salas/${bienestar.id}`, { habilitada: false });
      expect(res.status).toBe(200);
      expect(res.body.sala).toMatchObject({ habilitada: false, nombre: 'Bienestar cotidiano' });

      const despues = (await luna.get('/api/salas')).body.salas.map(
        (s: { nombre: string }) => s.nombre,
      );
      expect(despues).not.toContain('Bienestar cotidiano');
      expect((await luna.get(`/api/salas/${bienestar.id}`)).body.sala.habilitada).toBe(false);
      const ocupar = await cliente.query(
        `update app.sala set usuarios_actuales = usuarios_actuales + 1
         where id_sala = $1 and habilitada returning 1`,
        [bienestar.id],
      );
      expect(ocupar.rowCount).toBe(0);
      expect(await auditoria(cliente, 'actualizar_sala')).toEqual([
        expect.objectContaining({
          actor: 'Admin_001',
          detalle: expect.objectContaining({ habilitada: false }),
        }),
      ]);
    });
  });

  it('la capacidad nunca supera 10 y el escenario se valida', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const admin = await entrar(enTx, 'Admin_001');
      const { salas } = (await admin.get('/api/admin/salas?comunidad=B')).body;
      expect(salas).toHaveLength(5);
      const sala = salas[0];
      expect(sala.escenario).toMatchObject({ ancho: 12, alto: 8 });

      expect((await admin.patch(`/api/admin/salas/${sala.id}`, { capacidad: 11 })).status).toBe(
        400,
      );
      expect(
        (await admin.patch(`/api/admin/salas/${sala.id}`, { capacidad: 6 })).body.sala,
      ).toMatchObject({ capacidad: 6 });

      const fuera = await admin.put(`/api/admin/salas/${sala.id}/escenario`, {
        obstaculos: [{ x: 20, y: 1, tipo: 'mesa' }],
        aparicion: { x: 1, y: 6 },
      });
      expect(fuera.status).toBe(400);
      const encerrado = await admin.put(`/api/admin/salas/${sala.id}/escenario`, {
        obstaculos: [
          { x: 0, y: 6, tipo: 'caja' },
          { x: 1, y: 5, tipo: 'caja' },
          { x: 2, y: 6, tipo: 'caja' },
          { x: 1, y: 7, tipo: 'caja' },
        ],
        aparicion: { x: 1, y: 6 },
      });
      expect(encerrado.status).toBe(400);
      expect(encerrado.body.error.detalles[0].mensaje).toBe(
        'Los obstáculos dejan zonas sin salida.',
      );

      const valido = await admin.put(`/api/admin/salas/${sala.id}/escenario`, {
        obstaculos: [
          { x: 5, y: 3, tipo: 'mesa' },
          { x: 6, y: 3, tipo: 'mesa' },
        ],
        aparicion: { x: 1, y: 6 },
      });
      expect(valido.status).toBe(200);
      expect(valido.body.sala.escenario.obstaculos).toHaveLength(2);
    });
  });

  it('desactivar una regla DLP cambia lo que se bloquea y queda registrado', async () => {
    await enTransaccionRevertida(async (enTx, cliente) => {
      const admin = await entrar(enTx, 'Admin_001');
      const luna = await entrar(enTx, 'Usuario_001');
      const publicar = () =>
        luna.post('/api/comunidad/hilos', {
          categoria: 'vida-academica',
          titulo: 'Tareas de la semana',
          contenido: 'Tengo 14 años y muchas tareas.',
        });
      expect((await publicar()).body.error.mensaje).toBe(MENSAJE_BLOQUEO);

      const res = await admin.patch('/api/admin/reglas-dlp/categorias/edad', {
        estado: 'inactiva',
      });
      const edad = res.body.categorias.find((c: { codigo: string }) => c.codigo === 'edad');
      expect(edad.reglas.every((r: { estado: string }) => r.estado === 'inactiva')).toBe(true);
      expect((await publicar()).status).toBe(201);
      expect(await auditoria(cliente, 'desactivar_regla_dlp')).toHaveLength(2);
    });
  });

  it('crea categorías y habilita su sala temática, sin duplicar', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const admin = await entrar(enTx, 'Admin_001');
      const creada = await admin.post('/api/admin/categorias', {
        nombre: 'Arte y creatividad',
        descripcion: 'Dibujo, música y escritura.',
      });
      expect(creada.status).toBe(201);
      expect(creada.body.categorias.map((c: { codigo: string }) => c.codigo)).toContain(
        'arte-y-creatividad',
      );
      expect(
        (await admin.post('/api/admin/categorias', { nombre: 'Arte y creatividad' })).status,
      ).toBe(409);

      const sala = await admin.post('/api/admin/salas', {
        comunidad: 'C',
        categoria: 'arte-y-creatividad',
      });
      expect(sala.status).toBe(201);
      expect(sala.body.sala).toMatchObject({
        nombre: 'Arte y creatividad',
        capacidad: 10,
        habilitada: true,
        comunidad: { rango: 'C' },
      });
      expect(
        (await admin.post('/api/admin/salas', { comunidad: 'C', categoria: 'arte-y-creatividad' }))
          .status,
      ).toBe(409);
      // No hay salas con nombres libres: el nombre sale siempre de la categoría.
      expect(
        (
          await admin.post('/api/admin/salas', {
            comunidad: 'C',
            categoria: 'arte-y-creatividad',
            nombre: 'Sala de Juan',
          })
        ).status,
      ).toBe(400);
    });
  });

  it('lista usuarios con datos mínimos: sin edad, intereses ni código de acceso', async () => {
    const admin = await entrar(app, 'Admin_001');
    const res = await admin.get('/api/admin/usuarios?rol=usuario');
    expect(res.status).toBe(200);
    expect(res.body.usuarios).toHaveLength(5);
    const luna = res.body.usuarios.find((u: { alias: string }) => u.alias === 'LunaDemo');
    expect(Object.keys(luna).sort()).toEqual(
      [
        'alias',
        'bloqueosDlp30d',
        'comunidad',
        'estado',
        'fechaRegistro',
        'id',
        'reportesAbiertos',
        'rol',
      ].sort(),
    );
    const sol = res.body.usuarios.find((u: { alias: string }) => u.alias === 'SolDemo');
    expect(sol.reportesAbiertos).toBeGreaterThanOrEqual(1);
  });

  it('el resumen y las incidencias DLP traen datos reales, sin texto ni autor', async () => {
    const admin = await entrar(app, 'Admin_001');
    const resumen = (await admin.get('/api/admin/resumen')).body;
    expect(resumen).toMatchObject({
      reglas: { total: 20 },
      salas: { abiertas: expect.any(Number) },
    });
    const incidencias = (await admin.get('/api/moderacion/incidencias-dlp?dias=7')).body;
    expect(incidencias.porDia).toHaveLength(7);
    for (const evento of incidencias.recientes) {
      expect(Object.keys(evento)).not.toContain('texto');
      expect(Object.keys(evento)).not.toContain('idUsuario');
    }
  });
});
