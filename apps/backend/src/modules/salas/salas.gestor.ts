import { randomUUID } from 'node:crypto';
import { ErrorApp } from '../../http/errores.js';
import { esUuid } from '../../http/validacion.js';
import type { Logger } from '../../lib/logger.js';
import type { ServicioComunidad } from '../comunidad/comunidad.service.js';
import type { ServicioDlp } from '../dlp/dlp.service.js';
import { tienePermiso } from '../seguridad/permisos.js';
import type { Sesion } from '../seguridad/sesion.service.js';
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
  enviar(mensaje: MensajeServidor): void;
  cerrar(codigo: number, motivo: string): void;
  readonly abierta: boolean;
};

type EnSala = {
  info: Participante;
  posicion: Posicion;
  conexion: Conexion;
  ultimoMovimiento: number;
  ultimoMensaje: number;
  guardado?: NodeJS.Timeout;
  /** Recorrido por clic en curso (F40): un paso por temporizador. */
  recorrido?: NodeJS.Timeout;
};

type SalaActiva = {
  id: string;
  nombre: string;
  tematica: string;
  capacidad: number;
  escenario: Escenario;
  participantes: Map<string, EnSala>;
  /** Entradas en curso por persona: una segunda conexión espera a que termine la primera. */
  entrando: Map<string, Promise<unknown>>;
};

type Dependencias = {
  repositorio: RepositorioSalas;
  comunidades: ServicioComunidad;
  dlp: ServicioDlp;
  logger: Logger;
  cierreSegundos: number;
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

const MENSAJE_NO_DISPONIBLE = 'Esta sala no está disponible en este momento.';

/**
 * Salas en tiempo real (F11–F15, F38, F39, F41). El servidor es la autoridad: decide quién
 * está, dónde está cada avatar y qué movimientos son válidos. El cliente solo envía intenciones.
 */
export function crearGestorSalas({
  repositorio,
  comunidades,
  dlp,
  logger,
  cierreSegundos,
  intervaloMovimientoMs = 60,
  intervaloMensajeMs = 500,
  retrasoGuardadoMs = 300,
  intervaloPasoMs = 140,
}: Dependencias) {
  const activas = new Map<string, SalaActiva>();
  const cierres = new Map<string, NodeJS.Timeout>();
  let detenido = false;

  const rechazar = (conexion: Conexion, codigo: string, mensaje: string, cierre: number) => {
    conexion.enviar({ tipo: 'error', codigo, mensaje });
    conexion.cerrar(cierre, codigo);
  };

  const difundir = (sala: SalaActiva, mensaje: MensajeServidor) => {
    for (const participante of sala.participantes.values()) participante.conexion.enviar(mensaje);
  };

  const enSala = (sala: SalaActiva) =>
    [...sala.participantes.values()].map((p) => ({ ...p.info, ...p.posicion }));

  function enviarEstado(sala: SalaActiva, idUsuario: string, conexion: Conexion) {
    conexion.enviar({
      tipo: 'estado',
      yo: idUsuario,
      sala: {
        id: sala.id,
        nombre: sala.nombre,
        tematica: sala.tematica,
        capacidad: sala.capacidad,
      },
      escenario: {
        ancho: sala.escenario.ancho,
        alto: sala.escenario.alto,
        obstaculos: sala.escenario.obstaculos,
      },
      participantes: enSala(sala),
      ocupacion: sala.participantes.size,
    });
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

  async function intentarCierre(idSala: string) {
    cierres.delete(idSala);
    if (detenido || (activas.get(idSala)?.participantes.size ?? 0) > 0) return;
    try {
      const resultado = await repositorio.cerrarSiVacia(idSala, cierreSegundos);
      if (resultado.cerrada) {
        activas.delete(idSala);
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

  async function activar(
    idSala: string,
    sala: { nombre: string; tematica: string; capacidad: number },
  ) {
    const existente = activas.get(idSala);
    if (existente) return existente;
    const escenario = await repositorio.escenario(idSala);
    if (!escenario) throw new Error(`La sala ${idSala} no tiene escenario`);
    const nueva: SalaActiva = {
      id: idSala,
      ...sala,
      escenario,
      participantes: new Map(),
      entrando: new Map(),
    };
    return activas.get(idSala) ?? (activas.set(idSala, nueva), nueva);
  }

  /** Ocupa un cupo, ubica el avatar y avisa a los demás. Devuelve el id, o null si no entró. */
  async function entrar(sala: SalaActiva, yo: string, conexion: Conexion) {
    const entrada = await repositorio.ocupar(sala.id, yo);
    if (entrada.resultado === 'llena') {
      rechazar(conexion, 'SALA_LLENA', 'La sala está llena.', CIERRE.LLENA);
      return null;
    }
    if (entrada.resultado === 'cerrada') {
      rechazar(
        conexion,
        'SALA_CERRADA',
        'Esta sala se cerró. Vuelve a la lista de salas.',
        CIERRE.CERRADA,
      );
      return null;
    }
    if (entrada.resultado === 'deshabilitada') {
      rechazar(conexion, 'SALA_NO_DISPONIBLE', MENSAJE_NO_DISPONIBLE, CIERRE.RETIRADA);
      return null;
    }
    cancelarCierre(sala.id);

    const info = await repositorio.participante(yo);
    const posicion = puntoDeAparicion(
      sala.escenario,
      [...sala.participantes.values()].map((p) => p.posicion),
    );
    await repositorio.guardarPosicion(sala.id, yo, posicion);

    if (!conexion.abierta) {
      await liberar(sala, yo);
      return null;
    }
    sala.participantes.set(yo, { info, posicion, conexion, ultimoMovimiento: 0, ultimoMensaje: 0 });
    enviarEstado(sala, yo, conexion);
    for (const [id, otro] of sala.participantes) {
      if (id !== yo) {
        otro.conexion.enviar({
          tipo: 'entro',
          participante: { ...info, ...posicion },
          ocupacion: sala.participantes.size,
        });
      }
    }
    return yo;
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

      const sala = await activar(detalle.id, detalle);
      const yo = sesion.idUsuario;

      // Si la misma persona ya está entrando (otra pestaña, o el doble montaje de React en
      // desarrollo), se espera a que esa entrada termine y se sigue como un reemplazo.
      for (let enCurso = sala.entrando.get(yo); enCurso; enCurso = sala.entrando.get(yo)) {
        await enCurso.catch(() => undefined);
      }
      if (!conexion.abierta) return null;

      // La misma persona desde otra pestaña: reemplaza la conexión, sin ocupar otro cupo.
      const previa = sala.participantes.get(yo);
      if (previa) {
        rechazar(
          previa.conexion,
          'REEMPLAZADA',
          'Entraste a esta sala desde otra pestaña.',
          CIERRE.REEMPLAZADA,
        );
        previa.conexion = conexion;
        enviarEstado(sala, yo, conexion);
        return yo;
      }

      const entrada = entrar(sala, yo, conexion);
      sala.entrando.set(yo, entrada);
      try {
        return await entrada;
      } finally {
        sala.entrando.delete(yo);
      }
    } catch (error) {
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

  async function liberar(sala: SalaActiva, idUsuario: string) {
    if (detenido) return;
    try {
      const ocupacion = await repositorio.liberar(sala.id, idUsuario);
      if (ocupacion === 0 && sala.participantes.size === 0) {
        programarCierre(sala.id, cierreSegundos * 1000);
      }
    } catch (error) {
      logger.error('No se pudo registrar la salida de una sala', {
        sala: sala.id,
        error: String(error),
      });
    }
  }

  /** F15 y punto 4 de la Fase 5: salir o perder la conexión libera el cupo. */
  async function desconectar(idSala: string, idUsuario: string, conexion: Conexion) {
    const sala = activas.get(idSala);
    const participante = sala?.participantes.get(idUsuario);
    // Si la conexión fue reemplazada por otra pestaña, la persona sigue en la sala.
    if (!sala || !participante || participante.conexion !== conexion) return;

    await retirar(sala, participante);
  }

  /** Saca a una persona de la sala en memoria, avisa a los demás y libera su cupo en la base. */
  async function retirar(sala: SalaActiva, participante: EnSala) {
    clearTimeout(participante.guardado);
    clearTimeout(participante.recorrido);
    sala.participantes.delete(participante.info.id);
    difundir(sala, {
      tipo: 'salio',
      id: participante.info.id,
      ocupacion: sala.participantes.size,
    });
    await liberar(sala, participante.info.id);
  }

  function cancelarRecorrido(participante: EnSala) {
    clearTimeout(participante.recorrido);
    participante.recorrido = undefined;
  }

  /** Un paso de teclado (WASD) o de un recorrido. Devuelve si el avatar se movió. */
  function moverParticipante(
    sala: SalaActiva,
    participante: EnSala,
    direccion: Direccion,
    { porRecorrido = false } = {},
  ): boolean {
    const ahora = Date.now();
    if (!porRecorrido) {
      // El teclado tiene prioridad: cancela un recorrido por clic en curso.
      cancelarRecorrido(participante);
      if (ahora - participante.ultimoMovimiento < intervaloMovimientoMs) return false;
    }
    participante.ultimoMovimiento = ahora;

    const resultado = mover(sala.escenario, participante.posicion, direccion);
    if (!resultado.valido) {
      participante.conexion.enviar({ tipo: 'movimiento_rechazado', motivo: resultado.motivo });
      return false;
    }
    participante.posicion = resultado.posicion;
    difundir(sala, { tipo: 'movio', id: participante.info.id, ...resultado.posicion });

    // POSICION_AVATAR_SALA: se guarda la última posición, agrupando movimientos seguidos.
    if (!participante.guardado) {
      participante.guardado = setTimeout(() => {
        participante.guardado = undefined;
        if (detenido || !sala.participantes.has(participante.info.id)) return;
        repositorio
          .guardarPosicion(sala.id, participante.info.id, participante.posicion)
          .catch((error) =>
            logger.warn('No se pudo guardar una posición', { error: String(error) }),
          );
      }, retrasoGuardadoMs);
      participante.guardado.unref();
    }
    return true;
  }

  /**
   * F40: movimiento por clic. El servidor calcula el camino y lo recorre paso a paso; cada paso
   * se valida otra vez con las mismas reglas que el teclado y se difunde a todos (RF25, RF26).
   */
  function irA(sala: SalaActiva, participante: EnSala, destino: { x: number; y: number }) {
    cancelarRecorrido(participante);
    const plan = ruta(sala.escenario, participante.posicion, destino);
    if (!plan.valido) {
      participante.conexion.enviar({ tipo: 'movimiento_rechazado', motivo: plan.motivo });
      return;
    }
    const pendientes = [...plan.pasos];
    const avanzar = () => {
      participante.recorrido = undefined;
      const paso = pendientes.shift();
      if (!paso || detenido || !sala.participantes.has(participante.info.id)) return;
      if (!moverParticipante(sala, participante, paso, { porRecorrido: true })) return;
      if (pendientes.length > 0) {
        participante.recorrido = setTimeout(avanzar, intervaloPasoMs);
        participante.recorrido.unref();
      }
    };
    avanzar();
  }

  /** F14: cada mensaje pasa por el DLP. Si se bloquea, solo el autor ve el aviso. */
  async function hablar(sala: SalaActiva, participante: EnSala, texto: string) {
    const limpio = texto.trim();
    if (limpio.length === 0 || limpio.length > LARGO_MAXIMO_MENSAJE) {
      participante.conexion.enviar({
        tipo: 'error',
        codigo: 'MENSAJE_INVALIDO',
        mensaje: `El mensaje debe tener entre 1 y ${LARGO_MAXIMO_MENSAJE} caracteres.`,
      });
      return;
    }
    const ahora = Date.now();
    if (ahora - participante.ultimoMensaje < intervaloMensajeMs) {
      participante.conexion.enviar({
        tipo: 'error',
        codigo: 'DEMASIADO_RAPIDO',
        mensaje: 'Espera un momento antes de enviar otro mensaje.',
      });
      return;
    }
    participante.ultimoMensaje = ahora;

    try {
      const revision = await dlp.revisar(limpio, {
        tipoContenido: 'sala',
        idUsuario: participante.info.id,
      });
      if (!revision.permitido) {
        participante.conexion.enviar({ tipo: 'mensaje_bloqueado', mensaje: revision.mensaje });
        return;
      }
    } catch (error) {
      participante.conexion.enviar({
        tipo: 'error',
        codigo: 'DLP_NO_DISPONIBLE',
        mensaje: error instanceof ErrorApp ? error.message : 'No pudimos revisar el mensaje.',
      });
      return;
    }

    if (!sala.participantes.has(participante.info.id)) return;
    difundir(sala, {
      tipo: 'mensaje',
      id: randomUUID(),
      autor: { id: participante.info.id, alias: participante.info.alias },
      texto: limpio,
      fecha: new Date().toISOString(),
    });
  }

  /** Mensaje recibido de una conexión que ya está en la sala. */
  async function recibir(idSala: string, idUsuario: string, conexion: Conexion, crudo: string) {
    const sala = activas.get(idSala);
    const participante = sala?.participantes.get(idUsuario);
    if (!sala || !participante || participante.conexion !== conexion) return;

    let mensaje: { tipo?: unknown; direccion?: unknown; texto?: unknown; x?: unknown; y?: unknown };
    try {
      mensaje = JSON.parse(crudo) as typeof mensaje;
    } catch {
      return;
    }
    if (
      mensaje.tipo === 'mover' &&
      typeof mensaje.direccion === 'string' &&
      mensaje.direccion in DIRECCIONES
    ) {
      moverParticipante(sala, participante, mensaje.direccion as Direccion);
    } else if (
      mensaje.tipo === 'ir' &&
      Number.isInteger(mensaje.x) &&
      Number.isInteger(mensaje.y)
    ) {
      irA(sala, participante, { x: mensaje.x as number, y: mensaje.y as number });
    } else if (mensaje.tipo === 'mensaje' && typeof mensaje.texto === 'string') {
      await hablar(sala, participante, mensaje.texto);
    } else if (mensaje.tipo === 'salir') {
      conexion.cerrar(CIERRE.SALIDA, 'SALIDA');
      await desconectar(idSala, idUsuario, conexion);
    }
  }

  return {
    conectar,
    recibir,
    desconectar,

    /** Al arrancar: cierra lo que quedó abierto y programa el cierre de las salas vacías. */
    async reconciliar() {
      const vacias = await repositorio.reconciliar();
      for (const sala of vacias) {
        programarCierre(sala.id, (cierreSegundos - sala.segundosVacia) * 1000);
      }
      return vacias.length;
    },

    /**
     * Fase 7: saca a una persona de todas las salas (por ejemplo, al suspender su cuenta).
     * Devuelve en cuántas salas estaba.
     */
    async retirarUsuario(idUsuario: string, mensaje = 'Tu cuenta no está activa.') {
      let retiros = 0;
      for (const sala of activas.values()) {
        const participante = sala.participantes.get(idUsuario);
        if (!participante) continue;
        await retirar(sala, participante);
        rechazar(participante.conexion, 'RETIRADO', mensaje, CIERRE.RETIRADA);
        retiros++;
      }
      return retiros;
    },

    /** Fase 7 (F29): la administración deshabilita una sala; quien esté dentro sale con un aviso. */
    async retirarTodos(idSala: string) {
      const sala = activas.get(idSala);
      if (!sala) return 0;
      const participantes = [...sala.participantes.values()];
      for (const participante of participantes) {
        await retirar(sala, participante);
        rechazar(
          participante.conexion,
          'SALA_NO_DISPONIBLE',
          MENSAJE_NO_DISPONIBLE,
          CIERRE.RETIRADA,
        );
      }
      return participantes.length;
    },

    /**
     * Olvida el estado en memoria de una sala sin personas, para que la próxima entrada lea de
     * nuevo su configuración (capacidad, escenario). Devuelve false si hay personas dentro.
     */
    olvidar(idSala: string) {
      const sala = activas.get(idSala);
      if (sala && sala.participantes.size > 0) return false;
      activas.delete(idSala);
      return true;
    },

    /** Actualiza la capacidad que se anuncia a quienes ya están dentro (la base es la autoridad). */
    actualizarCapacidad(idSala: string, capacidad: number) {
      const sala = activas.get(idSala);
      if (sala) sala.capacidad = capacidad;
    },

    /** Estado en memoria de una sala (para pruebas y diagnóstico). */
    participantes(idSala: string) {
      const sala = activas.get(idSala);
      return sala ? enSala(sala) : [];
    },

    detener() {
      detenido = true;
      for (const temporizador of cierres.values()) clearTimeout(temporizador);
      cierres.clear();
      for (const sala of activas.values()) {
        for (const participante of sala.participantes.values()) {
          clearTimeout(participante.guardado);
          clearTimeout(participante.recorrido);
          participante.conexion.cerrar(CIERRE.SERVIDOR_DETENIDO, 'SERVIDOR_DETENIDO');
        }
      }
      activas.clear();
    },
  };
}

export type GestorSalas = ReturnType<typeof crearGestorSalas>;
