'use client';

import type { ComponentProps, PointerEvent } from 'react';
import estilos from './Efectos.module.css';

/**
 * Superficie con un halo de luz que sigue al puntero (patrón «Spotlight Card» de React Bits y
 * Aceternity UI, reescrito con CSS Modules). Solo cambia dos variables CSS: no provoca renders.
 * Con teclado o pantalla táctil, el halo aparece centrado al enfocar.
 */
export function Destello({
  className,
  onPointerMove,
  color = 'rgb(91 79 232 / 0.14)',
  style,
  ...resto
}: ComponentProps<'div'> & { color?: string }) {
  const mover = (evento: PointerEvent<HTMLDivElement>) => {
    const caja = evento.currentTarget.getBoundingClientRect();
    evento.currentTarget.style.setProperty('--x', `${evento.clientX - caja.left}px`);
    evento.currentTarget.style.setProperty('--y', `${evento.clientY - caja.top}px`);
    onPointerMove?.(evento);
  };
  return (
    <div
      {...resto}
      onPointerMove={mover}
      style={{ ...style, ['--color-destello' as string]: color }}
      className={[estilos.destello, className].filter(Boolean).join(' ')}
    />
  );
}
