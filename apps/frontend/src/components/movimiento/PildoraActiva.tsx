'use client';

import { motion } from 'motion/react';
import { RESORTE_INDICADOR } from '@/lib/movimiento';
import estilos from './PildoraActiva.module.css';

/**
 * Fondo del filtro o pestaña activa. Al cambiar de opción, la misma pastilla se desliza a la
 * nueva (Motion `layoutId`), como en los controles segmentados de iOS. El botón que la contiene
 * necesita `position: relative` e `isolation: isolate`.
 */
export function PildoraActiva({
  grupo,
  tono = 'oscuro',
}: {
  grupo: string;
  tono?: 'oscuro' | 'claro';
}) {
  return (
    <motion.span
      layoutId={`pildora-${grupo}`}
      className={`${estilos.pildora} ${estilos[tono]}`}
      transition={RESORTE_INDICADOR}
      aria-hidden="true"
    />
  );
}
