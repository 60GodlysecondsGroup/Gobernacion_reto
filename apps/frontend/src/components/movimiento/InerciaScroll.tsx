'use client';

import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from 'motion/react';
import { useSyncExternalStore, type ReactNode } from 'react';

const CONSULTA = '(hover: hover) and (pointer: fine)';
const suscribir = (avisar: () => void) => {
  const lista = window.matchMedia(CONSULTA);
  lista.addEventListener('change', avisar);
  return () => lista.removeEventListener('change', avisar);
};
const conRaton = () => window.matchMedia(CONSULTA).matches;
const enServidor = () => false;

/**
 * Inercia ligada a la velocidad del scroll (inspirada en «Scroll Velocity» / «Scroll Bend»):
 * al desplazarse rápido, el contenido se inclina muy poco en la dirección contraria y vuelve con
 * un resorte al detenerse. Todo con valores de movimiento (sin renders de React) y solo
 * `transform`. Se desactiva con «reducir movimiento» y en pantallas táctiles, donde el scroll
 * con inercia del sistema ya da esa sensación y conviene ahorrar trabajo.
 */
export function InerciaScroll({
  children,
  intensidad = 1.6,
  className,
}: {
  children: ReactNode;
  /** Grados máximos de inclinación. */
  intensidad?: number;
  className?: string;
}) {
  const reducir = useReducedMotion();
  const { scrollY } = useScroll();
  const velocidad = useVelocity(scrollY);
  const suave = useSpring(velocidad, { stiffness: 140, damping: 30, mass: 0.6 });
  const skewY = useTransform(suave, [-2400, 0, 2400], [intensidad, 0, -intensidad], {
    clamp: true,
  });

  const activa = useSyncExternalStore(suscribir, conRaton, enServidor);

  return (
    <motion.div className={className} style={activa && !reducir ? { skewY } : undefined}>
      {children}
    </motion.div>
  );
}
