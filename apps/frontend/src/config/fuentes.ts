import type { TonoInsignia } from '@/components/ui';

export type EstadoFuente = 'activo' | 'requiere_revision' | 'inactivo';
export type TipoCanal = 'telefono' | 'web' | 'presencial' | 'chat' | 'otro';

/** Semáforo de F34: verde activo, amarillo en revisión, rojo inactivo. Siempre con texto. */
export const ESTADOS_FUENTE: Record<EstadoFuente, { etiqueta: string; tono: TonoInsignia }> = {
  activo: { etiqueta: 'Activo', tono: 'exito' },
  requiere_revision: { etiqueta: 'Requiere revisión', tono: 'advertencia' },
  inactivo: { etiqueta: 'Inactivo', tono: 'peligro' },
};

export const TIPOS_CANAL: Record<TipoCanal, string> = {
  telefono: 'Teléfono',
  web: 'Sitio web',
  presencial: 'Presencial',
  chat: 'Chat',
  otro: 'Otro',
};
