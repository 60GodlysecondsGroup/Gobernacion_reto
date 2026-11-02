import { api } from './cliente';

/** Respuesta del chat de Cocuyo (`POST /api/guia/cocuyo`). Ver docs/cocuyo-asistente-ia.md. */
export type RespuestaCocuyo = {
  tipo: 'respuesta' | 'aclaracion' | 'fuera_de_alcance' | 'limite' | 'crisis';
  /** Tema del catálogo o intención de conversación atendida; null si no hubo ninguna. */
  intencion: string | null;
  texto: string;
  /** «ia»: redactada con IA a partir de la respuesta preparada y validada en el backend. */
  origen: 'ia' | 'predeterminada';
  enlace: { href: string; texto: string } | null;
  /** Mostrar debajo los canales institucionales verificados. */
  conCanales: boolean;
  /** Ids de temas de la guía para ofrecer como accesos rápidos. */
  sugerencias: string[];
  aviso: string | null;
};

/** Máximo de caracteres por mensaje (el backend aplica el mismo límite). */
export const LARGO_MAXIMO_MENSAJE_COCUYO = 300;

export const preguntarACocuyo = (mensaje: string, signal?: AbortSignal) =>
  api.post<RespuestaCocuyo>('/api/guia/cocuyo', { mensaje }, { signal });
