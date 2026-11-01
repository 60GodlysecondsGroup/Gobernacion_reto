import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { leerReglasDlpSemilla } from '../src/db/migraciones.js';
import { crearLogger } from '../src/lib/logger.js';
import type { ServicioComunidad } from '../src/modules/comunidad/comunidad.service.js';
import {
  compilarPatron,
  MENSAJE_BLOQUEO,
  type CategoriaDlp,
  type ReglaCompilada,
} from '../src/modules/dlp/dlp.analizador.js';
import { crearServicioDlp } from '../src/modules/dlp/dlp.service.js';
import {
  leerObstaculos,
  mover,
  puntoDeAparicion,
  ruta,
  type Escenario,
} from '../src/modules/salas/salas.escenario.js';
import {
  crearCoordinacionMemoria,
  crearMemoriaCompartida,
  type EventoSala,
  type MemoriaCompartida,
} from '../src/modules/salas/salas.coordinacion.js';
import { crearGestorSalas, type Conexion } from '../src/modules/salas/salas.gestor.js';
import type { MensajeServidor } from '../src/modules/salas/salas.protocolo.js';
import type { RepositorioSalas } from '../src/modules/salas/salas.repository.js';
import type { Sesion } from '../src/modules/seguridad/sesion.service.js';

const ESCENARIO: Escenario = {
  ancho: 6,
  alto: 4,
  obstaculos: [{ x: 2, y: 1, tipo: 'mesa' }],
  aparicion: { x: 0, y: 3 },
};

describe('Escenario 2D', () => {
  it('mueve dentro del área y rechaza límites y obstáculos (AV-06, AV-07)', () => {
    expect(mover(ESCENARIO, { x: 0, y: 3 }, 'arriba')).toEqual({
      valido: true,
      posicion: { x: 0, y: 2 },
    });
    expect(mover(ESCENARIO, { x: 0, y: 3 }, 'izquierda')).toEqual({
      valido: false,
      motivo: 'limite',
    });
    expect(mover(ESCENARIO, { x: 0, y: 3 }, 'abajo')).toEqual({ valido: false, motivo: 'limite' });
    expect(mover(ESCENARIO, { x: 5, y: 0 }, 'derecha')).toEqual({
      valido: false,
      motivo: 'limite',
    });
    expect(mover(ESCENARIO, { x: 1, y: 1 }, 'derecha')).toEqual({
      valido: false,
      motivo: 'obstaculo',
    });
  });

  it('hace aparecer a cada persona en una celda libre cercana', () => {
    expect(puntoDeAparicion(ESCENARIO, [])).toEqual({ x: 0, y: 3 });
    expect(puntoDeAparicion(ESCENARIO, [{ x: 0, y: 3 }])).toEqual({ x: 0, y: 2 });
  });

  it('F40 · calcula el camino más corto rodeando obstáculos', () => {
    // Desde (1,0) hasta (3,1): la mesa en (2,1) obliga a pasar por arriba.
    const plan = ruta(ESCENARIO, { x: 1, y: 0 }, { x: 3, y: 1 });
    expect(plan).toEqual({ valido: true, pasos: ['derecha', 'derecha', 'abajo'] });
    // Ningún paso del camino cae en un obstáculo ni fuera del área.
    let posicion = { x: 1, y: 0 };
    for (const paso of plan.valido ? plan.pasos : []) {
      const resultado = mover(ESCENARIO, posicion, paso);
      expect(resultado.valido).toBe(true);
      if (resultado.valido) posicion = resultado.posicion;
    }
    expect(posicion).toEqual({ x: 3, y: 1 });
  });

  it('F40 · rechaza destinos fuera del área, sobre un obstáculo o inalcanzables', () => {
    expect(ruta(ESCENARIO, { x: 0, y: 3 }, { x: 2, y: 1 })).toEqual({
      valido: false,
      motivo: 'destino_invalido',
    });
    expect(ruta(ESCENARIO, { x: 0, y: 3 }, { x: 6, y: 0 })).toEqual({
      valido: false,
      motivo: 'destino_invalido',
    });
    expect(ruta(ESCENARIO, { x: 0, y: 3 }, { x: 1.5, y: 0 })).toEqual({
      valido: false,
      motivo: 'destino_invalido',
    });
    const encerrado: Escenario = {
      ...ESCENARIO,
      obstaculos: [
        { x: 4, y: 0, tipo: 'caja' },
        { x: 4, y: 1, tipo: 'caja' },
        { x: 5, y: 1, tipo: 'caja' },
      ],
    };
    expect(ruta(encerrado, { x: 0, y: 3 }, { x: 5, y: 0 })).toEqual({
      valido: false,
      motivo: 'sin_camino',
    });
    expect(ruta(ESCENARIO, { x: 0, y: 3 }, { x: 0, y: 3 })).toEqual({ valido: true, pasos: [] });
  });

  it('descarta obstáculos inválidos o fuera del área', () => {
    expect(
      leerObstaculos(
        [
          { x: 1, y: 1, tipo: 'planta' },
          { x: 9, y: 9, tipo: 'mesa' },
          { x: 'a' },
          null,
          { x: 0, y: 0, tipo: 'otro' },
        ],
        6,
        4,
      ),
    ).toEqual([
      { x: 1, y: 1, tipo: 'planta' },
      { x: 0, y: 0, tipo: 'caja' },
    ]);
  });
});

/** Base simulada: la ocupación se comprueba y suma en un solo paso, como el UPDATE atómico. */
function repositorioFalso(capacidad = 10) {
  const sala = {
    estado: 'disponible' as string,
    habilitada: true,
    ocupacion: 0,
    vaciaDesde: 0,
    maximoVisto: 0,
  };
  const posiciones = new Map<string, { x: number; y: number }>();
  const pausa = () => new Promise((r) => setTimeout(r, Math.random() * 5));

  const repositorio: RepositorioSalas = {
    listar: async () => [],
    porId: async (idComunidad, idSala) =>
      idComunidad === 'comunidad-B' && (idSala === ID_SALA || idSala === ID_OTRA_SALA)
        ? {
            id: idSala,
            nombre: 'Sala de prueba',
            tematica: 'Bienestar cotidiano',
            descripcion: '',
            reglas: '',
            capacidad,
            ocupacion: sala.ocupacion,
            estado: sala.estado as 'disponible',
            habilitada: sala.habilitada,
            idComunidad,
            instanciaVigente: null,
          }
        : null,
    escenario: async () => ESCENARIO,
    participante: async (id) => ({ id, alias: `Alias-${id}`, avatar: null }),
    ocupar: async () => {
      await pausa();
      if (sala.estado === 'cerrada') return { resultado: 'cerrada' };
      if (!sala.habilitada) return { resultado: 'deshabilitada' };
      if (sala.ocupacion >= capacidad) return { resultado: 'llena' };
      sala.ocupacion += 1;
      sala.maximoVisto = Math.max(sala.maximoVisto, sala.ocupacion);
      sala.estado = sala.ocupacion >= capacidad ? 'llena' : 'disponible';
      return { resultado: 'ok', ocupacion: sala.ocupacion };
    },
    liberar: async () => {
      await pausa();
      sala.ocupacion -= 1;
      if (sala.ocupacion === 0) {
        sala.estado = 'vacia';
        sala.vaciaDesde = Date.now();
      } else sala.estado = 'disponible';
      return sala.ocupacion;
    },
    guardarPosicion: async (_s, id, posicion) => {
      posiciones.set(id, posicion);
    },
    cerrarSiVacia: async (_s, segundos) => {
      const vacia = sala.estado === 'vacia' && sala.ocupacion === 0;
      if (vacia && Date.now() - sala.vaciaDesde >= segundos * 1000) {
        sala.estado = 'cerrada';
        return { cerrada: ID_SALA, nueva: 'otra-instancia', sigueVacia: false };
      }
      return { cerrada: null, nueva: null, sigueVacia: vacia };
    },
    participacionesAbiertas: async () => [],
    porCerrar: async () => [],
  };
  return { repositorio, sala, posiciones };
}

const ID_SALA = '11111111-1111-4111-8111-111111111111';
const ID_OTRA_SALA = '22222222-2222-4222-8222-222222222222';
const logger = crearLogger('silencioso');

const comunidades = {
  obtenerPropia: async (sesion: Sesion) => ({
    id: `comunidad-${sesion.rango}`,
    nombre: `Comunidad ${sesion.rango}`,
    descripcion: '',
    rango: '',
  }),
} as unknown as ServicioComunidad;

function conexion() {
  const mensajes: MensajeServidor[] = [];
  const estado = { abierta: true, codigo: 0 };
  const c: Conexion & { mensajes: MensajeServidor[]; codigo: () => number } = {
    id: randomUUID(),
    mensajes,
    enviar: (m) => {
      if (estado.abierta) mensajes.push(m);
    },
    cerrar: (codigo) => {
      estado.abierta = false;
      estado.codigo = codigo;
    },
    get abierta() {
      return estado.abierta;
    },
    codigo: () => estado.codigo,
  };
  return c;
}

const sesion = (
  id: string,
  rango: Sesion['rango'] = 'B',
  rol: Sesion['rol'] = 'usuario',
): Sesion => ({
  idUsuario: id,
  alias: `Alias-${id}`,
  rol,
  rango,
});

let reglas: ReglaCompilada[];
beforeAll(async () => {
  reglas = (await leerReglasDlpSemilla()).map((r) => ({
    id: r.codigo,
    codigo: r.codigo,
    categoria: r.categoria as CategoriaDlp,
    accion: 'bloquear',
    patron: compilarPatron(r.patron),
  }));
});

function gestor(
  opciones: {
    cierreSegundos?: number;
    capacidad?: number;
    /** Comparte el estado con otro gestor: simula dos instancias del backend. */
    memoria?: MemoriaCompartida;
    falso?: ReturnType<typeof repositorioFalso>;
    presenciaMs?: number;
  } = {},
) {
  const falso = opciones.falso ?? repositorioFalso(opciones.capacidad);
  const memoria = opciones.memoria ?? crearMemoriaCompartida();
  const presenciaMs = opciones.presenciaMs ?? 30_000;
  const dlp = crearServicioDlp({
    repositorio: { reglasActivas: async () => reglas, registrarEvento: async () => {} },
    logger,
  });
  const g = crearGestorSalas({
    repositorio: falso.repositorio,
    comunidades,
    dlp,
    logger,
    coordinacion: crearCoordinacionMemoria({ presenciaMs, memoria }),
    cierreSegundos: opciones.cierreSegundos ?? 180,
    latidoMs: Math.max(20, Math.floor(presenciaMs / 3)),
    presenciaMs,
    intervaloMovimientoMs: 0,
    intervaloMensajeMs: 0,
    retrasoGuardadoMs: 10,
    intervaloPasoMs: 5,
  });
  return { gestor: g, memoria, ...falso, falso };
}

const recibido = (c: { mensajes: MensajeServidor[] }, tipo: MensajeServidor['tipo']) =>
  c.mensajes.filter((m) => m.tipo === tipo);

describe('Gestor de salas', () => {
  it('TRL-07 · con entradas simultáneas nunca pasa de 10 y el 11.º recibe «La sala está llena»', async () => {
    const { gestor: g, sala } = gestor();
    const conexiones = Array.from({ length: 12 }, () => conexion());
    const resultados = await Promise.all(
      conexiones.map((c, i) => g.conectar(c, sesion(`u${i}`), ID_SALA)),
    );

    expect(resultados.filter(Boolean)).toHaveLength(10);
    expect(sala.maximoVisto).toBe(10);
    const rechazadas = conexiones.filter((c) => c.codigo() === 4429);
    expect(rechazadas).toHaveLength(2);
    expect(rechazadas[0]!.mensajes[0]).toEqual({
      tipo: 'error',
      codigo: 'SALA_LLENA',
      mensaje: 'La sala está llena.',
    });
    expect(await g.participantes(ID_SALA)).toHaveLength(10);
  });

  it('salir libera el cupo para otra persona (F15)', async () => {
    const { gestor: g } = gestor({ capacidad: 1 });
    const primera = conexion();
    await g.conectar(primera, sesion('a'), ID_SALA);
    const segunda = conexion();
    expect(await g.conectar(segunda, sesion('b'), ID_SALA)).toBeNull();

    await g.desconectar(ID_SALA, 'a', primera);
    expect(await g.conectar(conexion(), sesion('c'), ID_SALA)).toBe('c');
  });

  it('AV-04 y AV-08 · el movimiento válido se ve en todas las conexiones', async () => {
    const { gestor: g, posiciones } = gestor();
    const a = conexion();
    const b = conexion();
    await g.conectar(a, sesion('a'), ID_SALA);
    await g.conectar(b, sesion('b'), ID_SALA);

    await g.recibir(ID_SALA, 'a', a, JSON.stringify({ tipo: 'mover', direccion: 'derecha' }));

    expect(recibido(a, 'movio')).toEqual([{ tipo: 'movio', id: 'a', x: 1, y: 3 }]);
    expect(recibido(b, 'movio')).toEqual([{ tipo: 'movio', id: 'a', x: 1, y: 3 }]);
    expect((await g.participantes(ID_SALA)).find((p) => p.id === 'a')).toMatchObject({
      x: 1,
      y: 3,
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(posiciones.get('a')).toEqual({ x: 1, y: 3 });
  });

  it('AV-06 · el límite se rechaza solo para quien se mueve, sin cambiar la posición', async () => {
    const { gestor: g } = gestor();
    const a = conexion();
    const b = conexion();
    await g.conectar(a, sesion('a'), ID_SALA);
    await g.conectar(b, sesion('b'), ID_SALA);

    await g.recibir(ID_SALA, 'a', a, JSON.stringify({ tipo: 'mover', direccion: 'izquierda' }));
    expect(recibido(a, 'movimiento_rechazado')).toEqual([
      { tipo: 'movimiento_rechazado', motivo: 'limite' },
    ]);
    expect(recibido(b, 'movio')).toEqual([]);
    expect((await g.participantes(ID_SALA)).find((p) => p.id === 'a')).toMatchObject({
      x: 0,
      y: 3,
    });
  });

  it('el cliente no puede enviar coordenadas ni direcciones inventadas', async () => {
    const { gestor: g } = gestor();
    const a = conexion();
    await g.conectar(a, sesion('a'), ID_SALA);
    await g.recibir(ID_SALA, 'a', a, JSON.stringify({ tipo: 'mover', x: 5, y: 0 }));
    await g.recibir(
      ID_SALA,
      'a',
      a,
      JSON.stringify({ tipo: 'mover', direccion: 'teletransporte' }),
    );
    await g.recibir(ID_SALA, 'a', a, 'no es json');
    expect((await g.participantes(ID_SALA))[0]).toMatchObject({ x: 0, y: 3 });
  });

  it('F14 · un mensaje con teléfono solo le muestra el aviso al autor', async () => {
    const { gestor: g } = gestor();
    const a = conexion();
    const b = conexion();
    await g.conectar(a, sesion('a'), ID_SALA);
    await g.conectar(b, sesion('b'), ID_SALA);

    await g.recibir(
      ID_SALA,
      'a',
      a,
      JSON.stringify({ tipo: 'mensaje', texto: 'Escríbeme al 3000000000' }),
    );
    expect(recibido(a, 'mensaje_bloqueado')).toEqual([
      { tipo: 'mensaje_bloqueado', mensaje: MENSAJE_BLOQUEO },
    ]);
    expect(recibido(b, 'mensaje')).toEqual([]);

    await g.recibir(ID_SALA, 'a', a, JSON.stringify({ tipo: 'mensaje', texto: 'Hola a todos' }));
    expect(recibido(b, 'mensaje')).toEqual([
      expect.objectContaining({ texto: 'Hola a todos', autor: { id: 'a', alias: 'Alias-a' } }),
    ]);
  });

  it('AV-12 · sin sesión, sin permiso o de otra comunidad no entra', async () => {
    const { gestor: g } = gestor();
    const sinSesion = conexion();
    const gestorFuentes = conexion();
    const otraComunidad = conexion();
    await g.conectar(sinSesion, null, ID_SALA);
    await g.conectar(gestorFuentes, sesion('g', null, 'gestor_fuentes'), ID_SALA);
    await g.conectar(otraComunidad, sesion('c', 'C'), ID_SALA);

    expect(sinSesion.codigo()).toBe(4401);
    expect(gestorFuentes.codigo()).toBe(4403);
    expect(otraComunidad.codigo()).toBe(4404);
    expect(otraComunidad.mensajes).toEqual([
      { tipo: 'error', codigo: 'NO_ENCONTRADA', mensaje: 'La sala no existe.' },
    ]);
  });

  it('otra pestaña de la misma persona reemplaza la conexión sin ocupar otro cupo', async () => {
    const { gestor: g, sala } = gestor();
    const primera = conexion();
    const segunda = conexion();
    await g.conectar(primera, sesion('a'), ID_SALA);
    await g.conectar(segunda, sesion('a'), ID_SALA);

    expect(primera.codigo()).toBe(4000);
    expect(sala.ocupacion).toBe(1);
    await g.desconectar(ID_SALA, 'a', primera);
    expect(await g.participantes(ID_SALA)).toHaveLength(1);
  });

  it('dos conexiones a la vez de la misma persona dejan una sola dentro (montaje doble de React)', async () => {
    const { gestor: g, sala } = gestor();
    const primera = conexion();
    const segunda = conexion();
    const resultados = await Promise.all([
      g.conectar(primera, sesion('a'), ID_SALA),
      g.conectar(segunda, sesion('a'), ID_SALA),
    ]);

    expect(resultados).toEqual(['a', 'a']);
    expect(sala.ocupacion).toBe(1);
    expect(primera.codigo()).toBe(4000);
    expect(segunda.abierta).toBe(true);
    expect(recibido(segunda, 'estado')).toHaveLength(1);
  });

  it('si la primera conexión se cierra mientras entra, la segunda entra igual', async () => {
    const { gestor: g, sala } = gestor();
    const primera = conexion();
    const segunda = conexion();
    const entrada = g.conectar(primera, sesion('a'), ID_SALA);
    primera.cerrar(1000, 'salida');
    await Promise.all([entrada, g.conectar(segunda, sesion('a'), ID_SALA)]);

    expect(sala.ocupacion).toBe(1);
    expect(await g.participantes(ID_SALA)).toHaveLength(1);
    expect(recibido(segunda, 'estado')).toHaveLength(1);
  });

  it('TRL-08 · vacía durante el tiempo de cierre, la sala se cierra', async () => {
    const { gestor: g, sala } = gestor({ cierreSegundos: 1 });
    const a = conexion();
    await g.conectar(a, sesion('a'), ID_SALA);
    await g.desconectar(ID_SALA, 'a', a);

    await new Promise((r) => setTimeout(r, 1500));
    expect(sala.estado).toBe('cerrada');
    const tarde = conexion();
    await g.conectar(tarde, sesion('b'), ID_SALA);
    expect(tarde.codigo()).toBe(4409);
    g.detener();
  });

  it('TRL-08 · si alguien entra antes del tiempo, el contador se cancela', async () => {
    const { gestor: g, sala } = gestor({ cierreSegundos: 1 });
    const a = conexion();
    await g.conectar(a, sesion('a'), ID_SALA);
    await g.desconectar(ID_SALA, 'a', a);
    await new Promise((r) => setTimeout(r, 500));
    await g.conectar(conexion(), sesion('b'), ID_SALA);

    await new Promise((r) => setTimeout(r, 1200));
    expect(sala.estado).not.toBe('cerrada');
    g.detener();
  });

  it('AV-05 · el clic mueve paso a paso hasta el destino y todos lo ven', async () => {
    const { gestor: g } = gestor();
    const a = conexion();
    const b = conexion();
    await g.conectar(a, sesion('a'), ID_SALA);
    await g.conectar(b, sesion('b'), ID_SALA);
    // a aparece en (0,3); b, en la celda libre más cercana.
    await g.recibir(ID_SALA, 'a', a, JSON.stringify({ tipo: 'ir', x: 3, y: 0 }));
    await new Promise((r) => setTimeout(r, 80));

    expect((await g.participantes(ID_SALA)).find((p) => p.id === 'a')).toMatchObject({
      x: 3,
      y: 0,
    });
    const pasosVistosPorB = recibido(b, 'movio').filter((m) => m.tipo === 'movio' && m.id === 'a');
    expect(pasosVistosPorB.length).toBe(6);
    // Ningún paso pasa por la mesa de (2,1).
    expect(pasosVistosPorB).not.toContainEqual(expect.objectContaining({ x: 2, y: 1 }));
  });

  it('AV-05 · un destino inválido se rechaza sin mover el avatar', async () => {
    const { gestor: g } = gestor();
    const a = conexion();
    await g.conectar(a, sesion('a'), ID_SALA);
    await g.recibir(ID_SALA, 'a', a, JSON.stringify({ tipo: 'ir', x: 2, y: 1 }));
    await g.recibir(ID_SALA, 'a', a, JSON.stringify({ tipo: 'ir', x: 99, y: 0 }));
    await g.recibir(ID_SALA, 'a', a, JSON.stringify({ tipo: 'ir', x: '1', y: 0 }));
    expect(recibido(a, 'movimiento_rechazado')).toEqual([
      { tipo: 'movimiento_rechazado', motivo: 'destino_invalido' },
      { tipo: 'movimiento_rechazado', motivo: 'destino_invalido' },
    ]);
    expect((await g.participantes(ID_SALA))[0]).toMatchObject({ x: 0, y: 3 });
  });

  it('F40 · una tecla cancela el recorrido por clic en curso', async () => {
    const { gestor: g } = gestor();
    const a = conexion();
    await g.conectar(a, sesion('a'), ID_SALA);
    await g.recibir(ID_SALA, 'a', a, JSON.stringify({ tipo: 'ir', x: 5, y: 0 }));
    await g.recibir(ID_SALA, 'a', a, JSON.stringify({ tipo: 'mover', direccion: 'abajo' }));
    await new Promise((r) => setTimeout(r, 80));
    // El primer paso del recorrido (arriba) ya ocurrió; luego la tecla «abajo» lo detuvo.
    expect((await g.participantes(ID_SALA))[0]).toMatchObject({ x: 0, y: 3 });
  });

  it('Fase 7 · deshabilitar una sala saca a quien está dentro y no deja entrar', async () => {
    const { gestor: g, sala } = gestor();
    const a = conexion();
    const b = conexion();
    await g.conectar(a, sesion('a'), ID_SALA);
    await g.conectar(b, sesion('b'), ID_SALA);

    sala.habilitada = false;
    expect(await g.retirarTodos(ID_SALA)).toBe(2);
    expect(a.codigo()).toBe(4410);
    expect(b.codigo()).toBe(4410);
    expect(sala.ocupacion).toBe(0);
    expect(await g.participantes(ID_SALA)).toHaveLength(0);

    const tarde = conexion();
    expect(await g.conectar(tarde, sesion('c'), ID_SALA)).toBeNull();
    expect(tarde.codigo()).toBe(4410);
    expect(tarde.mensajes[0]).toMatchObject({ codigo: 'SALA_NO_DISPONIBLE' });
  });

  it('Fase 7 · suspender una cuenta la retira de la sala y los demás lo ven', async () => {
    const { gestor: g, sala } = gestor();
    const a = conexion();
    const b = conexion();
    await g.conectar(a, sesion('a'), ID_SALA);
    await g.conectar(b, sesion('b'), ID_SALA);

    expect(await g.retirarUsuario('a')).toBe(1);
    expect(a.codigo()).toBe(4410);
    expect(recibido(b, 'salio')).toEqual([{ tipo: 'salio', id: 'a', ocupacion: 1 }]);
    expect(sala.ocupacion).toBe(1);
    // El cierre del socket después de retirar no libera dos veces.
    await g.desconectar(ID_SALA, 'a', a);
    expect(sala.ocupacion).toBe(1);
  });
});

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

function deTipo<T extends MensajeServidor['tipo']>(c: { mensajes: MensajeServidor[] }, tipo: T) {
  return c.mensajes.filter((m): m is Extract<MensajeServidor, { tipo: T }> => m.tipo === tipo);
}

/** Dos gestores sobre el mismo estado compartido y la misma base: dos instancias del backend. */
function dosInstancias(opciones: { capacidad?: number; presenciaMs?: number } = {}) {
  const memoria = crearMemoriaCompartida();
  const falso = repositorioFalso(opciones.capacidad);
  const crear = () => gestor({ memoria, falso, presenciaMs: opciones.presenciaMs }).gestor;
  return { uno: crear(), dos: crear(), crear, memoria, sala: falso.sala };
}

describe('Varias instancias del backend con estado compartido', () => {
  it('A en la instancia 1 y B en la 2: se ven entrar, moverse y escribir, una vez cada cosa', async () => {
    const { uno, dos } = dosInstancias();
    const a = conexion();
    const b = conexion();
    await uno.conectar(a, sesion('a'), ID_SALA);
    await dos.conectar(b, sesion('b'), ID_SALA);

    expect(deTipo(a, 'entro')).toEqual([
      expect.objectContaining({ participante: expect.objectContaining({ id: 'b' }), ocupacion: 2 }),
    ]);
    expect(
      deTipo(b, 'estado')[0]!
        .participantes.map((p) => p.id)
        .sort(),
    ).toEqual(['a', 'b']);

    await uno.recibir(ID_SALA, 'a', a, JSON.stringify({ tipo: 'mover', direccion: 'derecha' }));
    await uno.recibir(
      ID_SALA,
      'a',
      a,
      JSON.stringify({ tipo: 'mensaje', texto: 'Hola desde la 1' }),
    );
    await dos.recibir(ID_SALA, 'b', b, JSON.stringify({ tipo: 'mover', direccion: 'arriba' }));

    expect(deTipo(b, 'movio')).toEqual([
      { tipo: 'movio', id: 'a', x: 1, y: 3 },
      { tipo: 'movio', id: 'b', x: 0, y: 1 },
    ]);
    expect(deTipo(a, 'movio')).toEqual(deTipo(b, 'movio'));
    expect(deTipo(b, 'mensaje')).toEqual([
      expect.objectContaining({ texto: 'Hola desde la 1', autor: { id: 'a', alias: 'Alias-a' } }),
    ]);
    expect(deTipo(a, 'mensaje')).toHaveLength(1);
    // Cualquier instancia ve el mismo estado.
    expect(await uno.participantes(ID_SALA)).toEqual(await dos.participantes(ID_SALA));
  });

  it('salir en una instancia: la otra lo ve enseguida y el cupo se libera', async () => {
    const { uno, dos, sala } = dosInstancias();
    const a = conexion();
    const b = conexion();
    await uno.conectar(a, sesion('a'), ID_SALA);
    await dos.conectar(b, sesion('b'), ID_SALA);

    await uno.recibir(ID_SALA, 'a', a, JSON.stringify({ tipo: 'salir' }));
    expect(a.codigo()).toBe(1000);
    expect(deTipo(b, 'salio')).toEqual([{ tipo: 'salio', id: 'a', ocupacion: 1 }]);
    expect(sala.ocupacion).toBe(1);
  });

  it('una conexión perdida no sale enseguida; si no vuelve, su presencia vence y sale una sola vez', async () => {
    const { uno, dos, sala } = dosInstancias({ presenciaMs: 150 });
    const a = conexion();
    const b = conexion();
    await uno.conectar(a, sesion('a'), ID_SALA);
    await dos.conectar(b, sesion('b'), ID_SALA);

    a.cerrar(1006, '');
    await uno.desconectar(ID_SALA, 'a', a, 'perdida');
    expect(deTipo(b, 'salio')).toEqual([]);
    expect(sala.ocupacion).toBe(2);

    await esperar(300);
    await Promise.all([uno.mantener(), dos.mantener()]);
    expect(deTipo(b, 'salio')).toEqual([{ tipo: 'salio', id: 'a', ocupacion: 1 }]);
    expect(sala.ocupacion).toBe(1);
    // La presencia de B se renueva con su latido y no vence.
    expect((await uno.participantes(ID_SALA)).map((p) => p.id)).toEqual(['b']);
    expect(b.abierta).toBe(true);
    uno.detener();
    dos.detener();
  });

  it('la misma persona en dos instancias: una sola presencia y la conexión anterior se cierra', async () => {
    const { uno, dos, sala } = dosInstancias();
    const b = conexion();
    const pestana1 = conexion();
    const pestana2 = conexion();
    await uno.conectar(b, sesion('b'), ID_SALA);
    await uno.conectar(pestana1, sesion('a'), ID_SALA);
    await dos.conectar(pestana2, sesion('a'), ID_SALA);

    expect(pestana1.codigo()).toBe(4000);
    expect(pestana1.mensajes.at(-1)).toMatchObject({ codigo: 'REEMPLAZADA' });
    expect(pestana2.abierta).toBe(true);
    expect(sala.ocupacion).toBe(2);
    expect((await dos.participantes(ID_SALA)).filter((p) => p.id === 'a')).toHaveLength(1);
    expect(deTipo(b, 'entro').filter((m) => m.participante.id === 'a')).toHaveLength(1);

    // Cerrar la pestaña reemplazada no saca a la persona: su presencia es de la otra conexión.
    await uno.desconectar(ID_SALA, 'a', pestana1, 'salida');
    expect(deTipo(b, 'salio')).toEqual([]);
    expect(sala.ocupacion).toBe(2);
  });

  it('reconectarse a otra instancia antes de vencer: misma posición, sin duplicar ni avisar a nadie', async () => {
    const { uno, dos, sala } = dosInstancias({ presenciaMs: 300 });
    const a1 = conexion();
    const b = conexion();
    await uno.conectar(a1, sesion('a'), ID_SALA);
    await dos.conectar(b, sesion('b'), ID_SALA);
    await uno.recibir(ID_SALA, 'a', a1, JSON.stringify({ tipo: 'mover', direccion: 'derecha' }));

    a1.cerrar(1006, '');
    await uno.desconectar(ID_SALA, 'a', a1, 'perdida');
    const a2 = conexion();
    expect(await dos.conectar(a2, sesion('a'), ID_SALA)).toBe('a');

    const [estado] = deTipo(a2, 'estado');
    expect(estado!.participantes.find((p) => p.id === 'a')).toMatchObject({ x: 1, y: 3 });
    expect(estado!.ocupacion).toBe(2);
    expect(sala.ocupacion).toBe(2);
    expect(deTipo(b, 'salio')).toEqual([]);
    expect(deTipo(b, 'entro')).toEqual([]);

    // Pasado el tiempo de vida, la presencia sigue: ahora la renueva la conexión nueva.
    await esperar(450);
    await Promise.all([uno.mantener(), dos.mantener()]);
    expect((await uno.participantes(ID_SALA)).map((p) => p.id).sort()).toEqual(['a', 'b']);
    expect(deTipo(b, 'salio')).toEqual([]);
    uno.detener();
    dos.detener();
  });

  it('12 entradas a la vez repartidas en dos instancias: entran 10 y nunca se pasa la capacidad', async () => {
    const { uno, dos, sala } = dosInstancias();
    const conexiones = Array.from({ length: 12 }, () => conexion());
    const resultados = await Promise.all(
      conexiones.map((c, i) => (i % 2 ? uno : dos).conectar(c, sesion(`u${i}`), ID_SALA)),
    );
    expect(resultados.filter(Boolean)).toHaveLength(10);
    expect(sala.maximoVisto).toBe(10);
    expect(conexiones.filter((c) => c.codigo() === 4429)).toHaveLength(2);
    expect(await uno.participantes(ID_SALA)).toHaveLength(10);
  });

  it('salidas simultáneas desde dos instancias: cada una se anuncia una vez y la ocupación cuadra', async () => {
    const { uno, dos, sala } = dosInstancias();
    const observador = conexion();
    await dos.conectar(observador, sesion('obs'), ID_SALA);
    const personas = ['a', 'b', 'c', 'd'].map((id, i) => ({
      id,
      c: conexion(),
      g: i % 2 ? uno : dos,
    }));
    for (const p of personas) await p.g.conectar(p.c, sesion(p.id), ID_SALA);

    await Promise.all(personas.map((p) => p.g.desconectar(ID_SALA, p.id, p.c)));
    const salidas = deTipo(observador, 'salio');
    expect(salidas.map((m) => m.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(salidas.map((m) => m.ocupacion).sort()).toEqual([1, 2, 3, 4]);
    expect(sala.ocupacion).toBe(1);
  });

  it('la misma persona entrando a la vez por dos instancias queda una sola vez', async () => {
    const { uno, dos, sala } = dosInstancias();
    const p1 = conexion();
    const p2 = conexion();
    await Promise.all([
      uno.conectar(p1, sesion('a'), ID_SALA),
      dos.conectar(p2, sesion('a'), ID_SALA),
    ]);
    expect(sala.ocupacion).toBe(1);
    expect(await uno.participantes(ID_SALA)).toHaveLength(1);
    expect([p1, p2].filter((c) => c.abierta)).toHaveLength(1);
    expect([p1, p2].filter((c) => c.codigo() === 4000)).toHaveLength(1);
  });

  it('reiniciar una instancia no saca a nadie de las demás ni limpia nada al arrancar', async () => {
    const { uno, dos, crear, sala } = dosInstancias();
    const a = conexion();
    const b = conexion();
    await uno.conectar(a, sesion('a'), ID_SALA);
    await dos.conectar(b, sesion('b'), ID_SALA);

    uno.detener();
    expect(a.codigo()).toBe(1001);
    expect(b.abierta).toBe(true);
    expect(deTipo(b, 'salio')).toEqual([]);

    // La instancia «reiniciada» arranca y hace su mantenimiento sin tocar presencias vivas.
    const reiniciada = crear();
    await reiniciada.iniciar();
    await reiniciada.mantener();
    expect((await dos.participantes(ID_SALA)).map((p) => p.id).sort()).toEqual(['a', 'b']);
    expect(sala.ocupacion).toBe(2);

    // Quien estaba en la instancia detenida vuelve por otra, sin salir ni entrar de nuevo.
    const a2 = conexion();
    expect(await reiniciada.conectar(a2, sesion('a'), ID_SALA)).toBe('a');
    expect(sala.ocupacion).toBe(2);
    expect(deTipo(b, 'entro')).toEqual([]);
    reiniciada.detener();
    dos.detener();
  });

  it('si la coordinación falla no sigue con un estado local: cierra para reintentar y luego se recupera', async () => {
    const { gestor: g, memoria, sala } = gestor();
    const a = conexion();
    await g.conectar(a, sesion('a'), ID_SALA);

    memoria.caida = true;
    await g.recibir(ID_SALA, 'a', a, JSON.stringify({ tipo: 'mover', direccion: 'derecha' }));
    expect(a.codigo()).toBe(1011);
    const b = conexion();
    expect(await g.conectar(b, sesion('b'), ID_SALA)).toBeNull();
    expect(b.codigo()).toBe(1011);
    expect(sala.ocupacion).toBe(1);

    memoria.caida = false;
    const a2 = conexion();
    expect(await g.conectar(a2, sesion('a'), ID_SALA)).toBe('a');
    expect(deTipo(a2, 'estado')[0]!.participantes.find((p) => p.id === 'a')).toMatchObject({
      x: 0,
      y: 3,
    });
    expect(sala.ocupacion).toBe(1);
  });

  it('cada sala tiene su canal: lo de una no llega a otra aunque el mensaje nombre la otra sala', async () => {
    const { uno, dos } = dosInstancias();
    const a = conexion();
    const b = conexion();
    await uno.conectar(a, sesion('a'), ID_SALA);
    await dos.conectar(b, sesion('b'), ID_OTRA_SALA);

    await uno.recibir(
      ID_SALA,
      'a',
      a,
      JSON.stringify({ tipo: 'mensaje', texto: 'Hola', idSala: ID_OTRA_SALA }),
    );
    await uno.recibir(
      ID_SALA,
      'a',
      a,
      JSON.stringify({ tipo: 'mover', direccion: 'derecha', sala: ID_OTRA_SALA }),
    );
    // La conexión de A no sirve para actuar en otra sala.
    await uno.recibir(ID_OTRA_SALA, 'a', a, JSON.stringify({ tipo: 'mensaje', texto: 'Colado' }));
    await dos.recibir(ID_OTRA_SALA, 'a', a, JSON.stringify({ tipo: 'mensaje', texto: 'Colado' }));

    expect(b.mensajes.filter((m) => m.tipo !== 'estado')).toEqual([]);
    expect(deTipo(a, 'mensaje').map((m) => m.texto)).toEqual(['Hola']);
    expect((await dos.participantes(ID_OTRA_SALA)).map((p) => p.id)).toEqual(['b']);
  });

  it('descarta eventos repetidos o anteriores a su estado', async () => {
    const { gestor: g, memoria } = gestor();
    const a = conexion();
    const b = conexion();
    await g.conectar(a, sesion('a'), ID_SALA);
    await g.conectar(b, sesion('b'), ID_SALA);

    const vistos: EventoSala[] = [];
    const espia = (evento: EventoSala) => vistos.push(evento);
    memoria.canales.get(ID_SALA)!.add(espia);
    await g.recibir(ID_SALA, 'a', a, JSON.stringify({ tipo: 'mover', direccion: 'derecha' }));
    memoria.canales.get(ID_SALA)!.delete(espia);

    // Volver a entregar el mismo evento (o uno viejo) no llega dos veces.
    for (const manejador of memoria.canales.get(ID_SALA)!) {
      for (const evento of vistos) manejador(evento);
      manejador({ seq: 1, mensaje: { tipo: 'movio', id: 'a', x: 5, y: 0 } });
    }
    expect(deTipo(b, 'movio')).toEqual([{ tipo: 'movio', id: 'a', x: 1, y: 3 }]);
  });
});
