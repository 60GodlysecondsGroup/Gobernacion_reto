import type { ReactNode } from 'react';
import estilos from './Insignia.module.css';

export type TonoInsignia = 'neutro' | 'info' | 'exito' | 'advertencia' | 'peligro';

/** Etiqueta de estado con punto de color. El texto siempre acompaña al color (no depende solo de él). */
export function Insignia({
  tono = 'neutro',
  children,
}: {
  tono?: TonoInsignia;
  children: ReactNode;
}) {
  return (
    <span className={`${estilos.insignia} ${estilos[tono]}`}>
      <span className={estilos.punto} aria-hidden="true" />
      {children}
    </span>
  );
}
