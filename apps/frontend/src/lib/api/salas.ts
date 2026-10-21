import { api, URL_API } from './cliente';
import type { Apariencia } from './avatar';

export type EstadoSala = 'disponible' | 'llena' | 'vacia' | 'cerrada';

/** Antesala (F11): lo que se ve antes de entrar. */
export type SalaResumen = {
  id: string;
  nombre: string;
  tematica: string;
  descripcion: string;
  reglas: string;
  capacidad: number;
  ocupacion: number;
  estado: EstadoSala;
};

export type SalaDetalle = SalaResumen & {
  /** Si esta instancia se cerró por inactividad, la instancia abierta del mismo tema. */
  instanciaVigente: string | null;
};

export type TipoObstaculo = 'planta' | 'mesa' | 'sofa' | 'cojin' | 'estante' | 'caja';
export type Obstaculo = { x: number; y: number; tipo: TipoObstaculo };
export type Direccion = 'arriba' | 'abajo' | 'izquierda' | 'derecha';

export type ParticipanteEnSala = {
  id: string;
  alias: string;
  avatar: Apariencia | null;
  x: number;
  y: number;
};

/** Mensajes del WebSocket de salas (mismo protocolo que `salas.protocolo.ts` del backend). */
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

/** El cliente solo envía intenciones: nunca coordenadas. */
export type MensajeCliente =
  { tipo: 'mover'; direccion: Direccion } | { tipo: 'mensaje'; texto: string } | { tipo: 'salir' };

/** Códigos de cierre del WebSocket que usa el backend. */
export const CIERRE = {
  SALIDA: 1000,
  REEMPLAZADA: 4000,
  NO_AUTENTICADO: 4401,
  PROHIBIDO: 4403,
  NO_ENCONTRADA: 4404,
  CERRADA: 4409,
  LLENA: 4429,
} as const;

export const LARGO_MAXIMO_MENSAJE = 500;

export const listarSalas = () => api.get<{ salas: SalaResumen[] }>('/api/salas');

export const obtenerSala = (id: string) =>
  api.get<{ sala: SalaDetalle }>(`/api/salas/${encodeURIComponent(id)}`);

/** Misma URL del backend con ws:// o wss://; la sesión viaja en la cookie. */
export const urlTiempoRealSala = (id: string) =>
  `${URL_API.replace(/^http/, 'ws')}/ws/salas/${encodeURIComponent(id)}`;
