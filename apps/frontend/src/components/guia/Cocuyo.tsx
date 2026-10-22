/**
 * Cocuyo, la guía virtual del proyecto: una luciérnaga del llano en pixel art, dibujada por código
 * (recurso original, RF28). No representa a la Gobernación del Meta ni a ninguna institución.
 */
export function Cocuyo({
  tamano = 40,
  encendido = true,
}: {
  tamano?: number;
  encendido?: boolean;
}) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {/* Antenas */}
      <rect x="5" y="1" width="1" height="2" fill="#1e2152" />
      <rect x="10" y="1" width="1" height="2" fill="#1e2152" />
      {/* Cabeza */}
      <rect x="5" y="3" width="6" height="3" fill="#1e2152" />
      <rect x="6" y="4" width="1" height="1" fill="#fff" />
      <rect x="9" y="4" width="1" height="1" fill="#fff" />
      {/* Alas */}
      <rect x="1" y="5" width="4" height="4" fill="#c7cbf5" />
      <rect x="11" y="5" width="4" height="4" fill="#c7cbf5" />
      <rect x="2" y="6" width="2" height="2" fill="#e7e8fa" />
      <rect x="12" y="6" width="2" height="2" fill="#e7e8fa" />
      {/* Cuerpo */}
      <rect x="5" y="6" width="6" height="4" fill="#3b3fa8" />
      {/* Luz */}
      {encendido && <rect x="3" y="9" width="10" height="7" fill="#f2a93b" opacity="0.25" />}
      <rect x="5" y="10" width="6" height="4" fill={encendido ? '#f2a93b' : '#8a7a5a'} />
      <rect x="6" y="14" width="4" height="1" fill={encendido ? '#f7c96f' : '#8a7a5a'} />
    </svg>
  );
}
