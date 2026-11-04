import type { CSSProperties, ElementType, ReactNode } from 'react';
import estilos from './TextoRevelado.module.css';

/** Un tramo del texto: cadena simple o texto con una clase propia (p. ej. el resalte del título). */
export type TramoTexto = string | { texto: string; className?: string };

type Efecto = 'mascara' | 'desenfoque' | 'inclinado' | 'letras';

type Props = {
  as?: ElementType;
  tramos: TramoTexto[];
  /**
   * - `mascara`: cada palabra sube desde detrás de una máscara.
   * - `desenfoque`: cada palabra pasa de desenfocada a nítida.
   * - `inclinado`: cada palabra gira sobre su base, como una tarjeta que se levanta.
   * - `letras`: cada letra sube con un escalonado corto (textos breves).
   */
  efecto?: Efecto;
  /** `montaje`: al cargar la vista. `scroll`: ligado al desplazamiento mientras entra en pantalla. */
  cuando?: 'montaje' | 'scroll';
  /** Retraso inicial en milisegundos (solo `montaje`). */
  retraso?: number;
  /** Milisegundos entre una pieza y la siguiente (solo `montaje`). */
  paso?: number;
  className?: string;
  id?: string;
};

/**
 * Texto que se revela por palabras o letras. Todo es CSS (opacity, transform y un filtro corto):
 * se ve aunque la página no se haya hidratado, no mueve el diseño y, con «reducir movimiento» o
 * sin soporte de animaciones ligadas al scroll, el texto aparece tal cual. El contenido es el
 * mismo texto real, legible por lectores de pantalla.
 */
export function TextoRevelado({
  as: Etiqueta = 'span',
  tramos,
  efecto = 'mascara',
  cuando = 'montaje',
  retraso = 0,
  paso = 45,
  className,
  id,
}: Props) {
  // La clase del tramo va en un span interior: el recorte de texto (`background-clip: text`)
  // funciona sobre el propio texto aunque su contenedor se esté transformando.
  let indice = 0;
  const piezas: ReactNode[] = [];

  tramos.forEach((tramo, t) => {
    const texto = typeof tramo === 'string' ? tramo : tramo.texto;
    const clase = typeof tramo === 'string' ? undefined : tramo.className;
    texto.split(/(\s+)/).forEach((palabra, p) => {
      if (!palabra) return;
      if (/^\s+$/.test(palabra)) {
        piezas.push(' ');
        return;
      }
      const contenido =
        efecto === 'letras' ? (
          Array.from(palabra).map((letra, l) => (
            <span key={l} className={estilos.interior} style={{ '--i': indice++ } as CSSProperties}>
              {clase ? <span className={clase}>{letra}</span> : letra}
            </span>
          ))
        ) : (
          <span className={estilos.interior} style={{ '--i': indice++ } as CSSProperties}>
            {clase ? <span className={clase}>{palabra}</span> : palabra}
          </span>
        );
      piezas.push(
        <span key={`${t}-${p}`} className={estilos.palabra}>
          {contenido}
        </span>,
      );
    });
  });

  return (
    <Etiqueta
      id={id}
      className={[estilos.texto, className].filter(Boolean).join(' ')}
      data-efecto={efecto}
      data-cuando={cuando}
      style={{ '--retraso': `${retraso}ms`, '--paso': `${paso}ms` } as CSSProperties}
    >
      {piezas}
    </Etiqueta>
  );
}
