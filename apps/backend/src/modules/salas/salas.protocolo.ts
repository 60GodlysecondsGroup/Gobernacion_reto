import type { Obstaculo } from './salas.escenario.js';
import type { Participante } from './salas.repository.js';

/** Mensajes JSON del WebSocket de salas. El cliente solo envía intenciones; el servidor decide. */

export type MensajeCliente =
  | { tipo: 'mover'; direccion: 'arriba' | 'abajo' | 'izquierda' | 'derecha' }
  | { tipo: 'mensaje'; texto: string }
  | { tipo: 'salir' };

export type ParticipanteEnSala = Participante & { x: number; y: number };

export type MensajeServidor =
  | {
      tipo: 'estado';
      yo: string;
      sala: { id: string; nombre: string; tematica: string; capacidad: number };
      escenario: { ancho: number; alto: number; obstaculos: Obstaculo[] };
      participantes: ParticipanteEnSala[];
      ocupacion: number;
    }
  | { tipo: 'entro'; participante: ParticipanteEnSala; ocupacion: number }
  | { tipo: 'salio'; id: string; ocupacion: number }
  | { tipo: 'movio'; id: string; x: number; y: number }
  | { tipo: 'movimiento_rechazado'; motivo: 'limite' | 'obstaculo' }
  | {
      tipo: 'mensaje';
      id: string;
      autor: { id: string; alias: string };
      texto: string;
      fecha: string;
    }
  | { tipo: 'mensaje_bloqueado'; mensaje: string }
  | { tipo: 'error'; codigo: string; mensaje: string };

/** Códigos de cierre del WebSocket (4000–4999 son de la aplicación). */
export const CIERRE = {
  SALIDA: 1000,
  SERVIDOR_DETENIDO: 1001,
  ERROR_INTERNO: 1011,
  REEMPLAZADA: 4000,
  NO_AUTENTICADO: 4401,
  PROHIBIDO: 4403,
  NO_ENCONTRADA: 4404,
  CERRADA: 4409,
  LLENA: 4429,
} as const;
