'use client';

import { useState } from 'react';
import { Mueble } from '@/components/salas/Escenario2D';
import { Aviso, Boton } from '@/components/ui';
import type { SalaAdministrada, TipoObstaculo } from '@/lib/api/administracion';
import estilos from './EditorEscenario.module.css';

type Herramienta = TipoObstaculo | 'borrar' | 'aparicion';

const HERRAMIENTAS: { valor: Herramienta; etiqueta: string }[] = [
  { valor: 'mesa', etiqueta: 'Mesa' },
  { valor: 'sofa', etiqueta: 'Sofá' },
  { valor: 'cojin', etiqueta: 'Cojín' },
  { valor: 'planta', etiqueta: 'Planta' },
  { valor: 'estante', etiqueta: 'Estante' },
  { valor: 'caja', etiqueta: 'Caja' },
  { valor: 'borrar', etiqueta: 'Quitar mueble' },
  { valor: 'aparicion', etiqueta: 'Punto de entrada' },
];

type Escenario = SalaAdministrada['escenario'];

/**
 * F29: configuración del escenario de una sala. Se elige una herramienta y se hace clic en las
 * celdas. El backend valida que el área quede conectada y que la entrada esté libre.
 */
export function EditorEscenario({
  escenario,
  guardando,
  error,
  onGuardar,
  onCancelar,
}: {
  escenario: Escenario;
  guardando: boolean;
  error: string | null;
  onGuardar: (cambios: Pick<Escenario, 'obstaculos' | 'aparicion'>) => void;
  onCancelar: () => void;
}) {
  const [herramienta, setHerramienta] = useState<Herramienta>('mesa');
  const [obstaculos, setObstaculos] = useState(escenario.obstaculos);
  const [aparicion, setAparicion] = useState(escenario.aparicion);

  const enCelda = (x: number, y: number) => obstaculos.find((o) => o.x === x && o.y === y);

  function aplicar(x: number, y: number) {
    if (herramienta === 'aparicion') {
      if (!enCelda(x, y)) setAparicion({ x, y });
      return;
    }
    const sinCelda = obstaculos.filter((o) => o.x !== x || o.y !== y);
    if (herramienta === 'borrar') return setObstaculos(sinCelda);
    if (aparicion.x === x && aparicion.y === y) return;
    setObstaculos([...sinCelda, { x, y, tipo: herramienta }]);
  }

  return (
    <div className={estilos.editor}>
      <div className={estilos.herramientas} role="radiogroup" aria-label="Herramienta">
        {HERRAMIENTAS.map(({ valor, etiqueta }) => (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={herramienta === valor}
            className={estilos.herramienta}
            onClick={() => setHerramienta(valor)}
          >
            {valor !== 'borrar' && valor !== 'aparicion' && (
              <svg viewBox="0 0 16 16" width="22" height="22" aria-hidden="true">
                <Mueble tipo={valor} />
              </svg>
            )}
            {etiqueta}
          </button>
        ))}
      </div>

      <div
        className={estilos.cuadricula}
        style={{ gridTemplateColumns: `repeat(${escenario.ancho}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: escenario.alto }, (_, y) =>
          Array.from({ length: escenario.ancho }, (_, x) => {
            const mueble = enCelda(x, y);
            const entrada = aparicion.x === x && aparicion.y === y;
            return (
              <button
                key={`${x}-${y}`}
                type="button"
                className={`${estilos.celda} ${entrada ? estilos.entrada : ''}`}
                aria-label={`Fila ${y + 1}, columna ${x + 1}: ${
                  entrada ? 'punto de entrada' : mueble ? mueble.tipo : 'libre'
                }`}
                onClick={() => aplicar(x, y)}
              >
                {mueble && (
                  <svg viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges">
                    <Mueble tipo={mueble.tipo} />
                  </svg>
                )}
              </button>
            );
          }),
        )}
      </div>
      <p className={estilos.nota}>
        {obstaculos.length} muebles. La celda resaltada es el punto de entrada. Todas las celdas
        libres deben quedar conectadas: nadie puede quedar encerrado.
      </p>

      {error && <Aviso tono="peligro">{error}</Aviso>}

      <div className={estilos.botones}>
        <Boton cargando={guardando} onClick={() => onGuardar({ obstaculos, aparicion })}>
          Guardar escenario
        </Boton>
        <Boton variante="secundario" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Boton>
      </div>
    </div>
  );
}
