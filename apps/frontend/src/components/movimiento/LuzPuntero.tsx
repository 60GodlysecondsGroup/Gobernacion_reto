'use client';

import { useEffect } from 'react';

/**
 * Reflejo de cristal que sigue al puntero sobre las tarjetas con la clase global `con-luz`.
 * Un único escuchador delegado para toda la página, limitado a un cálculo por fotograma, y
 * solo en dispositivos con puntero fino y sin «reducir movimiento». No dibuja nada: escribe
 * dos variables CSS (`--luz-x`, `--luz-y`) que usa `globals.css`.
 */
export function LuzPuntero() {
  useEffect(() => {
    const apto = window.matchMedia(
      '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
    );
    if (!apto.matches) return;

    let fotograma = 0;
    let ultimo: PointerEvent | null = null;

    const pintar = () => {
      fotograma = 0;
      const evento = ultimo;
      if (!evento) return;
      const tarjeta = (evento.target as Element | null)?.closest<HTMLElement>('.con-luz');
      if (!tarjeta) return;
      const caja = tarjeta.getBoundingClientRect();
      tarjeta.style.setProperty('--luz-x', `${evento.clientX - caja.left}px`);
      tarjeta.style.setProperty('--luz-y', `${evento.clientY - caja.top}px`);
    };

    const alMover = (evento: PointerEvent) => {
      ultimo = evento;
      if (!fotograma) fotograma = requestAnimationFrame(pintar);
    };

    document.addEventListener('pointermove', alMover, { passive: true });
    return () => {
      document.removeEventListener('pointermove', alMover);
      if (fotograma) cancelAnimationFrame(fotograma);
    };
  }, []);

  return null;
}
