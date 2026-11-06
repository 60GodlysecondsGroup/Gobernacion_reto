import { useSyncExternalStore } from 'react';
import { CONSULTA_TEXTO_ESTATICO } from '@/lib/movimiento';

const suscribir = (aviso: () => void) => {
  const consulta = window.matchMedia(CONSULTA_TEXTO_ESTATICO);
  consulta.addEventListener('change', aviso);
  return () => consulta.removeEventListener('change', aviso);
};

/**
 * `true` en móvil: los componentes de texto animado muestran el texto final directamente, sin
 * temporizadores, bucles de animación ni escuchas de scroll. En el servidor se asume escritorio
 * (el CSS de cada componente ya deja el texto visible en móvil antes de hidratar).
 */
export function useTextoEstatico() {
  return useSyncExternalStore(
    suscribir,
    () => window.matchMedia(CONSULTA_TEXTO_ESTATICO).matches,
    () => false,
  );
}
