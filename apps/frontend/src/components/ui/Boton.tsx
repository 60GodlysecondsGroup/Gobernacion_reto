import type { ComponentProps } from 'react';
import estilos from './Boton.module.css';

type PropsBoton = ComponentProps<'button'> & {
  variante?: 'primario' | 'secundario' | 'fantasma';
  tamano?: 'md' | 'sm';
  /** Muestra un indicador de carga y deshabilita el botón. */
  cargando?: boolean;
};

export function Boton({
  variante = 'primario',
  tamano = 'md',
  cargando = false,
  disabled,
  type = 'button',
  className,
  children,
  ...resto
}: PropsBoton) {
  const clases = [estilos.boton, estilos[variante], estilos[tamano], className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={clases}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      {...resto}
    >
      {cargando && <span className={estilos.indicador} aria-hidden="true" />}
      {children}
    </button>
  );
}
