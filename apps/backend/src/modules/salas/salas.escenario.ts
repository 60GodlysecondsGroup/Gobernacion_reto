/**
 * Escenario 2D de una sala (F38): cuadrícula con área jugable y obstáculos definidos en datos.
 * Funciones puras: el gestor de salas las usa para validar cada movimiento en el servidor.
 */

export const TIPOS_OBSTACULO = ['planta', 'mesa', 'sofa', 'cojin', 'estante', 'caja'] as const;
export type TipoObstaculo = (typeof TIPOS_OBSTACULO)[number];

export type Obstaculo = { x: number; y: number; tipo: TipoObstaculo };
export type Posicion = { x: number; y: number };
export type Direccion = 'arriba' | 'abajo' | 'izquierda' | 'derecha';

export type Escenario = {
  ancho: number;
  alto: number;
  obstaculos: Obstaculo[];
  aparicion: Posicion;
};

export type ResultadoMovimiento =
  { valido: true; posicion: Posicion } | { valido: false; motivo: 'limite' | 'obstaculo' };

export const DIRECCIONES: Record<Direccion, Posicion> = {
  arriba: { x: 0, y: -1 },
  abajo: { x: 0, y: 1 },
  izquierda: { x: -1, y: 0 },
  derecha: { x: 1, y: 0 },
};

const clave = ({ x, y }: Posicion) => `${x},${y}`;

/** Lee los obstáculos guardados en la base, descartando lo que no sea una celda válida. */
export function leerObstaculos(datos: unknown, ancho: number, alto: number): Obstaculo[] {
  if (!Array.isArray(datos)) return [];
  return datos.flatMap((item) => {
    const { x, y, tipo } = (item ?? {}) as Partial<Obstaculo>;
    const dentro =
      Number.isInteger(x) && Number.isInteger(y) && x! >= 0 && y! >= 0 && x! < ancho && y! < alto;
    if (!dentro) return [];
    return [{ x: x!, y: y!, tipo: TIPOS_OBSTACULO.includes(tipo!) ? tipo! : 'caja' }];
  });
}

export const esTransitable = (escenario: Escenario, { x, y }: Posicion) =>
  x >= 0 &&
  y >= 0 &&
  x < escenario.ancho &&
  y < escenario.alto &&
  !escenario.obstaculos.some((o) => o.x === x && o.y === y);

/** RF25: el avatar no sale del área jugable ni atraviesa obstáculos. */
export function mover(
  escenario: Escenario,
  desde: Posicion,
  direccion: Direccion,
): ResultadoMovimiento {
  const paso = DIRECCIONES[direccion];
  const destino = { x: desde.x + paso.x, y: desde.y + paso.y };
  if (
    destino.x < 0 ||
    destino.y < 0 ||
    destino.x >= escenario.ancho ||
    destino.y >= escenario.alto
  ) {
    return { valido: false, motivo: 'limite' };
  }
  if (!esTransitable(escenario, destino)) return { valido: false, motivo: 'obstaculo' };
  return { valido: true, posicion: destino };
}

/**
 * Celda de entrada: el punto de aparición o, si está ocupado, la celda libre más cercana
 * (búsqueda en anchura). Los avatares pueden cruzarse; solo se evita aparecer encimados.
 */
export function puntoDeAparicion(escenario: Escenario, ocupadas: Posicion[]): Posicion {
  const ocupado = new Set(ocupadas.map(clave));
  const visitadas = new Set<string>();
  const cola: Posicion[] = [escenario.aparicion];
  while (cola.length > 0) {
    const actual = cola.shift()!;
    if (visitadas.has(clave(actual))) continue;
    visitadas.add(clave(actual));
    if (esTransitable(escenario, actual) && !ocupado.has(clave(actual))) return actual;
    for (const paso of Object.values(DIRECCIONES)) {
      const vecina = { x: actual.x + paso.x, y: actual.y + paso.y };
      if (
        vecina.x >= 0 &&
        vecina.y >= 0 &&
        vecina.x < escenario.ancho &&
        vecina.y < escenario.alto
      ) {
        cola.push(vecina);
      }
    }
  }
  return escenario.aparicion;
}
