'use client';

import { motion, type HTMLMotionProps } from 'motion/react';
import { CURVA_SALIDA, DESPLAZAMIENTO_ENTRADA, DURACION } from '@/lib/movimiento';

type Props = HTMLMotionProps<'div'> & {
  /** Segundos de espera antes de empezar (para secuencias dentro de una sección). */
  retraso?: number;
  /** `scroll`: aparece al entrar en pantalla; `montaje`: al cargar la vista. */
  cuando?: 'scroll' | 'montaje';
};

/**
 * Revela una sección con opacidad y un desplazamiento corto hacia arriba. Solo anima `opacity` y
 * `transform` (no provoca recálculos de diseño) y lo hace una sola vez.
 */
export function Aparecer({ retraso = 0, cuando = 'scroll', children, ...resto }: Props) {
  const destino = { opacity: 1, y: 0 };
  return (
    <motion.div
      initial={{ opacity: 0, y: DESPLAZAMIENTO_ENTRADA }}
      {...(cuando === 'scroll'
        ? { whileInView: destino, viewport: { once: true, amount: 0.15 } }
        : { animate: destino })}
      transition={{ duration: DURACION.contexto, ease: CURVA_SALIDA, delay: retraso }}
      {...resto}
    >
      {children}
    </motion.div>
  );
}
