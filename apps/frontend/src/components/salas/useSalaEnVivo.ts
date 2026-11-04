'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  CIERRE,
  urlTiempoRealSala,
  type MensajeCliente,
  type MensajeServidor,
  type MotivoRechazo,
  type Obstaculo,
  type ParticipanteEnSala,
} from '@/lib/api/salas';

export type EntradaChat =
  | {
      tipo: 'mensaje';
      id: string;
      autor: { id: string; alias: string };
      texto: string;
      fecha: string;
    }
  | { tipo: 'aviso'; id: string; texto: string };

/**
 * Participante con datos solo visuales, calculados aquí a partir de los eventos del servidor:
 * hacia dónde mira (según el último paso), cuántos pasos dio (cada uno reinicia la animación de
 * pisar) y si acaba de llegar (destello de entrada). El servidor no sabe nada de esto.
 */
export type ParticipanteVivo = ParticipanteEnSala & {
  mira?: 'izquierda' | 'derecha';
  pasos?: number;
  llego?: boolean;
};

export type EstadoSalaEnVivo = {
  /** «reconectando»: la conexión se cortó y se vuelve a abrir sola, sin perder lo que se ve. */
  fase: 'conectando' | 'dentro' | 'reconectando' | 'fuera';
  yo: string | null;
  escenario: { ancho: number; alto: number; obstaculos: Obstaculo[] } | null;
  capacidad: number;
  participantes: ParticipanteVivo[];
  ocupacion: number;
  chat: EntradaChat[];
  /** Última persona que entró; `vez` cambia en cada llegada para volver a anunciarla. */
  llegada: { alias: string; vez: number } | null;
  /** Último movimiento rechazado; `vez` cambia en cada rechazo para volver a anunciarlo. */
  rechazo: { motivo: MotivoRechazo; vez: number } | null;
  /** Aviso del DLP: solo lo recibe quien escribió el mensaje. */
  bloqueo: string | null;
  errorChat: string | null;
  /** Cuenta los mensajes propios publicados (para limpiar el campo del chat). */
  publicados: number;
  /** Por qué terminó la conexión, cuando la fase es «fuera». */
  fin: { codigo: number; mensaje: string } | null;
  ultimoError: string | null;
  /** Número del reintento en curso mientras la fase es «reconectando». */
  reintento: number | null;
};

const INICIAL: EstadoSalaEnVivo = {
  fase: 'conectando',
  yo: null,
  escenario: null,
  capacidad: 10,
  participantes: [],
  ocupacion: 0,
  chat: [],
  llegada: null,
  rechazo: null,
  bloqueo: null,
  errorChat: null,
  publicados: 0,
  fin: null,
  ultimoError: null,
  reintento: null,
};

/** Solo se conservan las últimas entradas del chat: no se guarda historial. */
const MAXIMO_CHAT = 80;

const MENSAJES_CIERRE: Record<number, string> = {
  [CIERRE.SALIDA]: 'Saliste de la sala.',
  [CIERRE.REEMPLAZADA]: 'Entraste a esta sala desde otra pestaña.',
  [CIERRE.NO_AUTENTICADO]: 'Tu sesión terminó. Vuelve a iniciar sesión.',
  [CIERRE.PROHIBIDO]: 'Tu usuario no puede entrar a salas.',
  [CIERRE.NO_ENCONTRADA]: 'La sala no existe.',
  [CIERRE.CERRADA]: 'Esta sala se cerró. Vuelve a la lista de salas.',
  [CIERRE.RETIRADA]: 'Esta sala no está disponible en este momento.',
  [CIERRE.LLENA]: 'La sala está llena.',
};

type Accion =
  | { tipo: 'reiniciar' }
  | { tipo: 'servidor'; mensaje: MensajeServidor }
  | { tipo: 'reconectando'; reintento: number }
  | { tipo: 'cerrada'; codigo: number }
  | { tipo: 'limpiar_avisos_chat' };

/**
 * Cierres tras los que el cliente vuelve a conectarse solo: corte de red, una instancia del
 * servidor que se reinicia o cae, la conexión que llega a su duración máxima en Vercel, o el
 * tiempo real que no responde un momento. Los demás (salir, otra pestaña, sala llena…) terminan.
 */
const CIERRES_CON_REINTENTO: ReadonlySet<number> = new Set([
  CIERRE.SERVIDOR_DETENIDO,
  1005, // sin código de cierre
  1006, // corte sin cierre ordenado
  CIERRE.ERROR_INTERNO,
  CIERRE.REINTENTAR,
  1013, // «intenta más tarde»
]);
/** Reintentos seguidos sin volver a entrar antes de rendirse (unos dos minutos en total). */
const REINTENTOS_MAXIMOS = 8;
const ESPERA_BASE_MS = 500;
const ESPERA_MAXIMA_MS = 15_000;

/**
 * Espera antes del reintento n: crece al doble cada vez (con tope) y la mitad es al azar, para
 * que muchas personas cortadas a la vez no vuelvan todas en el mismo instante.
 */
const esperaReintento = (reintento: number) => {
  const tope = Math.min(ESPERA_MAXIMA_MS, ESPERA_BASE_MS * 2 ** (reintento - 1));
  return tope / 2 + Math.random() * (tope / 2);
};

const conChat = (chat: EntradaChat[], entrada: EntradaChat) =>
  [...chat, entrada].slice(-MAXIMO_CHAT);

let contador = 0;
const idAviso = () => `aviso-${++contador}`;

function alRecibir(estado: EstadoSalaEnVivo, mensaje: MensajeServidor): EstadoSalaEnVivo {
  switch (mensaje.tipo) {
    case 'estado':
      // También al reconectarse: el estado completo reemplaza lo que pudo cambiar durante el corte.
      return {
        ...estado,
        fase: 'dentro',
        yo: mensaje.yo,
        escenario: mensaje.escenario,
        capacidad: mensaje.sala.capacidad,
        participantes: mensaje.participantes,
        ocupacion: mensaje.ocupacion,
        ultimoError: null,
        reintento: null,
        chat:
          estado.fase === 'reconectando'
            ? conChat(estado.chat, {
                tipo: 'aviso',
                id: idAviso(),
                texto: 'Se recuperó la conexión.',
              })
            : estado.chat,
      };
    case 'entro':
      return {
        ...estado,
        participantes: [
          ...estado.participantes.filter((p) => p.id !== mensaje.participante.id),
          { ...mensaje.participante, llego: true },
        ],
        ocupacion: mensaje.ocupacion,
        llegada:
          mensaje.participante.id === estado.yo
            ? estado.llegada
            : { alias: mensaje.participante.alias, vez: (estado.llegada?.vez ?? 0) + 1 },
        chat: conChat(estado.chat, {
          tipo: 'aviso',
          id: idAviso(),
          texto: `${mensaje.participante.alias} entró a la sala.`,
        }),
      };
    case 'salio': {
      const quien = estado.participantes.find((p) => p.id === mensaje.id);
      return {
        ...estado,
        participantes: estado.participantes.filter((p) => p.id !== mensaje.id),
        ocupacion: mensaje.ocupacion,
        chat: quien
          ? conChat(estado.chat, { tipo: 'aviso', id: idAviso(), texto: `${quien.alias} salió.` })
          : estado.chat,
      };
    }
    case 'movio':
      return {
        ...estado,
        participantes: estado.participantes.map((p) => {
          if (p.id !== mensaje.id) return p;
          const dx = mensaje.x - p.x;
          const mira = dx < 0 ? 'izquierda' : dx > 0 ? 'derecha' : p.mira;
          return { ...p, x: mensaje.x, y: mensaje.y, mira, pasos: (p.pasos ?? 0) + 1 };
        }),
        rechazo: mensaje.id === estado.yo ? null : estado.rechazo,
      };
    case 'movimiento_rechazado':
      return {
        ...estado,
        rechazo: { motivo: mensaje.motivo, vez: (estado.rechazo?.vez ?? 0) + 1 },
      };
    case 'mensaje': {
      const propio = mensaje.autor.id === estado.yo;
      return {
        ...estado,
        chat: conChat(estado.chat, { ...mensaje, tipo: 'mensaje' }),
        publicados: propio ? estado.publicados + 1 : estado.publicados,
        bloqueo: propio ? null : estado.bloqueo,
        errorChat: propio ? null : estado.errorChat,
      };
    }
    case 'mensaje_bloqueado':
      return { ...estado, bloqueo: mensaje.mensaje, errorChat: null };
    case 'error':
      // Dentro de la sala, un error es de un mensaje de chat; antes de entrar, explica el cierre.
      // Que la administración retire a alguien de la sala explica el cierre, no el chat.
      if (mensaje.codigo === 'SALA_NO_DISPONIBLE' || mensaje.codigo === 'RETIRADO') {
        return { ...estado, ultimoError: mensaje.mensaje };
      }
      return estado.fase === 'dentro'
        ? { ...estado, errorChat: mensaje.mensaje, bloqueo: null }
        : { ...estado, ultimoError: mensaje.mensaje };
  }
}

function reducir(estado: EstadoSalaEnVivo, accion: Accion): EstadoSalaEnVivo {
  switch (accion.tipo) {
    case 'reiniciar':
      return INICIAL;
    case 'servidor':
      return alRecibir(estado, accion.mensaje);
    case 'reconectando':
      return { ...estado, fase: 'reconectando', reintento: accion.reintento };
    case 'cerrada':
      return {
        ...estado,
        fase: 'fuera',
        fin: {
          codigo: accion.codigo,
          mensaje:
            estado.ultimoError ??
            MENSAJES_CIERRE[accion.codigo] ??
            'Se perdió la conexión con la sala. Puedes volver a entrar.',
        },
      };
    case 'limpiar_avisos_chat':
      return estado.bloqueo || estado.errorChat
        ? { ...estado, bloqueo: null, errorChat: null }
        : estado;
  }
}

/**
 * Conexión en tiempo real a una sala. El servidor es la autoridad: este hook solo refleja lo
 * que el servidor anuncia y le envía intenciones (moverse, escribir, salir).
 *
 * Si la conexión se corta, se vuelve a abrir sola: la sesión viaja en la cookie, el servidor
 * reconoce a la persona (sigue en la sala si vuelve a tiempo) y envía el estado completo.
 */
export function useSalaEnVivo(idSala: string) {
  const [estado, despachar] = useReducer(reducir, INICIAL);
  const [intento, setIntento] = useState(0);
  const socket = useRef<WebSocket | null>(null);
  /** Reintentos seguidos sin recibir el estado; vuelve a 0 al entrar. */
  const reintentos = useRef(0);
  /** Deja de reintentar (al salir durante un corte). */
  const cancelarReintento = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (intento === 0) return;
    let ws: WebSocket | null = null;
    let espera: ReturnType<typeof setTimeout> | undefined;
    let alVolverLaRed: (() => void) | null = null;
    const dejarDeEsperar = () => {
      clearTimeout(espera);
      if (alVolverLaRed) window.removeEventListener('online', alVolverLaRed);
      alVolverLaRed = null;
      cancelarReintento.current = null;
    };

    // En desarrollo, React monta, desmonta y vuelve a montar: esperar un instante evita abrir
    // una conexión que se cerraría enseguida.
    const temporizador = setTimeout(() => {
      const actual = new WebSocket(urlTiempoRealSala(idSala));
      ws = actual;
      socket.current = actual;
      actual.onmessage = (evento) => {
        try {
          const mensaje = JSON.parse(String(evento.data)) as MensajeServidor;
          if (mensaje.tipo === 'estado') reintentos.current = 0;
          despachar({ tipo: 'servidor', mensaje });
        } catch {
          // Un mensaje ilegible se ignora.
        }
      };
      actual.onclose = (evento) => {
        if (socket.current === actual) socket.current = null;
        if (!CIERRES_CON_REINTENTO.has(evento.code) || reintentos.current >= REINTENTOS_MAXIMOS) {
          reintentos.current = 0;
          despachar({ tipo: 'cerrada', codigo: evento.code });
          return;
        }
        const reintento = ++reintentos.current;
        despachar({ tipo: 'reconectando', reintento });
        const volver = () => {
          dejarDeEsperar();
          setIntento((n) => n + 1);
        };
        // Si la red vuelve antes de que pase la espera, se reintenta en ese momento.
        alVolverLaRed = volver;
        window.addEventListener('online', volver);
        espera = setTimeout(volver, esperaReintento(reintento));
        cancelarReintento.current = () => {
          dejarDeEsperar();
          reintentos.current = 0;
          despachar({ tipo: 'cerrada', codigo: CIERRE.SALIDA });
        };
      };
    }, 0);

    return () => {
      clearTimeout(temporizador);
      dejarDeEsperar();
      if (!ws) return;
      ws.onmessage = null;
      ws.onclose = null;
      ws.close(CIERRE.SALIDA);
      if (socket.current === ws) socket.current = null;
    };
  }, [idSala, intento]);

  const enviar = useCallback((mensaje: MensajeCliente) => {
    const ws = socket.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(mensaje));
  }, []);

  const entrar = useCallback(() => {
    reintentos.current = 0;
    despachar({ tipo: 'reiniciar' });
    setIntento((n) => n + 1);
  }, []);

  const salir = useCallback(() => {
    const ws = socket.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ tipo: 'salir' }));
    else if (ws) ws.close(CIERRE.SALIDA);
    // Durante un corte no hay conexión: se deja de reintentar y se vuelve a la antesala.
    else cancelarReintento.current?.();
  }, []);

  const limpiarAvisosChat = useCallback(() => despachar({ tipo: 'limpiar_avisos_chat' }), []);

  return { estado, iniciado: intento > 0, entrar, salir, enviar, limpiarAvisosChat };
}
