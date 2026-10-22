import type { ReactNode } from 'react';
import estilos from './Efectos.module.css';

/**
 * Borde con una luz que recorre el contorno (patrón «Shine Border» / «Border Beam» de Magic UI,
 * reescrito en CSS puro). Se detiene con «reducir movimiento».
 */
export function BordeBrillante({
  children,
  className,
  radio = 'var(--radio-xl)',
}: {
  children: ReactNode;
  className?: string;
  radio?: string;
}) {
  return (
    <div
      className={[estilos.bordeBrillante, className].filter(Boolean).join(' ')}
      style={{ ['--radio-borde' as string]: radio }}
    >
      {children}
    </div>
  );
}
