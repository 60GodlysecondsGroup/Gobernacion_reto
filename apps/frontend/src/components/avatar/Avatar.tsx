import type { Apariencia } from '@/lib/api/avatar';
import { capasDe } from './capas';

/**
 * El avatar de una persona (F37), dibujado por capas a partir de su apariencia. Es el único
 * componente de avatar: lo usan el perfil, los hilos, las respuestas, el buscador y las salas.
 * Sin apariencia guardada se dibuja un personaje neutro.
 */
export function Avatar({
  apariencia,
  tamano = 40,
  etiqueta,
}: {
  apariencia: Apariencia | null | undefined;
  /** Ancho en píxeles; el alto es proporcional (16 × 20). */
  tamano?: number;
  /** Texto para lectores de pantalla; sin él, el avatar es decorativo. */
  etiqueta?: string;
}) {
  return (
    <svg
      width={tamano}
      height={tamano * 1.25}
      viewBox="0 0 16 20"
      shapeRendering="crispEdges"
      role={etiqueta ? 'img' : undefined}
      aria-label={etiqueta}
      aria-hidden={etiqueta ? undefined : true}
      focusable={etiqueta ? undefined : false}
    >
      {capasDe(apariencia).map((capa, i) => (
        <g key={i}>
          {capa.map(([x, y, ancho, alto, color], j) => (
            <rect key={j} x={x} y={y} width={ancho} height={alto} fill={color} />
          ))}
        </g>
      ))}
    </svg>
  );
}
