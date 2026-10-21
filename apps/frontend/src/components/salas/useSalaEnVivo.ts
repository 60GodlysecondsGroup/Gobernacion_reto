'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  CIERRE,
  urlTiempoRealSala,
  type MensajeCliente,
  type MensajeServidor,
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

export type EstadoSalaEnVivo = {
  fase: 'conectando' | 'dentro' | 'fuera';
  yo: string | null;
  escenario: { ancho: number; alto: number; obstaculos: Obstaculo[] } | null;
  capacidad: number;
  participantes: ParticipanteEnSala[];
  ocupacion: number;
  chat: EntradaChat[];
  /** Último movimiento rechazado; `vez` cambia en cada rechazo para volver a anunciarlo. */
  rechazo: { motivo: 'limite' | 'obstaculo'; vez: number } | null;
  /** Aviso del DLP: solo lo recibe quien escribió el mensaje. */
  bloqueo: string | null;
  errorChat: string | null;
  /** Cuenta los mensajes propios publicados (para limpiar el campo del chat). */
  publicados: number;
  /** Por qué terminó la conexión, cuando la fase es «fuera». */
  fin: { codigo: number; mensaje: string } | null;
  ultimoError: string | null;
};

const INICIAL: EstadoSalaEnVivo = {
  fase: 'conectando',
  yo: null,
  escenario: null,
  capacidad: 10,
  participantes: [],
  ocupacion: 0,
  chat: [],
  rechazo: null,
  bloqueo: null,
  errorChat: null,
  publicados: 0,
  fin: null,
  ultimoError: null,
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
  [CIERRE.LLENA]: 'La sala está llena.',
};

type Accion =
  | { tipo: 'reiniciar' }
  | { tipo: 'servidor'; mensaje: MensajeServidor }
  | { tipo: 'cerrada'; codigo: number }
  | { tipo: 'limpiar_avisos_chat' };

const conChat = (chat: EntradaChat[], entrada: EntradaChat) =>
  [...chat, entrada].slice(-MAXIMO_CHAT);

let contador = 0;
const idAviso = () => `aviso-${++contador}`;

function alRecibir(estado: EstadoSalaEnVivo, mensaje: MensajeServidor): EstadoSalaEnVivo {
  switch (mensaje.tipo) {
    case 'estado':
      return {
        ...estado,
        fase: 'dentro',
        yo: mensaje.yo,
        escenario: mensaje.escenario,
        capacidad: mensaje.sala.capacidad,
        participantes: mensaje.participantes,
        ocupacion: mensaje.ocupacion,
        ultimoError: null,
      };
    case 'entro':
      return {
        ...estado,
        participantes: [
          ...estado.participantes.filter((p) => p.id !== mensaje.participante.id),
          mensaje.participante,
        ],
        ocupacion: mensaje.ocupacion,
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
        participantes: estado.participantes.map((p) =>
          p.id === mensaje.id ? { ...p, x: mensaje.x, y: mensaje.y } : p,
        ),
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
 */
export function useSalaEnVivo(idSala: string) {
  const [estado, despachar] = useReducer(reducir, INICIAL);
  const [intento, setIntento] = useState(0);
  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (intento === 0) return;
    let ws: WebSocket | null = null;
    // En desarrollo, React monta, desmonta y vuelve a montar: esperar un instante evita abrir
    // una conexión que se cerraría enseguida.
    const temporizador = setTimeout(() => {
      const actual = new WebSocket(urlTiempoRealSala(idSala));
      ws = actual;
      socket.current = actual;
      actual.onmessage = (evento) => {
        try {
          despachar({
            tipo: 'servidor',
            mensaje: JSON.parse(String(evento.data)) as MensajeServidor,
          });
        } catch {
          // Un mensaje ilegible se ignora.
        }
      };
      actual.onclose = (evento) => {
        if (socket.current === actual) socket.current = null;
        despachar({ tipo: 'cerrada', codigo: evento.code });
      };
    }, 0);

    return () => {
      clearTimeout(temporizador);
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
    despachar({ tipo: 'reiniciar' });
    setIntento((n) => n + 1);
  }, []);

  const salir = useCallback(() => {
    const ws = socket.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ tipo: 'salir' }));
    else ws?.close(CIERRE.SALIDA);
  }, []);

  const limpiarAvisosChat = useCallback(() => despachar({ tipo: 'limpiar_avisos_chat' }), []);

  return { estado, iniciado: intento > 0, entrar, salir, enviar, limpiarAvisosChat };
}
