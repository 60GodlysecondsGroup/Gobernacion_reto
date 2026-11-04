'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Desplazamiento de profundidad ligado al scroll de la ventana: el contenido se queda un poco
 * atrás mientras la página sube. Una sola suscripción compartida (`useScroll`), sin listeners
 * propios y solo `transform`.
 */
export function Paralaje({
  children,
  distancia = 48,
  className,
}: {
  children: ReactNode;
  /** Píxeles recorridos durante los primeros 700 px de scroll. */
  distancia?: number;
  className?: string;
}) {
  const reducir = useReducedMotion();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 700], [0, -distancia], { clamp: true });

  return (
    <motion.div className={className} style={reducir ? undefined : { y }}>
      {children}
    </motion.div>
  );
}
