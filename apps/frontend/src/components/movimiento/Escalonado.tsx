'use client';

import { motion, type HTMLMotionProps, type Variants } from 'motion/react';
import { CURVA_SALIDA, DESPLAZAMIENTO_ENTRADA, DURACION, PASO_ESCALONADO } from '@/lib/movimiento';

const contenedor: Variants = {
  oculto: {},
  visible: { transition: { staggerChildren: PASO_ESCALONADO, delayChildren: 0.04 } },
};

// Cada elemento se levanta sobre su base, como una tarjeta que se pone de pie, en vez de un
// simple fundido. Solo `transform` y `opacity`; con «reducir movimiento» Motion lo omite.
const elemento: Variants = {
  oculto: {
    opacity: 0,
    y: DESPLAZAMIENTO_ENTRADA + 6,
    rotateX: -14,
    scale: 0.97,
    transformPerspective: 900,
  },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 26,
      mass: 0.8,
      opacity: { duration: DURACION.contexto, ease: CURVA_SALIDA },
    },
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
