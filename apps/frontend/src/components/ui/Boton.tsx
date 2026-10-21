import Link from 'next/link';
import type { ComponentProps } from 'react';
import estilos from './Boton.module.css';

type PropsBoton = ComponentProps<'button'> & {
  /** `ayuda` se reserva para «Necesito ayuda». */
  variante?: 'primario' | 'secundario' | 'fantasma' | 'ayuda';
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

/** Enlace de navegación con la apariencia de un botón. */
export function BotonEnlace({
  variante = 'primario',
  tamano = 'md',
  className,
  ...resto
}: ComponentProps<typeof Link> & Pick<PropsBoton, 'variante' | 'tamano'>) {
  const clases = [estilos.boton, estilos[variante], estilos[tamano], estilos.enlace, className]
    .filter(Boolean)
    .join(' ');
  return <Link className={clases} {...resto} />;
}
