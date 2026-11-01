import { randomUUID } from 'node:crypto';
import { ErrorApp } from '../../http/errores.js';
import { esUuid } from '../../http/validacion.js';
import type { Logger } from '../../lib/logger.js';
import type { ServicioComunidad } from '../comunidad/comunidad.service.js';
import type { ServicioDlp } from '../dlp/dlp.service.js';
import { tienePermiso } from '../seguridad/permisos.js';
import type { Sesion } from '../seguridad/sesion.service.js';
import type {
  CoordinacionSalas,
  EventoSala,
  OrdenControl,
  Presencia,
  Propiedad,
} from './salas.coordinacion.js';
import {
  DIRECCIONES,
  mover,
  puntoDeAparicion,
  ruta,
  type Direccion,
  type Escenario,
  type Posicion,
} from './salas.escenario.js';
import { CIERRE, type MensajeServidor } from './salas.protocolo.js';
import type { Participante, RepositorioSalas } from './salas.repository.js';

/** Lo que el gestor necesita de una conexión: enviar, cerrar y saber si sigue abierta. */
export type Conexion = {
  /** Identifica esta conexión, no a la persona: al reconectarse, la misma persona trae otra. */
  readonly id: string;
  enviar(mensaje: MensajeServidor): void;
  cerrar(codigo: number, motivo: string): void;
  readonly abierta: boolean;
};

type DatosSala = { id: string; nombre: string; tematica: string; capacidad: number };

/**
 * Una conexión de esta instancia dentro de una sala. Aquí solo vive lo que es de la conexión
 * (ritmo, recorrido en curso, eventos por entregar); quién está en la sala y dónde lo guarda
 * la coordinación, compartida por todas las instancias.
 */
type Local = {
  conexion: Conexion;
  idUsuario: string;
  sala: DatosSala;
  escenario: Escenario;
  /** null mientras entra: todavía no tiene presencia en la sala. */
  participante: Participante | null;
  posicion: Posicion;
  ultimoMovimiento: number;
  ultimoMensaje: number;
  /** Último evento de la sala entregado: los repetidos o anteriores al estado se descartan. */
  ultimoSeq: number;
  /** Eventos llegados mientras se arma el estado: se entregan después, en orden. */
  pendientes: EventoSala[] | null;
  guardado?: NodeJS.Timeout;
  /** Recorrido por clic en curso (F40): un paso por temporizador. */
  recorrido?: NodeJS.Timeout;
  /** Cambia con cada recorrido nuevo o cancelado: un paso en vuelo sabe si sigue vigente. */
  vueltaRecorrido: number;
};

type Dependencias = {
  repositorio: RepositorioSalas;
  comunidades: ServicioComunidad;
  dlp: ServicioDlp;
  logger: Logger;
  /** Estado compartido entre instancias (Redis) o de un solo proceso (memoria). */
  coordinacion: CoordinacionSalas;
  cierreSegundos: number;
  /** Cada cuánto se renuevan las presencias propias y se limpian las vencidas. */
  latidoMs: number;
  /** Vida de una presencia sin renovar: el margen para reconectarse sin salir de la sala. */
  presenciaMs: number;
  /** Mínimo entre dos movimientos de una misma persona (evita ráfagas). */
  intervaloMovimientoMs?: number;
  /** Mínimo entre dos mensajes de chat de una misma persona. */
  intervaloMensajeMs?: number;
  /** Las posiciones se guardan en la base agrupadas, como mucho una vez por este intervalo. */
  retrasoGuardadoMs?: number;
  /** Tiempo entre dos pasos de un recorrido por clic (F40). */
  intervaloPasoMs?: number;
};

const LARGO_MAXIMO_MENSAJE = 500;
/** Sin respuesta de la coordinación en este tiempo, quien entra recibe un error y reintenta. */
const ESPERA_INICIO_MS = 5_000;

const MENSAJE_NO_DISPONIBLE = 'Esta sala no está disponible en este momento.';
const MENSAJE_REEMPLAZADA = 'Entraste a esta sala desde otra pestaña.';

const aParticipante = (presencia: Presencia) => ({
  ...presencia.participante,
  ...presencia.posicion,
});

function conLimite<T>(promesa: Promise<T>, ms: number, mensaje: string): Promise<T> {
  let temporizador: NodeJS.Timeout | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error(mensaje)), ms);
    temporizador.unref();
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}

/**
 * Salas en tiempo real (F11–F15, F38, F39, F41). El servidor es la autoridad: decide quién
 * está, dónde está cada avatar y qué movimientos son válidos. El cliente solo envía intenciones.
 *
 * Con varias instancias, cada una atiende sus conexiones y comparte el resto por la
 * coordinación: la presencia de cada persona (que vence si nadie la renueva), los eventos de
 * cada sala (Pub/Sub, con `seq`) y las órdenes entre instancias. La base sigue siendo la
 * autoridad de cupos (RF10), historial y última posición.
 */
export function crearGestorSalas({
  repositorio,
  comunidades,
  dlp,
  logger,
  coordinacion,
  cierreSegundos,
  latidoMs,
  presenciaMs,
  intervaloMovimientoMs = 60,
  intervaloMensajeMs = 500,
  retrasoGuardadoMs = 300,
  intervaloPasoMs = 140,
}: Dependencias) {
  const locales = new Map<string, Local>();
  /** Conexiones locales por sala y la suscripción a su canal (una por sala e instancia). */
  const porSala = new Map<string, { conexiones: Set<Local>; suscripcion: Promise<void> }>();
  /** Escenarios ya leídos de la base (se invalidan con «olvidar» desde cualquier instancia). */
  const escenarios = new Map<string, Promise<Escenario>>();
  const cierres = new Map<string, NodeJS.Timeout>();
  let detenido = false;
  let inicio: Promise<void> | null = null;
  let mantenimiento: NodeJS.Timeout | null = null;
  let manteniendo = false;
  /** Tras una caída de Redis no se barren vencidas hasta que todas las instancias renueven. */
  let barrerDesde = 0;

  const rechazar = (conexion: Conexion, codigo: string, mensaje: string, cierre: number) => {
    conexion.enviar({ tipo: 'error', codigo, mensaje });
    conexion.cerrar(cierre, codigo);
  };

  /** Conecta la coordinación y empieza el mantenimiento. Idempotente; reintenta si falló. */
  function iniciar() {
    if (!inicio) {
      inicio = coordinacion.iniciar({ alOrden, alReconectar }).then(() => {
        if (detenido || mantenimiento) return;
        mantenimiento = setInterval(() => void mantener(), latidoMs);
        mantenimiento.unref();
      });
      inicio.catch(() => {
        inicio = null;
      });
    }
    return conLimite(inicio, ESPERA_INICIO_MS, 'La coordinación de salas no responde.');
  }

  function alOrden(orden: OrdenControl) {
    if (orden.tipo === 'olvidar') {
      escenarios.delete(orden.idSala);
      return;
    }
    const local = locales.get(orden.conexion);
    if (local && quitarLocal(local)) {
      rechazar(local.conexion, orden.error.codigo, orden.error.mensaje, orden.codigo);
    }
  }

  /** Pub/Sub no guarda lo que se publicó durante la caída: cada conexión recibe el estado de nuevo. */
  function alReconectar() {
    barrerDesde = Date.now() + presenciaMs;
    for (const local of locales.values()) {
      if (local.participante)
        void enviarEstado(local).catch((error) => fallaTiempoReal(local, error));
    }
  }

  function escenarioDe(idSala: string) {
    let escenario = escenarios.get(idSala);
    if (!escenario) {
      const leido = repositorio.escenario(idSala).then((e) => {
        if (!e) throw new Error(`La sala ${idSala} no tiene escenario`);
        return e;
      });
      escenarios.set(idSala, (escenario = leido));
      leido.catch(() => {
        if (escenarios.get(idSala) === leido) escenarios.delete(idSala);
      });
    }
    return escenario;
  }

  function alEvento(idSala: string, evento: EventoSala) {
    for (const local of porSala.get(idSala)?.conexiones ?? []) entregar(local, evento);
  }

  function entregar(local: Local, evento: EventoSala) {
    if (local.pendientes) {
      local.pendientes.push(evento);
      return;
    }
    if (evento.seq <= local.ultimoSeq) return;
    local.ultimoSeq = evento.seq;
    const { mensaje } = evento;
    // Quien entra recibe el estado completo, no el aviso de su propia entrada.
    if (mensaje.tipo === 'entro' && mensaje.participante.id === local.idUsuario) return;
    local.conexion.enviar(mensaje);
  }

  /** Registra la conexión y espera a estar suscrita al canal de su sala. */
  async function agregarLocal(local: Local) {
    locales.set(local.conexion.id, local);
    const idSala = local.sala.id;
    let sala = porSala.get(idSala);
    if (!sala) {
      const nueva = {
        conexiones: new Set<Local>(),
        suscripcion: coordinacion.suscribir(idSala, (evento) => alEvento(idSala, evento)),
      };
      porSala.set(idSala, (sala = nueva));
      nueva.suscripcion.catch(() => {
        if (porSala.get(idSala) === nueva) porSala.delete(idSala);
      });
    }
    sala.conexiones.add(local);
    await sala.suscripcion;
  }

  /** Olvida la conexión en esta instancia. Devuelve false si ya no estaba. */
  function quitarLocal(local: Local) {
    clearTimeout(local.guardado);
    cancelarRecorrido(local);
    if (!locales.delete(local.conexion.id)) return false;
    const idSala = local.sala.id;
    const sala = porSala.get(idSala);
    if (sala?.conexiones.delete(local) && sala.conexiones.size === 0) {
      porSala.delete(idSala);
      coordinacion
        .desuscribir(idSala)
        .catch((error) =>
          logger.warn('No se pudo dejar el canal de una sala', { error: String(error) }),
        );
    }
    return true;
  }

  /** Envía el estado completo de la sala y luego, en orden, lo que llegó mientras tanto. */
  async function enviarEstado(local: Local) {
    local.pendientes ??= [];
    const { seq, presencias } = await coordinacion.instantanea(local.sala.id);
    if (!locales.has(local.conexion.id)) return;
    const propia = presencias.find((p) => p.participante.id === local.idUsuario);
    if (!propia || propia.conexion !== local.conexion.id) {
      perderLugar(local, propia ? 'reemplazada' : 'sin_presencia');
      return;
    }
    local.posicion = propia.posicion;
    local.conexion.enviar({
      tipo: 'estado',
      yo: local.idUsuario,
      sala: local.sala,
      escenario: {
        ancho: local.escenario.ancho,
        alto: local.escenario.alto,
        obstaculos: local.escenario.obstaculos,
      },
      participantes: presencias.map(aParticipante),
      ocupacion: presencias.length,
    });
    const pendientes = local.pendientes;
    local.pendientes = null;
    local.ultimoSeq = seq;
    for (const evento of pendientes) entregar(local, evento);
  }

  /** La conexión ya no sostiene la presencia: otra pestaña la tomó, o venció sin renovarse. */
  function perderLugar(local: Local, estado: Exclude<Propiedad, 'ok'>) {
    if (!quitarLocal(local)) return;
    if (estado === 'reemplazada') {
      rechazar(local.conexion, 'REEMPLAZADA', MENSAJE_REEMPLAZADA, CIERRE.REEMPLAZADA);
    } else {
      local.conexion.cerrar(CIERRE.REINTENTAR, 'PRESENCIA_VENCIDA');
    }
  }

  /**
   * Sin coordinación no hay sala compartida: se cierra la conexión (el cliente reintenta) en vez
   * de seguir con un estado que las demás instancias no ven. La presencia vence sola.
   */
  function fallaTiempoReal(local: Local, error: unknown) {
    logger.warn('Falló el tiempo real de una sala', { sala: local.sala.id, error: String(error) });
    if (quitarLocal(local))
      local.conexion.cerrar(CIERRE.ERROR_INTERNO, 'TIEMPO_REAL_NO_DISPONIBLE');
  }

  /** Cierra una conexión esté en esta instancia o en otra. */
  async function cerrarConexion(
    idConexion: string,
    error: { codigo: string; mensaje: string },
    cierre: number,
  ) {
    const local = locales.get(idConexion);
    if (local) {
      if (quitarLocal(local)) rechazar(local.conexion, error.codigo, error.mensaje, cierre);
      return;
    }
    await coordinacion.ordenar({ tipo: 'cerrar', conexion: idConexion, codigo: cierre, error });
  }

  function cancelarCierre(idSala: string) {
    clearTimeout(cierres.get(idSala));
    cierres.delete(idSala);
  }

  /** F13: con 0 personas empieza el contador; si nadie entra antes, la instancia se cierra. */
  function programarCierre(idSala: string, enMs: number) {
    if (detenido) return;
    cancelarCierre(idSala);
    const temporizador = setTimeout(() => void intentarCierre(idSala), Math.max(0, enMs) + 250);
    temporizador.unref();
    cierres.set(idSala, temporizador);
  }

  /** La base decide: solo cierra si sigue vacía desde hace `cierreSegundos` (ninguna entrada en curso). */
  async function intentarCierre(idSala: string) {
    cierres.delete(idSala);
    if (detenido) return;
    try {
      const resultado = await repositorio.cerrarSiVacia(idSala, cierreSegundos);
      if (resultado.cerrada) {
        escenarios.delete(idSala);
        logger.info('Sala cerrada por inactividad', {
          sala: idSala,
          nuevaInstancia: resultado.nueva,
        });
      } else if (resultado.sigueVacia) {
        programarCierre(idSala, 1000);
      }
    } catch (error) {
      logger.error('No se pudo cerrar la sala', { sala: idSala, error: String(error) });
    }
  }

  async function liberarCupo(idSala: string, idUsuario: string) {
    if (detenido) return;
    try {
      const ocupacion = await repositorio.liberar(idSala, idUsuario);
      if (ocupacion === 0) programarCierre(idSala, cierreSegundos * 1000);
    } catch (error) {
      logger.error('No se pudo registrar la salida de una sala', {
        sala: idSala,
        error: String(error),
      });
    }
  }

  /** Quita la presencia (si se cumplen las condiciones), avisa a la sala y libera el cupo. */
  function retirarPresencia(
    idSala: string,
    idUsuario: string,
    condiciones: { conexion?: string; soloVencida?: boolean } = {},
  ) {
    return coordinacion.conBloqueo(idSala, idUsuario, async () => {
      const salida = await coordinacion.retirar(
        idSala,
        idUsuario,
        { tipo: 'salio', id: idUsuario, ocupacion: 0 },
        condiciones,
      );
      if (salida) await liberarCupo(idSala, idUsuario);
      return salida;
    });
  }

  /**
   * Dentro del bloqueo de la persona: retoma su presencia (otra pestaña o una reconexión, sin
   * otro cupo) o entra ocupando un cupo nuevo, ubica su avatar y avisa a los demás.
   */
  async function tomarLugar(local: Local) {
    const { conexion, idUsuario: yo, sala } = local;
    if (!conexion.abierta) return { resultado: 'abandonada' } as const;

    const previa = await coordinacion.reemplazar(sala.id, yo, conexion.id, coordinacion.instancia);
    if (previa) {
      local.participante = previa.participante;
      local.posicion = previa.posicion;
      return { resultado: 'retomada', previa } as const;
    }

    const entrada = await repositorio.ocupar(sala.id, yo);
    if (entrada.resultado !== 'ok') return { resultado: entrada.resultado } as const;
    cancelarCierre(sala.id);

    const participante = await repositorio.participante(yo);
    const { presencias } = await coordinacion.instantanea(sala.id);
    const posicion = puntoDeAparicion(
      local.escenario,
      presencias.map((p) => p.posicion),
    );
    await repositorio.guardarPosicion(sala.id, yo, posicion);
    if (!conexion.abierta) {
      await liberarCupo(sala.id, yo);
      return { resultado: 'abandonada' } as const;
    }
    try {
      await coordinacion.registrar(
        sala.id,
        { participante, posicion, conexion: conexion.id, instancia: coordinacion.instancia },
        { tipo: 'entro', participante: { ...participante, ...posicion }, ocupacion: 0 },
      );
    } catch (error) {
      await liberarCupo(sala.id, yo);
      throw error;
    }
    local.participante = participante;
    local.posicion = posicion;
    return { resultado: 'nueva' } as const;
  }

  /**
   * Conecta a una persona a una sala. Devuelve su id si entró, o null si se rechazó.
   * La sala debe ser de su comunidad: si no, responde igual que si no existiera (AV-12).
   */
  async function conectar(conexion: Conexion, sesion: Sesion | null, idSala: string) {
    if (!sesion) {
      rechazar(conexion, 'NO_AUTENTICADO', 'Debes iniciar sesión.', CIERRE.NO_AUTENTICADO);
      return null;
    }
    if (!tienePermiso(sesion.rol, 'acceder_salas') || !sesion.rango) {
      rechazar(conexion, 'PROHIBIDO', 'Tu usuario no puede entrar a salas.', CIERRE.PROHIBIDO);
      return null;
    }

    let local: Local | null = null;
    try {
      const comunidad = await comunidades.obtenerPropia(sesion);
      const detalle = esUuid(idSala) ? await repositorio.porId(comunidad.id, idSala) : null;
      if (!detalle) {
        rechazar(conexion, 'NO_ENCONTRADA', 'La sala no existe.', CIERRE.NO_ENCONTRADA);
        return null;
      }
      if (detalle.estado === 'cerrada') {
        rechazar(
          conexion,
          'SALA_CERRADA',
          'Esta sala se cerró. Vuelve a la lista de salas.',
          CIERRE.CERRADA,
        );
        return null;
      }
      if (!detalle.habilitada) {
        rechazar(conexion, 'SALA_NO_DISPONIBLE', MENSAJE_NO_DISPONIBLE, CIERRE.RETIRADA);
        return null;
      }

      await iniciar();
      const escenario = await escenarioDe(detalle.id);
      local = {
        conexion,
        idUsuario: sesion.idUsuario,
        sala: {
          id: detalle.id,
          nombre: detalle.nombre,
          tematica: detalle.tematica,
          capacidad: detalle.capacidad,
        },
        escenario,
        participante: null,
        posicion: escenario.aparicion,
        ultimoMovimiento: 0,
        ultimoMensaje: 0,
        ultimoSeq: 0,
        pendientes: [],
        vueltaRecorrido: 0,
      };
      // Suscrita antes de entrar: ningún evento de la sala se pierde entre la entrada y el estado.
      await agregarLocal(local);

      // Una persona entra o sale de una sala de a una vez, aunque lo intente desde dos
      // instancias (otra pestaña, o el doble montaje de React en desarrollo).
      const lugar = await coordinacion.conBloqueo(detalle.id, sesion.idUsuario, () =>
        tomarLugar(local!),
      );
      switch (lugar.resultado) {
        case 'abandonada':
          quitarLocal(local);
          return null;
        case 'llena':
          quitarLocal(local);
          rechazar(conexion, 'SALA_LLENA', 'La sala está llena.', CIERRE.LLENA);
          return null;
        case 'cerrada':
          quitarLocal(local);
          rechazar(
            conexion,
            'SALA_CERRADA',
            'Esta sala se cerró. Vuelve a la lista de salas.',
            CIERRE.CERRADA,
          );
          return null;
        case 'deshabilitada':
          quitarLocal(local);
          rechazar(conexion, 'SALA_NO_DISPONIBLE', MENSAJE_NO_DISPONIBLE, CIERRE.RETIRADA);
          return null;
        case 'retomada':
          if (lugar.previa.conexion !== conexion.id) {
            await cerrarConexion(
              lugar.previa.conexion,
              { codigo: 'REEMPLAZADA', mensaje: MENSAJE_REEMPLAZADA },
              CIERRE.REEMPLAZADA,
            );
          }
          break;
      }
      await enviarEstado(local);
      return sesion.idUsuario;
    } catch (error) {
      if (local) quitarLocal(local);
      if (error instanceof ErrorApp && error.estado === 403) {
        rechazar(conexion, 'PROHIBIDO', error.message, CIERRE.PROHIBIDO);
        return null;
      }
      logger.error('Error al entrar a una sala', { sala: idSala, error: String(error) });
      rechazar(
        conexion,
        'ERROR_INTERNO',
        'No pudimos abrir la sala. Intenta de nuevo.',
        CIERRE.ERROR_INTERNO,
      );
      return null;
    }
  }

  /**
   * F15 y punto 4 de la Fase 5: salir libera el cupo enseguida. Si la conexión se perdió, la
   * presencia sigue hasta vencer: si la persona vuelve antes, sigue en la sala sin que se note.
   */
  async function desconectar(
    idSala: string,
    idUsuario: string,
    conexion: Conexion,
    motivo: 'salida' | 'perdida' = 'salida',
  ) {
    const local = locales.get(conexion.id);
    if (!local || local.sala.id !== idSala || local.idUsuario !== idUsuario) return;
    // Si la conexión fue reemplazada o retirada, ya no está aquí y no libera nada.
    if (!quitarLocal(local) || motivo === 'perdida' || detenido) return;
    try {
      await retirarPresencia(idSala, idUsuario, { conexion: conexion.id });
    } catch (error) {
      logger.warn('No se pudo registrar una salida; la presencia vencerá sola', {
        sala: idSala,
        error: String(error),
      });
    }
  }

  function cancelarRecorrido(local: Local) {
    clearTimeout(local.recorrido);
    local.recorrido = undefined;
    local.vueltaRecorrido++;
  }

  /** Un paso de teclado (WASD) o de un recorrido. Devuelve si el avatar se movió. */
  async function moverParticipante(
    local: Local,
    direccion: Direccion,
    { porRecorrido = false } = {},
  ): Promise<boolean> {
    const ahora = Date.now();
    if (!porRecorrido) {
      // El teclado tiene prioridad: cancela un recorrido por clic en curso.
      cancelarRecorrido(local);
      if (ahora - local.ultimoMovimiento < intervaloMovimientoMs) return false;
    }
    local.ultimoMovimiento = ahora;

    const resultado = mover(local.escenario, local.posicion, direccion);
    if (!resultado.valido) {
      local.conexion.enviar({ tipo: 'movimiento_rechazado', motivo: resultado.motivo });
      return false;
    }
    // La posición propia se actualiza antes de esperar a Redis: los pasos seguidos salen en orden.
    local.posicion = resultado.posicion;
    const propiedad = await coordinacion.mover(
      local.sala.id,
      local.idUsuario,
      local.conexion.id,
      resultado.posicion,
      { tipo: 'movio', id: local.idUsuario, ...resultado.posicion },
    );
    if (propiedad !== 'ok') {
      perderLugar(local, propiedad);
      return false;
    }

    // POSICION_AVATAR_SALA: se guarda la última posición, agrupando movimientos seguidos.
    if (!local.guardado) {
      local.guardado = setTimeout(() => {
        local.guardado = undefined;
        if (detenido || !locales.has(local.conexion.id)) return;
        repositorio
          .guardarPosicion(local.sala.id, local.idUsuario, local.posicion)
          .catch((error) =>
            logger.warn('No se pudo guardar una posición', { error: String(error) }),
          );
      }, retrasoGuardadoMs);
      local.guardado.unref();
    }
    return true;
  }

  /**
   * F40: movimiento por clic. El servidor calcula el camino y lo recorre paso a paso; cada paso
   * se valida otra vez con las mismas reglas que el teclado y se difunde a todos (RF25, RF26).
   */
  async function irA(local: Local, destino: { x: number; y: number }) {
    cancelarRecorrido(local);
    const plan = ruta(local.escenario, local.posicion, destino);
    if (!plan.valido) {
      local.conexion.enviar({ tipo: 'movimiento_rechazado', motivo: plan.motivo });
      return;
    }
    const vuelta = local.vueltaRecorrido;
    const pendientes = [...plan.pasos];
    const vigente = () =>
      vuelta === local.vueltaRecorrido && !detenido && locales.has(local.conexion.id);
    const avanzar = async () => {
      local.recorrido = undefined;
      const paso = pendientes.shift();
      if (!paso || !vigente()) return;
      if (!(await moverParticipante(local, paso, { porRecorrido: true }))) return;
      if (pendientes.length > 0 && vigente()) {
        local.recorrido = setTimeout(
          () => void avanzar().catch((error) => fallaTiempoReal(local, error)),
          intervaloPasoMs,
        );
        local.recorrido.unref();
      }
    };
    await avanzar();
  }

  /** F14: cada mensaje pasa por el DLP. Si se bloquea, solo el autor ve el aviso. */
  async function hablar(local: Local, texto: string) {
    const limpio = texto.trim();
    if (limpio.length === 0 || limpio.length > LARGO_MAXIMO_MENSAJE) {
      local.conexion.enviar({
        tipo: 'error',
        codigo: 'MENSAJE_INVALIDO',
        mensaje: `El mensaje debe tener entre 1 y ${LARGO_MAXIMO_MENSAJE} caracteres.`,
      });
      return;
    }
    const ahora = Date.now();
    if (ahora - local.ultimoMensaje < intervaloMensajeMs) {
      local.conexion.enviar({
        tipo: 'error',
        codigo: 'DEMASIADO_RAPIDO',
        mensaje: 'Espera un momento antes de enviar otro mensaje.',
      });
      return;
    }
    local.ultimoMensaje = ahora;

    try {
      const revision = await dlp.revisar(limpio, {
        tipoContenido: 'sala',
        idUsuario: local.idUsuario,
      });
      if (!revision.permitido) {
        local.conexion.enviar({ tipo: 'mensaje_bloqueado', mensaje: revision.mensaje });
        return;
      }
    } catch (error) {
      local.conexion.enviar({
        tipo: 'error',
        codigo: 'DLP_NO_DISPONIBLE',
        mensaje: error instanceof ErrorApp ? error.message : 'No pudimos revisar el mensaje.',
      });
      return;
    }

    if (!locales.has(local.conexion.id) || !local.participante) return;
    const propiedad = await coordinacion.publicar(
      local.sala.id,
      local.idUsuario,
      local.conexion.id,
      {
        tipo: 'mensaje',
        id: randomUUID(),
        autor: { id: local.idUsuario, alias: local.participante.alias },
        texto: limpio,
        fecha: new Date().toISOString(),
      },
    );
    if (propiedad !== 'ok') perderLugar(local, propiedad);
  }

  /**
   * Mensaje recibido de una conexión que ya está en la sala. La sala es la de la conexión: el
   * cliente no puede elegir otra en el mensaje.
   */
  async function recibir(idSala: string, idUsuario: string, conexion: Conexion, crudo: string) {
    const local = locales.get(conexion.id);
    if (
      !local ||
      !local.participante ||
      local.sala.id !== idSala ||
      local.idUsuario !== idUsuario
    ) {
      return;
    }

    let mensaje: { tipo?: unknown; direccion?: unknown; texto?: unknown; x?: unknown; y?: unknown };
    try {
      mensaje = JSON.parse(crudo) as typeof mensaje;
    } catch {
      return;
    }
    try {
      if (
        mensaje.tipo === 'mover' &&
        typeof mensaje.direccion === 'string' &&
        mensaje.direccion in DIRECCIONES
      ) {
        await moverParticipante(local, mensaje.direccion as Direccion);
      } else if (
        mensaje.tipo === 'ir' &&
        Number.isInteger(mensaje.x) &&
        Number.isInteger(mensaje.y)
      ) {
        await irA(local, { x: mensaje.x as number, y: mensaje.y as number });
      } else if (mensaje.tipo === 'mensaje' && typeof mensaje.texto === 'string') {
        await hablar(local, mensaje.texto);
      } else if (mensaje.tipo === 'salir') {
        conexion.cerrar(CIERRE.SALIDA, 'SALIDA');
        await desconectar(idSala, idUsuario, conexion, 'salida');
      }
    } catch (error) {
      fallaTiempoReal(local, error);
    }
  }

  /** Cupos ocupados en la base que ninguna presencia sostiene (una instancia cayó al entrar). */
  async function liberarHuerfanos() {
    const abiertas = await repositorio.participacionesAbiertas(presenciaMs / 1000);
    if (abiertas.length === 0) return;
    const presentes = new Set(
      (await coordinacion.presentes()).map((p) => `${p.idSala}|${p.idUsuario}`),
    );
    for (const { idSala, idUsuario } of abiertas) {
      if (presentes.has(`${idSala}|${idUsuario}`)) continue;
      await coordinacion.conBloqueo(idSala, idUsuario, async () => {
        if (!(await coordinacion.presencia(idSala, idUsuario)))
          await liberarCupo(idSala, idUsuario);
      });
    }
  }

  /**
   * Cada latido: renueva las presencias de esta instancia y limpia solo lo vencido (de
   * cualquier instancia). Nunca toca a quien sigue conectado, esté donde esté.
   */
  async function mantener() {
    if (detenido || manteniendo) return;
    manteniendo = true;
    try {
      const vivas = [...locales.values()].filter((local) => local.participante);
      const perdidas = await coordinacion.renovar(
        vivas.map((local) => ({
          idSala: local.sala.id,
          idUsuario: local.idUsuario,
          conexion: local.conexion.id,
        })),
      );
      for (const { conexion, estado } of perdidas) {
        const local = locales.get(conexion);
        if (local) perderLugar(local, estado);
      }
      if (Date.now() < barrerDesde) return;

      for (const { idSala, idUsuario } of await coordinacion.vencidas()) {
        await retirarPresencia(idSala, idUsuario, { soloVencida: true });
      }
      await liberarHuerfanos();
      // Cierres (F13) que programó una instancia que ya no está.
      for (const idSala of await repositorio.porCerrar(cierreSegundos)) {
        if (!cierres.has(idSala)) await intentarCierre(idSala);
      }
    } catch (error) {
      logger.warn('Falló el mantenimiento de las salas', { error: String(error) });
    } finally {
      manteniendo = false;
    }
  }

  return {
    iniciar,
    conectar,
    recibir,
    desconectar,
    /** Un ciclo de mantenimiento ya (pruebas y diagnóstico). */
    mantener,

    /**
     * Fase 7: saca a una persona de todas las salas (por ejemplo, al suspender su cuenta), esté
     * conectada a la instancia que esté. Devuelve en cuántas salas estaba.
     */
    async retirarUsuario(idUsuario: string, mensaje = 'Tu cuenta no está activa.') {
      await iniciar();
      let retiros = 0;
      for (const presente of await coordinacion.presentes()) {
        if (presente.idUsuario !== idUsuario) continue;
        const salida = await retirarPresencia(presente.idSala, idUsuario);
        if (!salida) continue;
        await cerrarConexion(
          salida.presencia.conexion,
          { codigo: 'RETIRADO', mensaje },
          CIERRE.RETIRADA,
        );
        retiros++;
      }
      return retiros;
    },

    /** Fase 7 (F29): la administración deshabilita una sala; quien esté dentro sale con un aviso. */
    async retirarTodos(idSala: string) {
      await iniciar();
      const { presencias } = await coordinacion.instantanea(idSala);
      let retiros = 0;
      for (const { participante } of presencias) {
        const salida = await retirarPresencia(idSala, participante.id);
        if (!salida) continue;
        await cerrarConexion(
          salida.presencia.conexion,
          { codigo: 'SALA_NO_DISPONIBLE', mensaje: MENSAJE_NO_DISPONIBLE },
          CIERRE.RETIRADA,
        );
        retiros++;
      }
      return retiros;
    },

    /**
     * Hace que todas las instancias vuelvan a leer la configuración de una sala sin personas
     * (escenario) en la próxima entrada. Devuelve false si hay personas dentro.
     */
    async olvidar(idSala: string) {
      await iniciar();
      const { presencias } = await coordinacion.instantanea(idSala);
      if (presencias.length > 0) return false;
      escenarios.delete(idSala);
      await coordinacion.ordenar({ tipo: 'olvidar', idSala });
      return true;
    },

    /** Personas en una sala, según el estado compartido (para pruebas y diagnóstico). */
    async participantes(idSala: string) {
      const { presencias } = await coordinacion.instantanea(idSala);
      return presencias.map(aParticipante);
    },

    /**
     * Detiene esta instancia. No toca presencias ni cupos: quien estaba aquí se reconecta a otra
     * instancia antes de que venzan, y nadie de las demás instancias se entera.
     */
    detener() {
      detenido = true;
      if (mantenimiento) clearInterval(mantenimiento);
      mantenimiento = null;
      for (const temporizador of cierres.values()) clearTimeout(temporizador);
      cierres.clear();
      for (const local of [...locales.values()]) {
        quitarLocal(local);
        local.conexion.cerrar(CIERRE.SERVIDOR_DETENIDO, 'SERVIDOR_DETENIDO');
      }
      escenarios.clear();
    },
  };
}

export type GestorSalas = ReturnType<typeof crearGestorSalas>;
