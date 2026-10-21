/**
 * Fase 3 · Orientación y fuentes, contra la base real del .env (npm run test:db).
 * Las pruebas que escriben corren dentro de una transacción que se revierte al final:
 * la bitácora es de solo inserción, así que no se podría limpiar de otra forma.
 */
import request from 'supertest';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { cargarConfig } from '../../src/config/env.js';
import { crearPool, type PoolDeDatos } from '../../src/db/database.js';
import { crearLogger } from '../../src/lib/logger.js';
import { cargarFuentes, leerFuentes } from '../../src/modules/fuentes/fuentes.carga.js';
import { hoyEnColombia } from '../../src/modules/fuentes/fuentes.esquemas.js';
import { configPrueba } from '../apoyo.js';

const logger = crearLogger('silencioso');
type App = ReturnType<typeof crearApp>;

let pool: PoolDeDatos;
let app: App;
const ids: Record<string, string> = {};

beforeAll(async () => {
  pool = crearPool(cargarConfig().baseDeDatos);
  app = crearApp({ db: pool, logger, config: configPrueba });
  const { rows } = await pool.query('select codigo, id_fuente from app.fuente_institucional');
  for (const fila of rows) ids[fila.codigo] = fila.id_fuente;
});

afterAll(async () => {
  await pool.end();
});

/** Corre la prueba con una app cuyas consultas van todas a una transacción que se revierte. */
async function enTransaccionRevertida(prueba: (app: App, cliente: pg.PoolClient) => Promise<void>) {
  const cliente = await pool.connect();
  try {
    await cliente.query('begin');
    await prueba(crearApp({ db: cliente, logger, config: configPrueba }), cliente);
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
    put: (ruta: string, cuerpo: object) =>
      request(aplicacion).put(ruta).set('Cookie', cookie).send(cuerpo),
  };
}

const nombres = (servicios: { servicio: string }[]) => servicios.map((s) => s.servicio);

describe('TRL-09 · Orientación institucional', () => {
  it('ofrece las seis necesidades, sin sesión y sin preguntas de evaluación', async () => {
    const res = await request(app).get('/api/orientacion/necesidades');

    expect(res.status).toBe(200);
    expect(res.body.necesidades.map((n: { nombre: string }) => n.nombre)).toEqual([
      'Bienestar',
      'Quiero hablar con alguien',
      'Me preocupa una situación',
      'Me preocupa un amigo',
      'Líneas y canales de ayuda',
      'Información institucional',
    ]);
    for (const necesidad of res.body.necesidades) expect(necesidad.servicios).toBeGreaterThan(0);
  });

  it('la ficha muestra institución, canal, fuente, fecha de verificación y estado', async () => {
    const lista = await request(app).get('/api/orientacion/necesidades/lineas_ayuda');
    const resumen = lista.body.servicios.find(
      (s: { servicio: string }) => s.servicio === 'CanalDemo',
    );

    const res = await request(app).get(`/api/orientacion/servicios/${resumen.id}`);
    expect(res.body.servicio).toEqual({
      id: resumen.id,
      institucion: 'InstituciónDemo',
      servicio: 'CanalDemo',
      descripcion: expect.stringContaining('DATO DE DEMOSTRACIÓN'),
      tipoCanal: 'telefono',
      telefono: '000 000 0000',
      enlace: null,
      horario: 'Horario de demostración',
      fuenteOriginal: expect.any(String),
      fechaVerificacion: '2026-10-20',
      estado: 'activo',
      esDemo: true,
      necesidades: expect.arrayContaining([
        { codigo: 'lineas_ayuda', nombre: 'Líneas y canales de ayuda' },
      ]),
    });
  });

  it('una fuente en revisión se muestra con su estado', async () => {
    const res = await request(app).get('/api/orientacion/necesidades/situacion_preocupa');
    expect(res.body.servicios).toContainEqual(
      expect.objectContaining({
        servicio: 'Punto de orientación presencial (demo)',
        estado: 'requiere_revision',
      }),
    );
  });

  it('una necesidad o un servicio inexistente responde 404', async () => {
    expect((await request(app).get('/api/orientacion/necesidades/diagnostico')).status).toBe(404);
    expect((await request(app).get('/api/orientacion/servicios/no-es-un-id')).status).toBe(404);
  });
});

describe('TRL-10 · «Necesito ayuda»', () => {
  it('lista canales institucionales con fuente y fecha, sin necesidad de sesión', async () => {
    const res = await request(app).get('/api/orientacion/ayuda');

    expect(res.status).toBe(200);
    expect(nombres(res.body.canales)).toEqual(
      expect.arrayContaining(['CanalDemo', 'ChatDemo de orientación']),
    );
    for (const canal of res.body.canales) {
      expect(canal.fuenteOriginal).toBeTruthy();
      expect(canal.fechaVerificacion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(['activo', 'requiere_revision']).toContain(canal.estado);
    }
  });
});

describe('Fuentes inactivas', () => {
  it('una fuente inactiva no aparece como opción vigente ni se puede abrir', async () => {
    const ayuda = await request(app).get('/api/orientacion/ayuda');
    const lineas = await request(app).get('/api/orientacion/necesidades/lineas_ayuda');
    expect(nombres(ayuda.body.canales)).not.toContain('LíneaDemo anterior');
    expect(nombres(lineas.body.servicios)).not.toContain('LíneaDemo anterior');

    const ficha = await request(app).get(
      `/api/orientacion/servicios/${ids['demo-linea-anterior']}`,
    );
    expect(ficha.status).toBe(404);
  });

  it('al desactivar una fuente, deja de mostrarse de inmediato', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const gestor = await entrar(enTx, 'Gestor_001');
      const res = await gestor.post(
        `/api/gestion/fuentes/${ids['demo-canal-demo']}/desactivacion`,
        {
          motivo: 'El canal dejó de responder en la prueba.',
        },
      );
      expect(res.body.fuente.estado).toBe('inactivo');

      const ayuda = await request(enTx).get('/api/orientacion/ayuda');
      expect(nombres(ayuda.body.canales)).not.toContain('CanalDemo');
      expect(
        (await request(enTx).get(`/api/orientacion/servicios/${ids['demo-canal-demo']}`)).status,
      ).toBe(404);
    });
  });
});

describe('TRL-12 · Actualización de fuente trazable', () => {
  it('revisión → verificación queda en la bitácora con fecha, motivo y responsable', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const gestor = await entrar(enTx, 'Gestor_001');
      const ruta = `/api/gestion/fuentes/${ids['demo-portal-bienestar']}`;

      const revision = await gestor.post(`${ruta}/revision`, {
        motivo: 'El teléfono no respondió.',
      });
      expect(revision.status).toBe(200);
      expect(revision.body.fuente.estado).toBe('requiere_revision');
      expect(revision.body.bitacora[0]).toMatchObject({
        accion: 'marcar_revision',
        estadoAnterior: 'activo',
        estadoNuevo: 'requiere_revision',
        observacion: 'El teléfono no respondió.',
        responsable: 'GestorDemo',
        fecha: expect.any(String),
      });

      const publica = await request(enTx).get(
        `/api/orientacion/servicios/${ids['demo-portal-bienestar']}`,
      );
      expect(publica.body.servicio.estado).toBe('requiere_revision');

      const hoy = hoyEnColombia();
      const verificacion = await gestor.post(`${ruta}/verificacion`, {
        fecha: hoy,
        observacion: 'Se comprobó el canal en la fuente original.',
      });
      expect(verificacion.body.fuente).toMatchObject({ estado: 'activo', fechaVerificacion: hoy });
      expect(verificacion.body.bitacora.map((b: { accion: string }) => b.accion)).toEqual([
        'verificar',
        'marcar_revision',
        'crear',
      ]);
      expect(verificacion.body.bitacora[0]).toMatchObject({
        estadoAnterior: 'requiere_revision',
        estadoNuevo: 'activo',
        responsable: 'GestorDemo',
        cambios: {
          estado: { antes: 'requiere_revision', despues: 'activo' },
          fechaVerificacion: { antes: '2026-10-15', despues: hoy },
        },
      });
    });
  });

  it('rechaza transiciones no permitidas, motivos vacíos y fechas futuras', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const gestor = await entrar(enTx, 'Gestor_001');
      const inactiva = `/api/gestion/fuentes/${ids['demo-linea-anterior']}`;
      const activa = `/api/gestion/fuentes/${ids['demo-canal-demo']}`;

      expect((await gestor.post(`${inactiva}/desactivacion`, { motivo: 'Otra vez' })).status).toBe(
        409,
      );
      expect((await gestor.post(`${activa}/revision`, { motivo: '' })).status).toBe(400);
      expect((await gestor.post(`${activa}/verificacion`, { fecha: '2999-01-01' })).status).toBe(
        400,
      );
    });
  });

  it('editar datos registra qué cambió; guardar sin cambios no agrega entradas', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const gestor = await entrar(enTx, 'Gestor_001');
      const ruta = `/api/gestion/fuentes/${ids['demo-canal-demo']}`;
      const { fuente } = (await gestor.get(ruta)).body;
      const datos = {
        institucion: fuente.institucion,
        servicio: fuente.servicio,
        descripcion: fuente.descripcion,
        tipoCanal: fuente.tipoCanal,
        telefono: '000 000 0009',
        enlace: fuente.enlace,
        horario: fuente.horario,
        fuenteOriginal: fuente.fuenteOriginal,
        necesidades: fuente.necesidades.map((n: { codigo: string }) => n.codigo),
        observaciones: fuente.observaciones,
        esDemo: fuente.esDemo,
      };

      const editada = await gestor.put(ruta, datos);
      expect(editada.body.bitacora[0]).toMatchObject({
        accion: 'actualizar',
        cambios: { telefono: { antes: '000 000 0000', despues: '000 000 0009' } },
      });

      const repetida = await gestor.put(ruta, datos);
      expect(repetida.body.bitacora).toHaveLength(editada.body.bitacora.length);
    });
  });

  it('crea una fuente con su bitácora y valida el canal', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const gestor = await entrar(enTx, 'Gestor_001');
      const nueva = {
        institucion: 'InstituciónDemo',
        servicio: 'Línea de prueba automatizada',
        descripcion: 'Registro ficticio creado por una prueba automatizada.',
        tipoCanal: 'telefono',
        telefono: '000 000 0002',
        fuenteOriginal: 'Prueba automatizada',
        necesidades: ['bienestar'],
        esDemo: true,
        estado: 'activo',
        fechaVerificacion: hoyEnColombia(),
      };

      const creada = await gestor.post('/api/gestion/fuentes', nueva);
      expect(creada.status).toBe(201);
      expect(creada.body.fuente.codigo).toMatch(/^linea-de-prueba-automatizada-[0-9a-f]{6}$/);
      expect(creada.body.bitacora).toEqual([
        expect.objectContaining({
          accion: 'crear',
          estadoNuevo: 'activo',
          responsable: 'GestorDemo',
        }),
      ]);
      const bienestar = await request(enTx).get('/api/orientacion/necesidades/bienestar');
      expect(nombres(bienestar.body.servicios)).toContain('Línea de prueba automatizada');

      const sinTelefono = await gestor.post('/api/gestion/fuentes', { ...nueva, telefono: '' });
      expect(sinTelefono.status).toBe(400);
      expect(sinTelefono.body.error.detalles).toContainEqual(
        expect.objectContaining({ campo: 'telefono' }),
      );

      const enlaceMalicioso = await gestor.post('/api/gestion/fuentes', {
        ...nueva,
        tipoCanal: 'web',
        enlace: 'javascript:alert(1)',
      });
      expect(enlaceMalicioso.status).toBe(400);
    });
  });
});

describe('Permisos del panel de fuentes', () => {
  it('sin sesión responde 401', async () => {
    expect((await request(app).get('/api/gestion/fuentes')).status).toBe(401);
  });

  it.each([
    ['Usuario_001', 403],
    ['Moderador_001', 403],
    ['Gestor_001', 200],
    ['Admin_001', 200],
  ])('%s → GET /api/gestion/fuentes responde %i', async (codigo, estado) => {
    const usuario = await entrar(app, codigo);
    expect((await usuario.get('/api/gestion/fuentes')).status).toBe(estado);
  });

  it('un usuario común no puede crear ni cambiar fuentes', async () => {
    const luna = await entrar(app, 'Usuario_001');
    expect((await luna.post('/api/gestion/fuentes', {})).status).toBe(403);
    expect(
      (
        await luna.post(`/api/gestion/fuentes/${ids['demo-canal-demo']}/desactivacion`, {
          motivo: 'xxxxx',
        })
      ).status,
    ).toBe(403);
  });

  it('el gestor ve el semáforo por estado (F34)', async () => {
    const gestor = await entrar(app, 'Gestor_001');
    const res = await gestor.get('/api/gestion/fuentes');
    expect(res.body.resumen).toEqual({ activo: 3, requiere_revision: 1, inactivo: 1 });
    expect(res.body.fuentes).toHaveLength(5);
  });
});

describe('Archivo de carga', () => {
  it('sincroniza: desactiva lo que ya no figura y es idempotente', async () => {
    await enTransaccionRevertida(async (_enTx, cliente) => {
      const entradas = await leerFuentes();
      const sinBienestar = entradas.filter((e) => e.codigo !== 'demo-portal-bienestar');

      const primera = await cargarFuentes(cliente, sinBienestar, 'Prueba de carga');
      expect(primera.desactivadas).toEqual(['demo-portal-bienestar']);

      const segunda = await cargarFuentes(cliente, sinBienestar, 'Prueba de carga');
      expect(segunda).toMatchObject({ creadas: [], actualizadas: [], desactivadas: [] });

      const { rows } = await cliente.query(
        `select b.accion, b.observacion from app.bitacora_fuente b
         join app.fuente_institucional f using (id_fuente)
         where f.codigo = 'demo-portal-bienestar' order by b.fecha desc limit 1`,
      );
      expect(rows[0]).toEqual({
        accion: 'desactivar',
        observacion: 'No figura en el archivo de carga de fuentes.',
      });
    });
  });
});
