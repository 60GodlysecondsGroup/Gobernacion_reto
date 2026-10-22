'use client';

import { animate, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

/** Separador de miles fijo: igual en el servidor y en el navegador (evita errores de hidratación). */
const formatear = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/**
 * Número que sube hasta su valor al entrar en pantalla (patrón «Number Ticker» de Magic UI con
 * Motion). El valor final está en el HTML desde el servidor: sin JavaScript o con «reducir
 * movimiento» se ve directamente el número real.
 */
export function Contador({ valor, className }: { valor: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref, { once: true, margin: '-10% 0px' });
  const reducir = useReducedMotion();

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo || !visible || reducir || valor === 0) return;
    const control = animate(0, valor, {
      duration: Math.min(1.2, 0.5 + valor / 60),
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (actual) => {
        nodo.textContent = formatear(Math.round(actual));
      },
    });
    return () => control.stop();
  }, [visible, reducir, valor]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {formatear(valor)}
    </span>
  );
}
