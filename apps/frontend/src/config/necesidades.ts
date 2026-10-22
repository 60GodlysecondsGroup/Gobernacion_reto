import type { LucideIcon } from 'lucide-react';
import { Building, HandHeart, Leaf, MessageCircleHeart, PhoneCall, Users } from 'lucide-react';

/** Icono de cada necesidad del navegador (F04). Solo apoyo visual: el texto siempre la nombra. */
export const ICONOS_NECESIDAD: Record<string, LucideIcon> = {
  bienestar: Leaf,
  hablar_con_alguien: MessageCircleHeart,
  situacion_preocupa: HandHeart,
  amigo_preocupa: Users,
  lineas_ayuda: PhoneCall,
  informacion_institucional: Building,
};

export const iconoNecesidad = (codigo: string): LucideIcon => ICONOS_NECESIDAD[codigo] ?? Leaf;

/** Color de acento de cada necesidad: las cuatro luces de las ventanas de la marca. */
export type TonoVentana = 'cielo' | 'ambar' | 'menta' | 'lila';
export const TONOS_NECESIDAD: Record<string, TonoVentana> = {
  bienestar: 'menta',
  hablar_con_alguien: 'lila',
  situacion_preocupa: 'ambar',
  amigo_preocupa: 'cielo',
  lineas_ayuda: 'lila',
  informacion_institucional: 'cielo',
};

export const tonoNecesidad = (codigo: string): TonoVentana => TONOS_NECESIDAD[codigo] ?? 'lila';
