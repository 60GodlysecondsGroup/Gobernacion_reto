import type { CSSProperties } from 'react';
import estilos from './ShinyText.module.css';

/*
 * ShinyText — adaptado de React Bits (https://reactbits.dev, MIT + Commons Clause). Misma API
 * (text, disabled, speed, className, color, shineColor, spread, yoyo, pauseOnHover, direction,
 * delay) y el mismo degradado recortado al texto. El barrido es una animación CSS en lugar de un
 * bucle por fotograma con Motion: mismo efecto, sin JavaScript ni renders, y se detiene solo con
 * «reducir movimiento». Acepta colores como variables CSS (p. ej. para el modo oscuro).
 */
type ShinyTextProps = {
  text: string;
  disabled?: boolean;
  /** Segundos de una pasada del brillo. */
  speed?: number;
  className?: string;
  color?: string;
  shineColor?: string;
  /** Ángulo del degradado, en grados. */
  spread?: number;
  yoyo?: boolean;
  pauseOnHover?: boolean;
  direction?: 'left' | 'right';
  /** Segundos de espera antes de la primera pasada (en CSS no hay espera entre ciclos). */
  delay?: number;
};

export default function ShinyText({
  text,
  disabled = false,
  speed = 2,
  className = '',
  color = '#b5b5b5',
  shineColor = '#ffffff',
  spread = 120,
  yoyo = false,
  pauseOnHover = false,
  direction = 'left',
  delay = 0,
}: ShinyTextProps) {
  const estilo = {
    '--brillo-color': color,
    '--brillo-luz-color': shineColor,
    '--brillo-angulo': `${spread}deg`,
    '--brillo-duracion': `${speed}s`,
    '--brillo-espera': `${delay}s`,
  } as CSSProperties;

  return (
    <span
      className={`${estilos.brillo} ${className}`}
      style={estilo}
      data-desactivado={disabled || undefined}
      data-direccion={direction}
      data-vaiven={yoyo || undefined}
      data-pausa-hover={pauseOnHover || undefined}
    >
      {text}
    </span>
  );
}
