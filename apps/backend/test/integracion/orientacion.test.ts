/**
 * Fase 3 · Orientación y fuentes, contra la base local de pruebas (npm run test:db).
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
import type { ClienteLugares } from '../../src/modules/fuentes/fuentes.lugares.js';
import { hoyEnColombia } from '../../src/modules/fuentes/fuentes.esquemas.js';
import { cookieDe, configPrueba } from '../apoyo.js';

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
  const cookie = await cookieDe(pool, codigo);
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
      // Fuente registrada antes del horario semanal: solo el texto (la ficha lo muestra tal cual).
      horarioSemanal: null,
      // Fuente registrada antes de la ubicación: sin dirección ni mapa, y sigue funcionando.
      direccion: null,
      ubicacion: null,
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

  it('el horario semanal se guarda, se recupera al editar y conserva el texto anterior', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const gestor = await entrar(enTx, 'Gestor_001');
      const ruta = `/api/gestion/fuentes/${ids['demo-canal-demo']}`;
      const { fuente } = (await gestor.get(ruta)).body;
      // Fuente registrada antes del horario semanal: solo tiene el texto.
      expect(fuente).toMatchObject({ horario: 'Horario de demostración', horarioSemanal: null });

      const datos = {
        institucion: fuente.institucion,
        servicio: fuente.servicio,
        descripcion: fuente.descripcion,
        tipoCanal: fuente.tipoCanal,
        telefono: fuente.telefono,
        enlace: fuente.enlace,
        horario: fuente.horario,
        fuenteOriginal: fuente.fuenteOriginal,
        necesidades: fuente.necesidades.map((n: { codigo: string }) => n.codigo),
        observaciones: 'Nota interna nueva',
        esDemo: fuente.esDemo,
      };
      // Editar otro campo sin horario semanal no toca el texto.
      const sinHorario = await gestor.put(ruta, datos);
      expect(sinHorario.body.fuente.horario).toBe('Horario de demostración');
      expect(Object.keys(sinHorario.body.bitacora[0].cambios)).toEqual(['observaciones']);

      const oficina = [{ apertura: '08:00', cierre: '17:00' }];
      const horarioSemanal = {
        lunes: [
          { apertura: '14:00', cierre: '17:00' },
          { apertura: '08:00', cierre: '12:00' },
        ],
        martes: oficina,
        miercoles: [],
        jueves: oficina,
        viernes: oficina,
        sabado: [{ apertura: '08:00', cierre: '12:00' }],
        domingo: [],
      };
      const texto =
        'Lunes: 8:00 a. m. – 12:00 p. m. y 2:00 p. m. – 5:00 p. m.; Martes: 8:00 a. m. – 5:00 p. m.; ' +
        'Miércoles: sin atención; Jueves y viernes: 8:00 a. m. – 5:00 p. m.; ' +
        'Sábado: 8:00 a. m. – 12:00 p. m.; Domingo: sin atención';

      const editada = await gestor.put(ruta, { ...datos, horarioSemanal });
      expect(editada.status).toBe(200);
      expect(editada.body.bitacora[0].cambios.horario).toEqual({
        antes: 'Horario de demostración',
        despues: texto,
      });

      const recuperada = (await gestor.get(ruta)).body.fuente;
      expect(recuperada.horario).toBe(texto);
      expect(recuperada.horarioSemanal.lunes).toEqual([
        { apertura: '08:00', cierre: '12:00' },
        { apertura: '14:00', cierre: '17:00' },
      ]);
      expect(recuperada.horarioSemanal.miercoles).toEqual([]);

      // La ficha pública recibe el texto y la estructura por días (para mostrarlo día a día).
      const ficha = await gestor.get(`/api/orientacion/servicios/${fuente.id}`);
      expect(ficha.body.servicio.horario).toBe(texto);
      expect(ficha.body.servicio.horarioSemanal).toEqual(recuperada.horarioSemanal);

      // Guardar lo mismo que devolvió la base (jsonb reordena claves) no agrega entradas.
      const repetida = await gestor.put(ruta, {
        ...datos,
        horario: recuperada.horario,
        horarioSemanal: recuperada.horarioSemanal,
      });
      expect(repetida.body.bitacora).toHaveLength(editada.body.bitacora.length);

      const cruzado = await gestor.put(ruta, {
        ...datos,
        horarioSemanal: { ...horarioSemanal, martes: [{ apertura: '17:00', cierre: '08:00' }] },
      });
      expect(cruzado.status).toBe(400);
      expect((await gestor.get(ruta)).body.fuente.horario).toBe(texto);
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

describe('Ubicación de fuentes presenciales', () => {
  const gobernacion = {
    latitud: 4.151235,
    longitud: -73.639877,
    placeId: 'ChIJ_lugar_000000001',
    direccion: 'Cl. 38 #30-25, Villavicencio, Meta, Colombia',
  };
  const otraSede = {
    latitud: 4.128,
    longitud: -73.6001,
    placeId: null,
    direccion: 'Carrera 33 # 15-20, Villavicencio, Meta',
  };
  const nueva = {
    institucion: 'InstituciónDemo',
    servicio: 'Sede presencial de prueba',
    descripcion: 'Registro ficticio con atención presencial, creado por una prueba.',
    tipoCanal: 'presencial',
    fuenteOriginal: 'Prueba automatizada',
    necesidades: ['informacion_institucional'],
    esDemo: false,
    estado: 'activo',
    fechaVerificacion: hoyEnColombia(),
  };
  /** Lo editable de una fuente tal como la devuelve el panel. */
  const editable = (f: Record<string, unknown> & { necesidades: { codigo: string }[] }) => ({
    institucion: f.institucion,
    servicio: f.servicio,
    descripcion: f.descripcion,
    tipoCanal: f.tipoCanal,
    telefono: f.telefono,
    enlace: f.enlace,
    horario: f.horario,
    horarioSemanal: f.horarioSemanal,
    direccion: f.direccion,
    ubicacion: f.ubicacion,
    fuenteOriginal: f.fuenteOriginal,
    necesidades: f.necesidades.map((n) => n.codigo),
    observaciones: f.observaciones,
    esDemo: f.esDemo,
  });

  it('crear, editar, cambiar y quitar la ubicación sin perder la fuente', async () => {
    await enTransaccionRevertida(async (enTx, cliente) => {
      const gestor = await entrar(enTx, 'Gestor_001');

      const creada = await gestor.post('/api/gestion/fuentes', {
        ...nueva,
        direccion: 'Calle 38 # 30-25, piso 2',
        ubicacion: gobernacion,
      });
      expect(creada.status).toBe(201);
      expect(creada.body.fuente).toMatchObject({
        direccion: 'Calle 38 # 30-25, piso 2',
        ubicacion: gobernacion,
      });
      const id = creada.body.fuente.id as string;
      const ruta = `/api/gestion/fuentes/${id}`;

      // Los usuarios finales la ven en la ficha pública y en las listas, sin sesión.
      const ficha = await request(enTx).get(`/api/orientacion/servicios/${id}`);
      expect(ficha.body.servicio).toMatchObject({
        direccion: 'Calle 38 # 30-25, piso 2',
        ubicacion: gobernacion,
      });
      const lista = await request(enTx).get(
        '/api/orientacion/necesidades/informacion_institucional',
      );
      expect(lista.body.servicios.find((s: { id: string }) => s.id === id).ubicacion).toEqual(
        gobernacion,
      );

      // Guardar sin cambios no agrega entradas (la base devuelve el mismo punto).
      const datos = editable((await gestor.get(ruta)).body.fuente);
      const igual = await gestor.put(ruta, datos);
      expect(igual.body.bitacora).toHaveLength(1);

      // Cambiar por otra ubicación (ingresada a mano, sin place_id).
      const cambiada = await gestor.put(ruta, { ...datos, ubicacion: otraSede });
      expect(cambiada.status).toBe(200);
      expect(cambiada.body.fuente.ubicacion).toEqual(otraSede);
      expect(cambiada.body.bitacora[0].cambios.ubicacion).toEqual({
        antes: gobernacion,
        despues: otraSede,
      });

      // Quitar la ubicación: la fuente sigue, con su dirección escrita.
      const sinUbicacion = await gestor.put(ruta, { ...datos, ubicacion: null });
      expect(sinUbicacion.status).toBe(200);
      expect(sinUbicacion.body.fuente).toMatchObject({
        estado: 'activo',
        direccion: 'Calle 38 # 30-25, piso 2',
        ubicacion: null,
      });
      const fichaSinMapa = await request(enTx).get(`/api/orientacion/servicios/${id}`);
      expect(fichaSinMapa.status).toBe(200);
      expect(fichaSinMapa.body.servicio).toMatchObject({
        direccion: 'Calle 38 # 30-25, piso 2',
        ubicacion: null,
      });

      // Coordenadas incompletas o inválidas no se guardan.
      const { longitud: _longitud, ...incompleta } = gobernacion;
      for (const ubicacion of [incompleta, { ...gobernacion, latitud: 95 }]) {
        const invalida = await gestor.put(ruta, { ...datos, ubicacion });
        expect(invalida.status).toBe(400);
      }
      expect((await gestor.get(ruta)).body.fuente.ubicacion).toBeNull();

      // La base también exige la pareja completa, aunque alguien escriba sin pasar por la API.
      await expect(
        cliente.query('update app.fuente_institucional set latitud = 4.1 where id_fuente = $1', [
          id,
        ]),
      ).rejects.toThrow(/fuente_ubicacion_completa/);
    });
  });

  it('una fuente virtual se crea y se edita sin dirección ni ubicación', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const gestor = await entrar(enTx, 'Gestor_001');
      const creada = await gestor.post('/api/gestion/fuentes', {
        ...nueva,
        servicio: 'Portal virtual de prueba',
        tipoCanal: 'web',
        enlace: 'https://portal.example.test',
      });
      expect(creada.status).toBe(201);
      expect(creada.body.fuente).toMatchObject({ direccion: null, ubicacion: null });

      const ruta = `/api/gestion/fuentes/${creada.body.fuente.id}`;
      const editada = await gestor.put(ruta, {
        ...editable(creada.body.fuente),
        descripcion: 'Portal ficticio, descripción editada por una prueba.',
      });
      expect(editada.status).toBe(200);
      expect(Object.keys(editada.body.bitacora[0].cambios)).toEqual(['descripcion']);
    });
  });

  it('las fuentes históricas siguen sin ubicación y se editan igual que antes', async () => {
    await enTransaccionRevertida(async (enTx) => {
      const gestor = await entrar(enTx, 'Gestor_001');
      const ruta = `/api/gestion/fuentes/${ids['demo-canal-demo']}`;
      const { fuente } = (await gestor.get(ruta)).body;
      expect(fuente).toMatchObject({ direccion: null, ubicacion: null });

      // Un cliente anterior que no envía los campos nuevos sigue pudiendo editar.
      const { direccion: _direccion, ubicacion: _ubicacion, ...anterior } = editable(fuente);
      const editada = await gestor.put(ruta, { ...anterior, observaciones: 'Nota de prueba' });
      expect(editada.status).toBe(200);
      expect(Object.keys(editada.body.bitacora[0].cambios)).toEqual(['observaciones']);
    });
  });

  describe('Búsqueda de lugares del panel', () => {
    const lugarFalso: ClienteLugares = {
      disponible: true,
      sugerencias: async () => [
        { placeId: 'ChIJ_lugar_000000001', principal: 'Gobernación', secundario: 'Meta' },
      ],
      lugar: async (placeId) => ({ ...gobernacion, placeId, nombre: 'Gobernación' }),
    };

    it('solo la gestión de fuentes puede buscar lugares', async () => {
      const conLugares = crearApp({
        db: pool,
        logger,
        config: configPrueba,
        clienteLugares: lugarFalso,
      });
      expect((await request(conLugares).get('/api/gestion/fuentes/lugares')).status).toBe(401);
      const luna = await entrar(conLugares, 'Usuario_001');
      expect((await luna.get('/api/gestion/fuentes/lugares/sugerencias?texto=gober')).status).toBe(
        403,
      );

      const gestor = await entrar(conLugares, 'Gestor_001');
      expect((await gestor.get('/api/gestion/fuentes/lugares')).body).toEqual({ disponible: true });
      const sugerencias = await gestor.get(
        '/api/gestion/fuentes/lugares/sugerencias?texto=gober&sesion=sesion-0001',
      );
      expect(sugerencias.body.sugerencias).toHaveLength(1);
      const lugar = await gestor.get('/api/gestion/fuentes/lugares/ChIJ_lugar_000000001');
      expect(lugar.body.lugar).toMatchObject({ latitud: 4.151235, longitud: -73.639877 });

      const corta = await gestor.get('/api/gestion/fuentes/lugares/sugerencias?texto=g');
      expect(corta.status).toBe(400);
    });

    it('sin clave configurada el panel lo sabe y la búsqueda responde 503', async () => {
      const gestor = await entrar(app, 'Gestor_001');
      expect((await gestor.get('/api/gestion/fuentes/lugares')).body).toEqual({
        disponible: false,
      });
      const busqueda = await gestor.get('/api/gestion/fuentes/lugares/sugerencias?texto=gober');
      expect(busqueda.status).toBe(503);
      expect(busqueda.body.error.codigo).toBe('LUGARES_NO_CONFIGURADO');
    });
  });
});
