/** Marca propia en estilo pixel art, dibujada por código (recurso original, RF28). */
export function Logo({ tamano = 32 }: { tamano?: number }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 12 12"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="0" width="4" height="1" fill="var(--color-primario-oscuro)" />
      <rect x="3" y="1" width="6" height="1" fill="var(--color-primario-oscuro)" />
      <rect x="2" y="2" width="8" height="1" fill="var(--color-primario-oscuro)" />
      <rect x="1" y="3" width="10" height="1" fill="var(--color-primario-oscuro)" />
      <rect x="2" y="4" width="8" height="8" fill="var(--color-primario)" />
      <rect x="3" y="5" width="2" height="2" fill="var(--color-ventana)" />
      <rect x="7" y="5" width="2" height="2" fill="var(--color-ventana)" />
      <rect x="5" y="8" width="2" height="4" fill="var(--color-acento)" />
    </svg>
  );
}
