/**
 * Dibujos del avatar: pixel art original hecho por código sobre una cuadrícula de 16 × 20
 * (RF28). Cada elemento del catálogo (ELEMENTO_AVATAR) se dibuja según su `recurso`. No hay
 * imágenes externas, fotografías ni texto: solo rectángulos de colores.
 */
import type { Apariencia } from '@/lib/api/avatar';

/** Un rectángulo de la cuadrícula: x, y, ancho, alto y color. */
type Pixel = readonly [number, number, number, number, string];
type Dibujo = readonly Pixel[];

const OSCURO = '#1b2633';
const BOCA = '#8c3b2e';
const PANTALON = '#34405a';
const ZAPATO = '#1b2633';
const INTERIOR = '#cfd6de';

/** Personaje base: piel, orejas, cuello, brazos, camiseta interior, pantalón y zapatos. */
const TONOS: Record<string, { piel: string; sombra: string }> = {
  'tono-arena': { piel: '#f3cfae', sombra: '#ddb08a' },
  'tono-miel': { piel: '#e2ad79', sombra: '#c78f5c' },
  'tono-canela': { piel: '#b97a4b', sombra: '#9c6239' },
  'tono-cacao': { piel: '#7a4a2c', sombra: '#5f3820' },
};

const base = ({ piel, sombra }: { piel: string; sombra: string }): Dibujo => [
  [4, 3, 8, 8, piel],
  [3, 6, 1, 2, sombra],
  [12, 6, 1, 2, sombra],
  [7, 11, 2, 1, sombra],
  [2, 12, 1, 5, piel],
  [13, 12, 1, 5, piel],
  [3, 12, 10, 5, INTERIOR],
  [4, 17, 3, 2, PANTALON],
  [9, 17, 3, 2, PANTALON],
  [7, 17, 2, 1, PANTALON],
  [3, 19, 4, 1, ZAPATO],
  [9, 19, 4, 1, ZAPATO],
];

const OJOS: Dibujo = [
  [5, 6, 1, 2, OSCURO],
  [10, 6, 1, 2, OSCURO],
];

const RASGOS: Record<string, Dibujo> = {
  'rasgos-sonrisa': [...OJOS, [6, 8, 1, 1, BOCA], [9, 8, 1, 1, BOCA], [7, 9, 2, 1, BOCA]],
  'rasgos-tranquilo': [
    [5, 7, 2, 1, OSCURO],
    [9, 7, 2, 1, OSCURO],
    [7, 9, 2, 1, BOCA],
  ],
  'rasgos-pecas': [
    ...OJOS,
    [4, 8, 1, 1, 'rgb(120 60 30 / 0.55)'],
    [6, 8, 1, 1, 'rgb(120 60 30 / 0.55)'],
    [9, 8, 1, 1, 'rgb(120 60 30 / 0.55)'],
    [11, 8, 1, 1, 'rgb(120 60 30 / 0.55)'],
    [7, 9, 2, 1, BOCA],
  ],
  'rasgos-mejillas': [
    ...OJOS,
    [4, 8, 2, 1, 'rgb(232 110 110 / 0.55)'],
    [10, 8, 2, 1, 'rgb(232 110 110 / 0.55)'],
    [6, 9, 4, 1, BOCA],
  ],
};

/** El cabello tiene una parte detrás de la cabeza (opcional) y otra delante. */
const CABELLOS: Record<string, { atras?: Dibujo; frente: Dibujo }> = {
  'cabello-corto': {
    frente: [
      [4, 2, 8, 2, '#4a2f1d'],
      [3, 3, 1, 3, '#4a2f1d'],
      [12, 3, 1, 3, '#4a2f1d'],
      [4, 4, 3, 1, '#4a2f1d'],
      [6, 2, 3, 1, '#6e4a2e'],
    ],
  },
  'cabello-largo': {
    atras: [[3, 4, 10, 9, '#2a211f']],
    frente: [
      [4, 2, 8, 2, '#2a211f'],
      [3, 3, 1, 3, '#2a211f'],
      [12, 3, 1, 3, '#2a211f'],
      [4, 4, 2, 1, '#2a211f'],
      [10, 4, 2, 1, '#2a211f'],
      [5, 2, 2, 1, '#463833'],
    ],
  },
  'cabello-rizado': {
    frente: [
      [3, 1, 10, 3, '#3b2717'],
      [2, 2, 1, 4, '#3b2717'],
      [13, 2, 1, 4, '#3b2717'],
      [4, 0, 2, 1, '#3b2717'],
      [7, 0, 2, 1, '#3b2717'],
      [10, 0, 2, 1, '#3b2717'],
      [3, 4, 1, 2, '#3b2717'],
      [12, 4, 1, 2, '#3b2717'],
      [4, 4, 2, 1, '#3b2717'],
      [7, 4, 2, 1, '#3b2717'],
      [10, 4, 2, 1, '#3b2717'],
      [5, 1, 1, 1, '#5d3e25'],
      [9, 1, 1, 1, '#5d3e25'],
      [11, 2, 1, 1, '#5d3e25'],
    ],
  },
  'cabello-recogido': {
    frente: [
      [6, 0, 4, 2, '#7a3b1f'],
      [4, 2, 8, 2, '#7a3b1f'],
      [3, 3, 1, 3, '#7a3b1f'],
      [12, 3, 1, 3, '#7a3b1f'],
      [7, 0, 2, 1, '#a0552f'],
      [5, 2, 2, 1, '#a0552f'],
    ],
  },
};

const PRENDAS: Record<string, Dibujo> = {
  'prenda-camiseta': [
    [3, 12, 10, 5, '#3f7cc0'],
    [2, 12, 1, 2, '#3f7cc0'],
    [13, 12, 1, 2, '#3f7cc0'],
    [6, 12, 4, 1, '#2f62a0'],
  ],
  'prenda-buzo': [
    [3, 12, 10, 5, '#4f9a62'],
    [2, 12, 1, 4, '#4f9a62'],
    [13, 12, 1, 4, '#4f9a62'],
    [5, 11, 2, 1, '#3b7a4c'],
    [9, 11, 2, 1, '#3b7a4c'],
    [5, 15, 6, 1, '#3b7a4c'],
    [6, 13, 1, 1, '#e9efe6'],
    [9, 13, 1, 1, '#e9efe6'],
  ],
  'prenda-chaqueta': [
    [3, 12, 10, 5, '#d0674f'],
    [2, 12, 1, 4, '#d0674f'],
    [13, 12, 1, 4, '#d0674f'],
    [7, 12, 2, 5, '#f4f1e8'],
    [6, 12, 1, 5, '#a84d38'],
    [9, 12, 1, 5, '#a84d38'],
  ],
  'prenda-rayas': [
    [3, 12, 10, 5, '#f2efe6'],
    [2, 12, 1, 2, '#f2efe6'],
    [13, 12, 1, 2, '#f2efe6'],
    [3, 13, 10, 1, '#2f6f8f'],
    [3, 15, 10, 1, '#2f6f8f'],
    [2, 13, 1, 1, '#2f6f8f'],
    [13, 13, 1, 1, '#2f6f8f'],
  ],
};

const ACCESORIOS: Record<string, Dibujo> = {
  'accesorio-gafas': [
    [4, 6, 3, 2, 'rgb(170 215 235 / 0.5)'],
    [9, 6, 3, 2, 'rgb(170 215 235 / 0.5)'],
    [4, 5, 3, 1, OSCURO],
    [9, 5, 3, 1, OSCURO],
    [7, 6, 2, 1, OSCURO],
    [3, 6, 1, 1, OSCURO],
    [12, 6, 1, 1, OSCURO],
  ],
  'accesorio-gorra': [
    [3, 1, 10, 3, '#e0a93b'],
    [5, 0, 6, 1, '#e0a93b'],
    [7, 0, 2, 1, '#b8862a'],
    [9, 3, 6, 1, '#b8862a'],
  ],
  'accesorio-audifonos': [
    [4, 1, 8, 1, '#2b3340'],
    [3, 2, 1, 3, '#2b3340'],
    [12, 2, 1, 3, '#2b3340'],
    [2, 5, 2, 3, '#5b6b80'],
    [12, 5, 2, 3, '#5b6b80'],
  ],
};

const TONO_NEUTRO = TONOS['tono-miel']!;

/**
 * Capas en orden de dibujo: cabello de atrás, personaje, prenda, rasgos, cabello de delante y
 * accesorio. Un recurso desconocido simplemente no dibuja su capa.
 */
export function capasDe(apariencia: Apariencia | null | undefined): Dibujo[] {
  const cabello = apariencia?.cabello ? CABELLOS[apariencia.cabello] : undefined;
  return [
    cabello?.atras ?? [],
    base(TONOS[apariencia?.personaje ?? ''] ?? TONO_NEUTRO),
    (apariencia?.prenda && PRENDAS[apariencia.prenda]) || [],
    (apariencia?.rasgos && RASGOS[apariencia.rasgos]) || OJOS,
    cabello?.frente ?? [],
    (apariencia?.accesorio && ACCESORIOS[apariencia.accesorio]) || [],
  ];
}
