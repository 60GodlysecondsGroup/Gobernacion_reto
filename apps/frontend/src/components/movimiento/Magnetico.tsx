'use client';

import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import type { PointerEvent, ReactNode } from 'react';

const RESORTE = { stiffness: 260, damping: 20, mass: 0.5 } as const;

/**
 * Magnetismo ligero: el contenido se desplaza unos píxeles hacia el puntero y vuelve con un
 * resorte al salir. Solo con ratón, solo `transform` y sin renders de React.
 */
export function Magnetico({
  children,
  fuerza = 0.18,
  className,
}: {
  children: ReactNode;
  /** Fracción de la distancia al centro que se recorre (0–1). */
  fuerza?: number;
  className?: string;
}) {
  const reducir = useReducedMotion();
  const x = useSpring(useMotionValue(0), RESORTE);
  const y = useSpring(useMotionValue(0), RESORTE);

  const mover = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    const caja = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - caja.left - caja.width / 2) * fuerza);
    y.set((e.clientY - caja.top - caja.height / 2) * fuerza);
  };
  const soltar = () => {
    x.set(0);
    y.set(0);
  };

  if (reducir) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      style={{ x, y }}
      onPointerMove={mover}
      onPointerLeave={soltar}
    >
      {children}
    </motion.div>
  );
}
