'use client';

import { motion } from 'motion/react';
import { CURVA_SALIDA, DURACION } from '@/lib/movimiento';

/**
 * Transición entre páginas: cada vista nueva entra con un fundido y un desplazamiento corto.
 * `template` se vuelve a montar en cada navegación (a diferencia de `layout`), así que la
 * animación acompaña cada cambio de ruta sin retrasar los clics.
 */
export default function Plantilla({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      // Cada vista llega desde un poco más atrás (escala) y abajo, y se asienta con un resorte
      // amortiguado: profundidad sin retrasar los clics ni ocultar el contenido mucho tiempo.
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 32,
        opacity: { duration: DURACION.contexto, ease: CURVA_SALIDA },
      }}
    >
      {children}
    </motion.div>
  );
}
