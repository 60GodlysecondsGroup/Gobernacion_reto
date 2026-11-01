/**
 * Las cuatro comunidades por rango de edad y la estación del año con la que se ambienta su casa
 * en el valle del inicio. Ninguna estación es «mejor» que otra: cada comunidad tiene la suya.
 *
 * La estación sale del color que ya identifica a cada comunidad en la plataforma (ámbar → otoño,
 * lila → primavera, cielo → invierno, menta → verano), así no se introduce una identidad nueva ni
 * se asocia la edad con el paso del año. Para cambiar la correspondencia basta editar `temporada`.
 */
export type Temporada = 'invierno' | 'primavera' | 'verano' | 'otono';

export const TEMPORADAS: Record<Temporada, { nombre: string }> = {
  invierno: { nombre: 'Invierno' },
  primavera: { nombre: 'Primavera' },
  verano: { nombre: 'Verano' },
  otono: { nombre: 'Otoño' },
};

export const COMUNIDADES = [
  { codigo: 'A', rango: '10 a 12 años', color: '#ffc857', temporada: 'otono' },
  { codigo: 'B', rango: '13 a 15 años', color: '#c4bdff', temporada: 'primavera' },
  { codigo: 'C', rango: '16 a 17 años', color: '#8fd3ff', temporada: 'invierno' },
  { codigo: 'D', rango: '18 a 22 años', color: '#7de3c3', temporada: 'verano' },
] as const satisfies readonly {
  codigo: string;
  rango: string;
  color: string;
  temporada: Temporada;
}[];

export type Comunidad = (typeof COMUNIDADES)[number];
export type CodigoComunidad = Comunidad['codigo'];
