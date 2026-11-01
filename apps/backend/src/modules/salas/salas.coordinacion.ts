import { randomUUID } from 'node:crypto';
import type { Posicion } from './salas.escenario.js';
import type { MensajeServidor } from './salas.protocolo.js';
import type { Participante } from './salas.repository.js';

/**
 * Estado compartido de las salas en tiempo real entre instancias del backend. Una presencia dice
 * quién está en una sala, dónde está su avatar y qué conexión (de qué instancia) la sostiene.
 * Vence sola si nadie la renueva (latido): así una instancia caída no deja a nadie dentro.
 *
 * Dos implementaciones con el mismo contrato (test/coordinacion.contrato.ts): Redis, para varias
 * instancias (salas.coordinacion.redis.ts), y esta en memoria, para pruebas y para un solo
 * backend local sin Redis. La base de datos sigue siendo la autoridad de cupos e historial.
 */
export type Presencia = {
  participante: Participante;
  posicion: Posicion;
  conexion: string;
  instancia: string;
};

/** Evento de una sala entre instancias. `seq` crece por sala: ordena y descarta repetidos. */
export type EventoSala = { seq: number; mensaje: MensajeServidor };

/** Órdenes entre instancias; no llegan a los navegadores. */
export type OrdenControl =
  | {
      tipo: 'cerrar';
      conexion: string;
      codigo: number;
      error: { codigo: string; mensaje: string };
    }
  | { tipo: 'olvidar'; idSala: string };

/** Resultado de una acción que solo puede hacer la conexión dueña de la presencia. */
export type Propiedad = 'ok' | 'reemplazada' | 'sin_presencia';

export type CoordinacionSalas = {
  /** Identificador de esta instancia del backend. */
  readonly instancia: string;
  /** Conecta y escucha las órdenes entre instancias. Idempotente. */
  iniciar(manejadores: {
    alOrden: (orden: OrdenControl) => void;
    alReconectar: () => void;
  }): Promise<void>;
  /** Exclusión por persona y sala mientras entra o sale, desde cualquier instancia. */
  conBloqueo<T>(idSala: string, idUsuario: string, tarea: () => Promise<T>): Promise<T>;
  presencia(idSala: string, idUsuario: string): Promise<Presencia | null>;
  /** Alta de una presencia nueva y aviso «entro» a la sala, en un solo paso. Devuelve la ocupación. */
  registrar(idSala: string, presencia: Presencia, aviso: MensajeServidor): Promise<number>;
  /** Pasa la presencia a otra conexión (otra pestaña o una reconexión). null si no había. */
  reemplazar(
    idSala: string,
    idUsuario: string,
    conexion: string,
    instancia: string,
  ): Promise<Presencia | null>;
  /**
   * Quita la presencia y avisa «salio», en un solo paso. Con `conexion`, solo si esa conexión la
   * sostiene; con `soloVencida`, solo si nadie la renovó a tiempo. null si no quitó nada.
   */
  retirar(
    idSala: string,
    idUsuario: string,
    aviso: MensajeServidor,
    condiciones?: { conexion?: string; soloVencida?: boolean },
  ): Promise<{ presencia: Presencia; ocupacion: number } | null>;
  /** Renueva las presencias de estas conexiones. Devuelve las que ya no son dueñas. */
  renovar(
    conexiones: { idSala: string; idUsuario: string; conexion: string }[],
  ): Promise<{ conexion: string; estado: Exclude<Propiedad, 'ok'> }[]>;
  vencidas(): Promise<{ idSala: string; idUsuario: string }[]>;
  presentes(): Promise<{ idSala: string; idUsuario: string }[]>;
  mover(
    idSala: string,
    idUsuario: string,
    conexion: string,
    posicion: Posicion,
    aviso: MensajeServidor,
  ): Promise<Propiedad>;
  publicar(
    idSala: string,
    idUsuario: string,
    conexion: string,
    mensaje: MensajeServidor,
  ): Promise<Propiedad>;
  /** Presencias de la sala y el `seq` de su último evento, leídos a la vez. */
  instantanea(idSala: string): Promise<{ seq: number; presencias: Presencia[] }>;
  suscribir(idSala: string, alEvento: (evento: EventoSala) => void): Promise<void>;
  desuscribir(idSala: string): Promise<void>;
  /** Envía una orden a todas las instancias (incluida esta). */
  ordenar(orden: OrdenControl): Promise<void>;
  cerrar(): Promise<void>;
};

/** Con `ocupacion` en el aviso, la coordinación pone la ocupación real tras el cambio. */
export function conOcupacion(mensaje: MensajeServidor, ocupacion: number): MensajeServidor {
  return 'ocupacion' in mensaje ? { ...mensaje, ocupacion } : mensaje;
}

type SalaMemoria = {
  presencias: Map<string, Presencia & { vence: number }>;
  seq: number;
};

/** Estado compartido por las coordinaciones en memoria de un mismo proceso (instancias simuladas). */
export function crearMemoriaCompartida() {
  return {
    salas: new Map<string, SalaMemoria>(),
    canales: new Map<string, Set<(evento: EventoSala) => void>>(),
    control: new Set<(orden: OrdenControl) => void>(),
    bloqueos: new Map<string, Promise<void>>(),
    /** Simula que Redis no responde (pruebas de caída). */
    caida: false,
  };
}
export type MemoriaCompartida = ReturnType<typeof crearMemoriaCompartida>;

/**
 * Coordinación en memoria: correcta para un solo proceso. Varias coordinaciones creadas sobre la
 * misma `memoria` simulan instancias distintas (pruebas). Las entregas son síncronas.
 */
export function crearCoordinacionMemoria({
  presenciaMs,
  memoria = crearMemoriaCompartida(),
}: {
  presenciaMs: number;
  memoria?: MemoriaCompartida;
}): CoordinacionSalas {
  const instancia = randomUUID();
  const propias = new Map<string, (evento: EventoSala) => void>();
  let alOrden: ((orden: OrdenControl) => void) | null = null;

  const disponible = () => {
    if (memoria.caida) throw new Error('La coordinación de salas no está disponible.');
  };
  const sala = (idSala: string) => {
    let actual = memoria.salas.get(idSala);
    if (!actual) memoria.salas.set(idSala, (actual = { presencias: new Map(), seq: 0 }));
    return actual;
  };
  const copia = ({ vence: _vence, ...presencia }: Presencia & { vence: number }): Presencia => ({
    ...presencia,
    posicion: { ...presencia.posicion },
  });
  const difundir = (idSala: string, mensaje: MensajeServidor) => {
    const evento = { seq: ++sala(idSala).seq, mensaje };
    for (const alEvento of memoria.canales.get(idSala) ?? []) alEvento(evento);
  };
  const propiedad = (idSala: string, idUsuario: string, conexion: string): Propiedad => {
    const actual = memoria.salas.get(idSala)?.presencias.get(idUsuario);
    if (!actual) return 'sin_presencia';
    return actual.conexion === conexion ? 'ok' : 'reemplazada';
  };
  const desuscribir = (idSala: string) => {
    const alEvento = propias.get(idSala);
    if (!alEvento) return;
    propias.delete(idSala);
    memoria.canales.get(idSala)?.delete(alEvento);
  };

  return {
    instancia,

    async iniciar(manejadores) {
      disponible();
      if (alOrden) return;
      alOrden = manejadores.alOrden;
      memoria.control.add(alOrden);
    },

    async conBloqueo(idSala, idUsuario, tarea) {
      const clave = `${idSala}|${idUsuario}`;
      const anterior = memoria.bloqueos.get(clave) ?? Promise.resolve();
      let soltar!: () => void;
      const propio = anterior.then(() => new Promise<void>((resolver) => (soltar = resolver)));
      memoria.bloqueos.set(clave, propio);
      await anterior;
      try {
        return await tarea();
      } finally {
        soltar();
        if (memoria.bloqueos.get(clave) === propio) memoria.bloqueos.delete(clave);
      }
    },

    async presencia(idSala, idUsuario) {
      disponible();
      const actual = memoria.salas.get(idSala)?.presencias.get(idUsuario);
      return actual ? copia(actual) : null;
    },

    async registrar(idSala, presencia, aviso) {
      disponible();
      const actual = sala(idSala);
      actual.presencias.set(presencia.participante.id, {
        ...presencia,
        posicion: { ...presencia.posicion },
        vence: Date.now() + presenciaMs,
      });
      difundir(idSala, conOcupacion(aviso, actual.presencias.size));
      return actual.presencias.size;
    },

    async reemplazar(idSala, idUsuario, conexion, nueva) {
      disponible();
      const actual = memoria.salas.get(idSala)?.presencias.get(idUsuario);
      if (!actual) return null;
      const previa = copia(actual);
      Object.assign(actual, { conexion, instancia: nueva, vence: Date.now() + presenciaMs });
      return previa;
    },

    async retirar(idSala, idUsuario, aviso, { conexion, soloVencida = false } = {}) {
      disponible();
      const actual = memoria.salas.get(idSala);
      const presencia = actual?.presencias.get(idUsuario);
      if (!actual || !presencia) return null;
      if (conexion !== undefined && presencia.conexion !== conexion) return null;
      if (soloVencida && presencia.vence > Date.now()) return null;
      actual.presencias.delete(idUsuario);
      const ocupacion = actual.presencias.size;
      difundir(idSala, conOcupacion(aviso, ocupacion));
      return { presencia: copia(presencia), ocupacion };
    },

    async renovar(conexiones) {
      disponible();
      const perdidas: { conexion: string; estado: Exclude<Propiedad, 'ok'> }[] = [];
      for (const { idSala, idUsuario, conexion } of conexiones) {
        const estado = propiedad(idSala, idUsuario, conexion);
        if (estado === 'ok') {
          memoria.salas.get(idSala)!.presencias.get(idUsuario)!.vence = Date.now() + presenciaMs;
        } else perdidas.push({ conexion, estado });
      }
      return perdidas;
    },

    async vencidas() {
      disponible();
      const ahora = Date.now();
      return [...memoria.salas].flatMap(([idSala, { presencias }]) =>
        [...presencias.values()]
          .filter((p) => p.vence <= ahora)
          .map((p) => ({ idSala, idUsuario: p.participante.id })),
      );
    },

    async presentes() {
      disponible();
      return [...memoria.salas].flatMap(([idSala, { presencias }]) =>
        [...presencias.keys()].map((idUsuario) => ({ idSala, idUsuario })),
      );
    },

    async mover(idSala, idUsuario, conexion, posicion, aviso) {
      disponible();
      const estado = propiedad(idSala, idUsuario, conexion);
      if (estado !== 'ok') return estado;
      memoria.salas.get(idSala)!.presencias.get(idUsuario)!.posicion = { ...posicion };
      difundir(idSala, aviso);
      return estado;
    },

    async publicar(idSala, idUsuario, conexion, mensaje) {
      disponible();
      const estado = propiedad(idSala, idUsuario, conexion);
      if (estado === 'ok') difundir(idSala, mensaje);
      return estado;
    },

    async instantanea(idSala) {
      disponible();
      const actual = memoria.salas.get(idSala);
      return {
        seq: actual?.seq ?? 0,
        presencias: [...(actual?.presencias.values() ?? [])].map(copia),
      };
    },

    async suscribir(idSala, alEvento) {
      disponible();
      const previa = propias.get(idSala);
      if (previa) memoria.canales.get(idSala)?.delete(previa);
      propias.set(idSala, alEvento);
      let canal = memoria.canales.get(idSala);
      if (!canal) memoria.canales.set(idSala, (canal = new Set()));
      canal.add(alEvento);
    },

    async desuscribir(idSala) {
      desuscribir(idSala);
    },

    async ordenar(orden) {
      disponible();
      for (const manejador of memoria.control) manejador(orden);
    },

    async cerrar() {
      for (const idSala of [...propias.keys()]) desuscribir(idSala);
      if (alOrden) memoria.control.delete(alOrden);
      alOrden = null;
    },
  };
}
