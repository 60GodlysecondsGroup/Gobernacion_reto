import { Avatar } from '@/components/avatar/Avatar';
import type { Obstaculo, ParticipanteEnSala, TipoObstaculo } from '@/lib/api/salas';
import estilos from './Salas.module.css';

/**
 * Escenario 2D de una sala: cuadrícula con suelo, pared y muebles dibujados por código
 * (pixel art original, RF28). Solo dibuja lo que anuncia el servidor; no decide posiciones.
 */
const CELDA = 16;
const PARED = 14;

type Paleta = { suelo: [string, string]; pared: string; zocalo: string };

const PALETA_BASE: Paleta = { suelo: ['#efe5cf', '#e6d8bb'], pared: '#d8b46a', zocalo: '#a9853f' };

const PALETAS: Record<string, Paleta> = {
  'Cambios y nuevas etapas': { suelo: ['#e4ead9', '#d9e2cb'], pared: '#8fb39a', zocalo: '#5f8a6c' },
  'Vida académica': { suelo: ['#e3e9f0', '#d6dfe9'], pared: '#86a6c2', zocalo: '#58799a' },
  'Relaciones y convivencia': {
    suelo: ['#f1e2da', '#e8d4c9'],
    pared: '#d39b86',
    zocalo: '#a8705c',
  },
  'Bienestar cotidiano': PALETA_BASE,
  'Hablar con alguien': { suelo: ['#e8e2ef', '#ddd4e8'], pared: '#a594c4', zocalo: '#776697' },
};

const SOMBRA = 'rgb(27 38 51 / 0.14)';

/** Cada mueble ocupa una celda de 16×16 y se dibuja con rectángulos. */
function Mueble({ tipo }: { tipo: TipoObstaculo }) {
  switch (tipo) {
    case 'planta':
      return (
        <>
          <rect x="3" y="14" width="10" height="2" fill={SOMBRA} />
          <rect x="5" y="2" width="6" height="3" fill="#57a565" />
          <rect x="3" y="4" width="10" height="4" fill="#3f8a4f" />
          <rect x="4" y="5" width="3" height="2" fill="#57a565" />
          <rect x="9" y="3" width="3" height="2" fill="#2f6e3d" />
          <rect x="4" y="9" width="8" height="2" fill="#c97a4f" />
          <rect x="5" y="11" width="6" height="4" fill="#b5653d" />
        </>
      );
    case 'mesa':
      return (
        <>
          <rect x="1" y="14" width="14" height="2" fill={SOMBRA} />
          <rect x="1" y="5" width="14" height="6" fill="#a0703f" />
          <rect x="1" y="5" width="14" height="1" fill="#bb8a55" />
          <rect x="2" y="11" width="2" height="4" fill="#7a5230" />
          <rect x="12" y="11" width="2" height="4" fill="#7a5230" />
        </>
      );
    case 'sofa':
      return (
        <>
          <rect x="0" y="14" width="16" height="2" fill={SOMBRA} />
          <rect x="1" y="3" width="14" height="6" fill="#5b7fa8" />
          <rect x="1" y="9" width="14" height="4" fill="#6d93bd" />
          <rect x="0" y="7" width="2" height="7" fill="#4d6d92" />
          <rect x="14" y="7" width="2" height="7" fill="#4d6d92" />
          <rect x="7" y="3" width="2" height="6" fill="#4d6d92" />
        </>
      );
    case 'cojin':
      return (
        <>
          <rect x="2" y="13" width="12" height="2" fill={SOMBRA} />
          <rect x="3" y="6" width="10" height="8" fill="#c46f8c" />
          <rect x="2" y="7" width="12" height="6" fill="#c46f8c" />
          <rect x="4" y="7" width="4" height="2" fill="#d98ea7" />
          <rect x="7" y="9" width="2" height="2" fill="#9c4f69" />
        </>
      );
    case 'estante':
      return (
        <>
          <rect x="1" y="1" width="14" height="15" fill="#8a5f38" />
          <rect x="2" y="2" width="12" height="5" fill="#5e3f22" />
          <rect x="2" y="9" width="12" height="5" fill="#5e3f22" />
          <rect x="3" y="3" width="2" height="4" fill="#d36b4f" />
          <rect x="5" y="4" width="2" height="3" fill="#4f8fbf" />
          <rect x="8" y="3" width="2" height="4" fill="#e3c25a" />
          <rect x="4" y="10" width="2" height="4" fill="#6aa86b" />
          <rect x="7" y="11" width="3" height="3" fill="#b07cc6" />
          <rect x="11" y="10" width="2" height="4" fill="#4f8fbf" />
        </>
      );
    case 'caja':
      return (
        <>
          <rect x="2" y="14" width="12" height="2" fill={SOMBRA} />
          <rect x="2" y="4" width="12" height="11" fill="#c9a26a" />
          <rect x="2" y="4" width="12" height="3" fill="#dbb87f" />
          <rect x="7" y="4" width="2" height="11" fill="#a8834d" />
        </>
      );
  }
}

/** En los bordes, el nombre se alinea hacia dentro para que no se corte. */
function anclaDelNombre(x: number, ancho: number) {
  if (x === 0) return { x: -4, textAnchor: 'start' } as const;
  if (x === ancho - 1) return { x: CELDA + 4, textAnchor: 'end' } as const;
  return { x: CELDA / 2, textAnchor: 'middle' } as const;
}

export function Escenario2D({
  tema,
  ancho,
  alto,
  obstaculos,
  participantes,
  yo,
  descripcion,
}: {
  tema: string;
  ancho: number;
  alto: number;
  obstaculos: Obstaculo[];
  participantes: ParticipanteEnSala[];
  yo: string | null;
  /** Texto alternativo del escenario (posición propia y ocupación). */
  descripcion: string;
}) {
  const paleta = PALETAS[tema] ?? PALETA_BASE;
  const anchoPx = ancho * CELDA;
  const altoPx = alto * CELDA;
  // La persona propia se dibuja encima. El orden no depende de la posición: reordenar los
  // nodos al moverse cortaría la transición del desplazamiento.
  const enOrden = [...participantes].sort((a, b) => Number(a.id === yo) - Number(b.id === yo));
  const posicion = (p: ParticipanteEnSala) => ({
    transform: `translate(${p.x * CELDA}px, ${p.y * CELDA}px)`,
  });

  return (
    <svg
      className={estilos.lienzo}
      viewBox={`-6 ${-PARED - 4} ${anchoPx + 12} ${altoPx + PARED + 10}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={descripcion}
    >
      {/* Pared y zócalo */}
      <rect x="-6" y={-PARED - 4} width={anchoPx + 12} height={PARED + 4} fill={paleta.pared} />
      <rect x="-6" y="-3" width={anchoPx + 12} height="3" fill={paleta.zocalo} />
      <rect x="-6" y="0" width="6" height={altoPx + 6} fill={paleta.zocalo} />
      <rect x={anchoPx} y="0" width="6" height={altoPx + 6} fill={paleta.zocalo} />
      <rect x="0" y={altoPx} width={anchoPx} height="6" fill={paleta.zocalo} />
      {/* Ventana decorativa */}
      <rect x={anchoPx / 2 - 18} y={-PARED} width="36" height="9" fill="#f4f1e8" />
      <rect x={anchoPx / 2 - 16} y={-PARED + 1} width="15" height="7" fill="#bfe0ef" />
      <rect x={anchoPx / 2 + 1} y={-PARED + 1} width="15" height="7" fill="#bfe0ef" />

      {/* Suelo a cuadros */}
      {Array.from({ length: alto }, (_, y) =>
        Array.from({ length: ancho }, (_, x) => (
          <rect
            key={`${x}-${y}`}
            x={x * CELDA}
            y={y * CELDA}
            width={CELDA}
            height={CELDA}
            fill={paleta.suelo[(x + y) % 2]}
          />
        )),
      )}

      {obstaculos.map((o) => (
        <g key={`${o.x}-${o.y}`} transform={`translate(${o.x * CELDA} ${o.y * CELDA})`}>
          <Mueble tipo={o.tipo} />
        </g>
      ))}

      {enOrden.map((p) => (
        <g key={p.id} className={estilos.entidad} style={posicion(p)}>
          <rect x="3" y="14" width="10" height="2" fill={SOMBRA} />
          {p.id === yo && (
            <rect
              x="1.5"
              y="12.5"
              width="13"
              height="4"
              rx="2"
              fill="none"
              stroke="var(--color-primario)"
              strokeWidth="1"
            />
          )}
          <g transform="translate(1.5 -1.5)">
            <Avatar apariencia={p.avatar} tamano={13} />
          </g>
        </g>
      ))}

      {/* Los nombres van en una capa propia para que ningún mueble ni avatar los tape. */}
      {enOrden.map((p) => (
        <g key={`nombre-${p.id}`} className={estilos.entidad} style={posicion(p)}>
          <text
            {...anclaDelNombre(p.x, ancho)}
            y="-3"
            className={p.id === yo ? estilos.nombrePropio : estilos.nombre}
            paintOrder="stroke"
          >
            {p.id === yo ? `${p.alias} (tú)` : p.alias}
          </text>
        </g>
      ))}
    </svg>
  );
}
