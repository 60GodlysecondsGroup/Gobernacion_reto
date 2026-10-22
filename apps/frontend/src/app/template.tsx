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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURACION.contexto, ease: CURVA_SALIDA }}
    >
      {children}
    </motion.div>
  );
}
