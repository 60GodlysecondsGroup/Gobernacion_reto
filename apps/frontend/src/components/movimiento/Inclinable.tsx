'use client';

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import type { PointerEvent, ReactNode } from 'react';

const RESORTE = { stiffness: 180, damping: 22, mass: 0.6 } as const;

/**
 * Inclinación 3D moderada que sigue al puntero (solo ratón o trackpad). Usa valores de
 * movimiento: no provoca renders de React al mover el puntero y solo anima `transform`.
 */
export function Inclinable({
  children,
  maximo = 5,
  className,
}: {
  children: ReactNode;
  /** Grados máximos de giro. */
  maximo?: number;
  className?: string;
}) {
  const reducir = useReducedMotion();
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const rotateY = useSpring(useTransform(x, [0, 1], [-maximo, maximo]), RESORTE);
  const rotateX = useSpring(useTransform(y, [0, 1], [maximo, -maximo]), RESORTE);

  const mover = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    const caja = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - caja.left) / caja.width);
    y.set((e.clientY - caja.top) / caja.height);
  };
  const soltar = () => {
    x.set(0.5);
    y.set(0.5);
  };

  if (reducir) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      onPointerMove={mover}
      onPointerLeave={soltar}
    >
      {children}
    </motion.div>
  );
}
