import type { ReactNode } from 'react';
import estilos from './Efectos.module.css';

/**
 * Panel oscuro con una aurora suave en los colores de las ventanas (patrón «Aurora Background»
 * de Aceternity UI, en CSS: tres halos desenfocados que derivan despacio). Decorativo.
 */
export function FondoAurora({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={[estilos.aurora, className].filter(Boolean).join(' ')}>
      <div className={estilos.capasAurora} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className={estilos.contenidoAurora}>{children}</div>
    </div>
  );
}
