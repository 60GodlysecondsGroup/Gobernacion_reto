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
  type Escenario,
} from '../src/modules/salas/salas.escenario.js';
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
    ocupacion: 0,
    vaciaDesde: 0,
    maximoVisto: 0,
  };
  const posiciones = new Map<string, { x: number; y: number }>();
  const pausa = () => new Promise((r) => setTimeout(r, Math.random() * 5));

  const repositorio: RepositorioSalas = {
    listar: async () => [],
    porId: async (idComunidad, idSala) =>
      idComunidad === 'comunidad-B' && idSala === ID_SALA
        ? {
            id: ID_SALA,
            nombre: 'Sala de prueba',
            tematica: 'Bienestar cotidiano',
            descripcion: '',
            reglas: '',
            capacidad,
            ocupacion: sala.ocupacion,
            estado: sala.estado as 'disponible',
            idComunidad,
            instanciaVigente: null,
          }
        : null,
    escenario: async () => ESCENARIO,
    participante: async (id) => ({ id, alias: `Alias-${id}`, avatar: null }),
    ocupar: async () => {
      await pausa();
      if (sala.estado === 'cerrada') return { resultado: 'cerrada' };
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
    reconciliar: async () => [],
  };
  return { repositorio, sala, posiciones };
}

const ID_SALA = '11111111-1111-4111-8111-111111111111';
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

function gestor(opciones: { cierreSegundos?: number; capacidad?: number } = {}) {
  const falso = repositorioFalso(opciones.capacidad);
  const dlp = crearServicioDlp({
    repositorio: { reglasActivas: async () => reglas, registrarEvento: async () => {} },
    logger,
  });
  const g = crearGestorSalas({
    repositorio: falso.repositorio,
    comunidades,
    dlp,
    logger,
    cierreSegundos: opciones.cierreSegundos ?? 180,
    intervaloMovimientoMs: 0,
    intervaloMensajeMs: 0,
    retrasoGuardadoMs: 10,
  });
  return { gestor: g, ...falso };
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
    expect(g.participantes(ID_SALA)).toHaveLength(10);
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
    expect(g.participantes(ID_SALA).find((p) => p.id === 'a')).toMatchObject({ x: 1, y: 3 });
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
    expect(g.participantes(ID_SALA).find((p) => p.id === 'a')).toMatchObject({ x: 0, y: 3 });
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
    expect(g.participantes(ID_SALA)[0]).toMatchObject({ x: 0, y: 3 });
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
    expect(g.participantes(ID_SALA)).toHaveLength(1);
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
    expect(g.participantes(ID_SALA)).toHaveLength(1);
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
});
