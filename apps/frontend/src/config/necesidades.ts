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

/** Nombre corto de cada necesidad para los sectores de la ruleta; el nombre completo va al centro. */
export const NOMBRES_CORTOS_NECESIDAD: Record<string, string> = {
  bienestar: 'Bienestar',
  hablar_con_alguien: 'Hablar',
  situacion_preocupa: 'Una situación',
  amigo_preocupa: 'Un amigo',
  lineas_ayuda: 'Líneas',
  informacion_institucional: 'Institucional',
};

/** Sin nombre corto registrado (un tema nuevo), se usan sus dos primeras palabras. */
export const nombreCortoNecesidad = (codigo: string, nombre: string): string =>
  NOMBRES_CORTOS_NECESIDAD[codigo] ?? nombre.split(/\s+/).slice(0, 2).join(' ');

/**
 * Edificio del pueblo de Orientación que representa cada necesidad (pixel art propio, RF28).
 * Un tema nuevo sin edificio propio se muestra como una casa, con su icono y su color.
 */
export type FormaEdificio = 'casa' | 'cafe' | 'refugio' | 'casasUnidas' | 'torre' | 'institucion';
export const EDIFICIOS_NECESIDAD: Record<string, FormaEdificio> = {
  bienestar: 'casa',
  hablar_con_alguien: 'cafe',
  situacion_preocupa: 'refugio',
  amigo_preocupa: 'casasUnidas',
  lineas_ayuda: 'torre',
  informacion_institucional: 'institucion',
};

export const edificioNecesidad = (codigo: string): FormaEdificio =>
  EDIFICIOS_NECESIDAD[codigo] ?? 'casa';
