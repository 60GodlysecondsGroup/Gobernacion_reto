'use client';

import { motion, type HTMLMotionProps, type Variants } from 'motion/react';
import { CURVA_SALIDA, DESPLAZAMIENTO_ENTRADA, DURACION, PASO_ESCALONADO } from '@/lib/movimiento';

const contenedor: Variants = {
  oculto: {},
  visible: { transition: { staggerChildren: PASO_ESCALONADO, delayChildren: 0.04 } },
};

const elemento: Variants = {
  oculto: { opacity: 0, y: DESPLAZAMIENTO_ENTRADA, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: DURACION.contexto, ease: CURVA_SALIDA },
  },
};

/**
 * Lista cuyos elementos entran uno tras otro (efecto escalonado). Se anima al montarse o al
 * entrar en pantalla; los elementos que llegan después (p. ej. «Ver más») entran solos.
 */
export function ListaEscalonada({
  al = 'montaje',
  children,
  ...resto
}: HTMLMotionProps<'ul'> & { al?: 'montaje' | 'scroll' }) {
  return (
    <motion.ul
      variants={contenedor}
      initial="oculto"
      {...(al === 'scroll'
        ? { whileInView: 'visible', viewport: { once: true, amount: 0.1 } }
        : { animate: 'visible' })}
      {...resto}
    >
      {children}
    </motion.ul>
  );
}

export function ElementoEscalonado({ children, ...resto }: HTMLMotionProps<'li'>) {
  return (
    <motion.li variants={elemento} {...resto}>
      {children}
    </motion.li>
  );
}
