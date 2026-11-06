import type { Transition, Variants } from 'motion/react';
import { CURVA_SALIDA } from '@/lib/movimiento';

/**
 * Coreografía de entrada del explorador de temas (Orientación):
 *  1. La ruleta llega en espiral 3D (gira una vuelta, se inclina y crece hacia la persona) y, a
 *     la vez, el marco de la tarjeta se descubre con un barrido.
 *  2. Cuando la espiral encaja, la ruleta destella y el edificio sube con un resorte.
 *  3. Después, el rótulo del tema se enfoca.
 * Con «reducir movimiento» (MotionConfig `reducedMotion="user"`) solo queda el fundido.
 */
export const DURACION_ESPIRAL = 1.05;

/** `custom` = segundos de espera antes de empezar (para no pisar la entrada del encabezado). */
export const espiralRuleta: Variants = {
  oculto: { opacity: 0, scale: 0, rotate: -360, rotateX: 45 },
  visible: (retraso: number = 0) => ({
    opacity: 1,
    scale: 1,
    rotate: 0,
    rotateX: 0,
    transition: {
      duration: DURACION_ESPIRAL,
      delay: retraso,
      ease: CURVA_SALIDA,
      opacity: { duration: 0.35, delay: retraso, ease: 'easeOut' },
    },
  }),
};

export const barridoMarco: Variants = {
  oculto: { opacity: 0, clipPath: 'inset(0% 100% 0% 0% round 28px)' },
  visible: (retraso: number = 0) => ({
    opacity: 1,
    clipPath: 'inset(0% 0% 0% 0% round 28px)',
    transition: { duration: 0.75, delay: 0.12 + retraso, ease: CURVA_SALIDA },
    // Al terminar se quita el recorte: no corta sombras, anillos de foco ni la inclinación.
    transitionEnd: { clipPath: 'none' },
  }),
};

/** Resorte elástico del edificio al llegar. */
export const RESORTE_EDIFICIO: Transition = { type: 'spring', stiffness: 120, damping: 14 };

/** Cambio de tema: despiece en el eje Z, sin parpadeo (el saliente y el entrante se cruzan). */
export const CAMBIO_TEMA: Transition = { duration: 0.42, ease: CURVA_SALIDA };

export const estadosEdificio: Variants = {
  // Antes de su llegada: abajo y algo más pequeño.
  esperando: { opacity: 0, y: 40, scale: 0.96, filter: 'blur(0px)' },
  // Al cambiar de tema: atrás y desenfocado.
  despiece: { opacity: 0, y: 0, scale: 0.95, filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
};

export const estadosRotulo: Variants = {
  esperando: { opacity: 0, scale: 0.95, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.45, ease: CURVA_SALIDA },
  },
};

/** Móvil: el rótulo aparece de golpe al encajar (mismos estados, sin fundido ni enfoque). */
export const estadosRotuloInmediato: Variants = {
  esperando: { opacity: 0, scale: 0.95, filter: 'blur(4px)' },
  visible: { opacity: 1, scale: 1, filter: 'blur(0px)', transition: { duration: 0 } },
};
