/**
 * Geometría y selección de la ruleta de Orientación. Funciones puras (sin React ni DOM): todo se
 * calcula a partir del número de temas, así la ruleta funciona igual con 3, 6 o 12.
 *
 * Ángulos en grados, medidos desde las 12 en sentido horario (como `rotate()` de CSS). El disco
 * se dibuja en un viewBox de -100 a 100 con el centro en el origen.
 */

/** Radios del anillo en unidades del viewBox. */
export const RADIO_EXTERIOR = 98;
export const RADIO_INTERIOR = 46;
export const RADIO_MEDIO = (RADIO_EXTERIOR + RADIO_INTERIOR) / 2;

/** Con más temas que estos, los sectores solo muestran el icono (el nombre sigue en el centro). */
export const MAXIMO_CON_ETIQUETA = 8;

export const indiceCircular = (indice: number, total: number) =>
  total > 0 ? ((indice % total) + total) % total : 0;

/** Ángulo que ocupa cada sector. */
export const pasoAngular = (total: number) => 360 / Math.max(total, 1);

/** Ángulo del centro del sector `indice`: el primero queda arriba. */
export const anguloDe = (indice: number, total: number) =>
  indiceCircular(indice, total) * pasoAngular(total);

/**
 * Pasos (con signo) del camino más corto entre dos sectores: de 5 a 0 en una ruleta de 6 es +1,
 * no −5. En un empate (mitad exacta) gira hacia delante.
 */
export function pasosMasCortos(desde: number, hasta: number, total: number) {
  if (total <= 1) return 0;
  const adelante = indiceCircular(hasta - desde, total);
  return adelante > total / 2 ? adelante - total : adelante;
}

/**
 * Giro acumulado tras elegir `hasta`. Es acumulado (puede pasar de 360 o ser negativo) para que
 * la transición de CSS siempre recorra el camino corto en lugar de dar la vuelta entera.
 */
export const giroHacia = (giroActual: number, desde: number, hasta: number, total: number) =>
  giroActual + pasosMasCortos(desde, hasta, total) * pasoAngular(total);

/** Posición del centro de un sector, en % del contenedor (0–100), sobre el radio medio. */
export function posicionEnRuleta(indice: number, total: number, radio = RADIO_MEDIO) {
  const angulo = (anguloDe(indice, total) * Math.PI) / 180;
  return {
    x: redondear(50 + (Math.sin(angulo) * radio) / 2),
    y: redondear(50 - (Math.cos(angulo) * radio) / 2),
  };
}

/**
 * Lado del botón de cada sector, en % del contenedor: cabe en el ancho del anillo y en la cuerda
 * del sector, para que dos botones vecinos nunca se toquen.
 */
export function tamanoBoton(total: number) {
  const anillo = (RADIO_EXTERIOR - RADIO_INTERIOR) * 0.86;
  const cuerda =
    total <= 1 ? anillo : 2 * RADIO_MEDIO * Math.sin(Math.PI / Math.max(total, 2)) * 0.86;
  return redondear(Math.min(anillo, cuerda) / 2);
}

/** Desplazamiento hacia fuera del sector elegido, en unidades del viewBox. */
export function desplazamientoSector(indice: number, total: number, distancia = 4) {
  const angulo = (anguloDe(indice, total) * Math.PI) / 180;
  return {
    x: redondear(Math.sin(angulo) * distancia),
    y: redondear(-Math.cos(angulo) * distancia),
  };
}

/**
 * Trazado SVG del sector anular `indice`, con una pequeña separación entre sectores. Con un solo
 * tema el sector es el anillo completo (dos medias vueltas, porque un arco no puede cerrarse).
 */
export function trazadoSector(
  indice: number,
  total: number,
  radioInterior = RADIO_INTERIOR,
  radioExterior = RADIO_EXTERIOR,
  separacion = 1.6,
) {
  if (total <= 1) {
    const e = radioExterior;
    const i = radioInterior;
    return [
      `M 0 ${-e} A ${e} ${e} 0 1 1 0 ${e} A ${e} ${e} 0 1 1 0 ${-e} Z`,
      `M 0 ${-i} A ${i} ${i} 0 1 0 0 ${i} A ${i} ${i} 0 1 0 0 ${-i} Z`,
    ].join(' ');
  }
  const centro = anguloDe(indice, total);
  const mitad = pasoAngular(total) / 2;
  // La separación es una distancia fija: en el borde interior ocupa más ángulo que en el exterior.
  const margenExterior = ((separacion / radioExterior) * 180) / Math.PI;
  const margenInterior = ((separacion / radioInterior) * 180) / Math.PI;
  const punto = (angulo: number, radio: number) => {
    const rad = (angulo * Math.PI) / 180;
    return `${redondear(Math.sin(rad) * radio)} ${redondear(-Math.cos(rad) * radio)}`;
  };
  const arcoGrande = mitad * 2 > 180 ? 1 : 0;
  return [
    `M ${punto(centro - mitad + margenExterior, radioExterior)}`,
    `A ${radioExterior} ${radioExterior} 0 ${arcoGrande} 1 ${punto(centro + mitad - margenExterior, radioExterior)}`,
    `L ${punto(centro + mitad - margenInterior, radioInterior)}`,
    `A ${radioInterior} ${radioInterior} 0 ${arcoGrande} 0 ${punto(centro - mitad + margenInterior, radioInterior)}`,
    'Z',
  ].join(' ');
}

/**
 * Tema al que lleva una tecla dentro de la ruleta (patrón de grupo de opciones de WAI-ARIA):
 * derecha y abajo giran hacia delante, izquierda y arriba hacia atrás, Inicio y Fin van a los
 * extremos. Devuelve `null` si la tecla no mueve la selección.
 */
export function indiceSegunTecla(tecla: string, actual: number, total: number): number | null {
  if (total <= 0) return null;
  switch (tecla) {
    case 'ArrowRight':
    case 'ArrowDown':
      return indiceCircular(actual + 1, total);
    case 'ArrowLeft':
    case 'ArrowUp':
      return indiceCircular(actual - 1, total);
    case 'Home':
      return 0;
    case 'End':
      return total - 1;
    default:
      return null;
  }
}

function redondear(valor: number) {
  const r = Math.round(valor * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}
