'use client';

import { animate } from 'motion/react';
import { useLayoutEffect, useRef } from 'react';

/**
 * Número que «cuenta» hasta su valor al aparecer (indicadores del panel). El texto final es
 * el real desde el primer render, para lectores de pantalla y sin JavaScript; la animación
 * solo reescribe el contenido visible durante ~0,7 s y se omite con «reducir movimiento».
 */
export function Cifra({ valor, className }: { valor: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const nodo = ref.current;
    if (!nodo || valor <= 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const formato = new Intl.NumberFormat('es-CO');
    const control = animate(0, valor, {
      duration: Math.min(0.9, 0.4 + valor / 400),
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (actual) => {
        nodo.textContent = formato.format(Math.round(actual));
      },
    });
    return () => {
      control.stop();
      nodo.textContent = formato.format(valor);
    };
  }, [valor]);

  // `key`: si el valor cambia, React crea un nodo nuevo en lugar de actualizar un texto que la
  // animación ya reescribió.
  return (
    <span key={valor} ref={ref} className={className}>
      {new Intl.NumberFormat('es-CO').format(valor)}
    </span>
  );
}
