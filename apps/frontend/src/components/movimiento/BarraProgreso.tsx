'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import estilos from './BarraProgreso.module.css';

/**
 * Indicador de actividad al cambiar de página: una línea de luz azul bajo el encabezado que
 * avanza mientras carga la nueva vista y desaparece al llegar. Escucha los clics en enlaces
 * internos (no intercepta nada: la navegación sigue siendo la de Next.js).
 */
export function BarraProgreso() {
  const ruta = usePathname();
  const parametros = useSearchParams();
  const [estado, setEstado] = useState<'inactiva' | 'cargando' | 'terminando'>('inactiva');
  const ubicacion = `${ruta}?${parametros.toString()}`;
  const [ubicacionPrevia, setUbicacionPrevia] = useState(ubicacion);

  // Al cambiar la ruta, la barra se completa y se desvanece (ajuste de estado durante el render,
  // sin efecto intermedio).
  if (ubicacionPrevia !== ubicacion) {
    setUbicacionPrevia(ubicacion);
    if (estado === 'cargando') setEstado('terminando');
  }

  useEffect(() => {
    const alHacerClic = (evento: MouseEvent) => {
      if (evento.button !== 0) return;
      if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
      const enlace = (evento.target as Element | null)?.closest('a');
      if (!enlace || enlace.target === '_blank' || enlace.hasAttribute('download')) return;
      const destino = new URL(enlace.href, window.location.href);
      if (destino.origin !== window.location.origin) return;
      if (
        destino.pathname === window.location.pathname &&
        destino.search === window.location.search
      )
        return;
      setEstado('cargando');
    };
    // Fase de captura en `window`: se ejecuta antes de que `next/link` cancele el clic nativo.
    window.addEventListener('click', alHacerClic, true);
    return () => window.removeEventListener('click', alHacerClic, true);
  }, []);

  useEffect(() => {
    if (estado === 'inactiva') return;
    // «terminando»: se oculta tras el fundido. «cargando»: red de seguridad si la navegación
    // no llega a producirse (p. ej. el enlace lo cancela otro componente).
    const temporizador = setTimeout(
      () => setEstado('inactiva'),
      estado === 'terminando' ? 420 : 10000,
    );
    return () => clearTimeout(temporizador);
  }, [estado]);

  return <div className={estilos.barra} data-estado={estado} aria-hidden="true" />;
}
