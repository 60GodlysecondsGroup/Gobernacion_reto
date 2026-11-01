import type { Direccion } from '@/lib/api/salas';

/**
 * Lógica pura del movimiento en las salas. Cualquier entrada (teclado, joystick o la que llegue
 * después) se traduce a un vector de intención, y de ese vector sale el siguiente paso de la
 * cuadrícula. No conoce el DOM ni la conexión con el servidor.
 */

type Eje = -1 | 0 | 1;

/** Intención de movimiento: cada eje vale -1, 0 o 1 y la `y` crece hacia abajo, como en pantalla. */
export type Vector = { x: Eje; y: Eje };

export type EjePaso = 'x' | 'y';

const DESPLAZAMIENTOS: Record<Direccion, Vector> = {
  arriba: { x: 0, y: -1 },
  abajo: { x: 0, y: 1 },
  izquierda: { x: -1, y: 0 },
  derecha: { x: 1, y: 0 },
};

/** WASD por la posición física de la tecla (así sirve también con otras distribuciones) y flechas. */
const TECLAS_POR_CODIGO: Record<string, Direccion> = {
  KeyW: 'arriba',
  KeyA: 'izquierda',
  KeyS: 'abajo',
  KeyD: 'derecha',
  ArrowUp: 'arriba',
  ArrowLeft: 'izquierda',
  ArrowDown: 'abajo',
  ArrowRight: 'derecha',
};

/** Respaldo por carácter, para teclados que no informan la posición física. */
const TECLAS_POR_CARACTER: Record<string, Direccion> = {
  w: 'arriba',
  a: 'izquierda',
  s: 'abajo',
  d: 'derecha',
};

/** Por debajo de esta fracción del recorrido, el joystick no mueve: evita pasos por un roce. */
export const ZONA_MUERTA_JOYSTICK = 0.3;

/**
 * Mitad del sector de cada dirección recta, en grados. Las diagonales ocupan lo que queda (30°
 * cada una): en una cuadrícula se camina recto casi siempre, así que ir recto es más fácil.
 */
const MEDIO_SECTOR_RECTO = 30;

const signo = (n: number): Eje => (n > 0 ? 1 : n < 0 ? -1 : 0);

export function direccionDeTecla(evento: { code: string; key: string }): Direccion | undefined {
  return TECLAS_POR_CODIGO[evento.code] ?? TECLAS_POR_CARACTER[evento.key.toLowerCase()];
}

/** Suma intenciones: las opuestas se anulan. `null` si no queda ninguna. */
export function combinar(vectores: Iterable<Vector>): Vector | null {
  let x = 0;
  let y = 0;
  for (const v of vectores) {
    x += v.x;
    y += v.y;
  }
  return x || y ? { x: signo(x), y: signo(y) } : null;
}

export const vectorDeDirecciones = (direcciones: Iterable<Direccion>) =>
  combinar(Array.from(direcciones, (d) => DESPLAZAMIENTOS[d]));

/** Posición analógica del joystick (cada eje entre -1 y 1) a una de las ocho direcciones. */
export function vectorDeJoystick(
  x: number,
  y: number,
  zonaMuerta = ZONA_MUERTA_JOYSTICK,
): Vector | null {
  if (Math.hypot(x, y) < zonaMuerta) return null;
  const grados = (Math.atan2(y, x) * 180) / Math.PI;
  const ejeCercano = Math.round(grados / 90) * 90;
  if (Math.abs(grados - ejeCercano) <= MEDIO_SECTOR_RECTO) {
    const radianes = (ejeCercano * Math.PI) / 180;
    return { x: signo(Math.round(Math.cos(radianes))), y: signo(Math.round(Math.sin(radianes))) };
  }
  return { x: signo(x), y: signo(y) };
}

export const claveVector = (v: Vector | null) => (v ? `${v.x},${v.y}` : '');

/**
 * Siguiente paso para una intención. El servidor solo acepta pasos rectos, así que una diagonal
 * alterna los dos ejes (en escalera). Si un eje está bloqueado se usa el otro: el avatar se
 * desliza junto a una pared o un mueble en lugar de detenerse.
 */
export function siguientePaso(
  vector: Vector,
  ultimoEje: EjePaso,
  puedeIr: (direccion: Direccion) => boolean,
): { direccion: Direccion; eje: EjePaso; libre: boolean } {
  const porEje: Record<EjePaso, Direccion | null> = {
    x: vector.x ? (vector.x > 0 ? 'derecha' : 'izquierda') : null,
    y: vector.y ? (vector.y > 0 ? 'abajo' : 'arriba') : null,
  };
  const orden: EjePaso[] = ultimoEje === 'x' ? ['y', 'x'] : ['x', 'y'];
  const candidatos = orden.filter((eje) => porEje[eje]);
  const libre = candidatos.find((eje) => puedeIr(porEje[eje]!));
  const eje = libre ?? candidatos[0]!;
  return { direccion: porEje[eje]!, eje, libre: libre !== undefined };
}

/**
 * Las mismas reglas que valida el servidor (`mover` en `salas.escenario.ts`): bordes y muebles.
 * Las personas no bloquean. Solo sirve para anticipar; el servidor sigue decidiendo.
 */
export function esPasoLibre(
  escenario: { ancho: number; alto: number; ocupadas: ReadonlySet<string> },
  desde: { x: number; y: number },
  direccion: Direccion,
) {
  const paso = DESPLAZAMIENTOS[direccion];
  const x = desde.x + paso.x;
  const y = desde.y + paso.y;
  return (
    x >= 0 &&
    y >= 0 &&
    x < escenario.ancho &&
    y < escenario.alto &&
    !escenario.ocupadas.has(`${x},${y}`)
  );
}
