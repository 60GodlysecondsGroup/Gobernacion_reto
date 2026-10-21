/**
 * Personaje base provisional en pixel art, dibujado por código (recurso original, RF28).
 * Solo cambia el color de la ropa según el elemento del catálogo; el avatar completo
 * (cabello, rasgos, prendas, accesorios) llega en la Fase 6.
 */
const COLOR_ROPA: Record<string, string> = {
  'base-azul': 'var(--color-primario)',
  'base-verde': 'var(--color-exito)',
  'base-coral': 'var(--color-acento)',
};

const CABELLO = '#3b2a20';
const PIEL = '#e5b08a';
const OSCURO = '#1b2633';

export function AvatarProvisional({
  recurso,
  tamano = 40,
  etiqueta,
}: {
  recurso?: string | null;
  tamano?: number;
  /** Texto para lectores de pantalla; sin él, el avatar es decorativo. */
  etiqueta?: string;
}) {
  const ropa = (recurso && COLOR_ROPA[recurso]) || 'var(--color-texto-suave)';

  return (
    <svg
      width={tamano}
      height={tamano * 1.2}
      viewBox="0 0 10 12"
      shapeRendering="crispEdges"
      role={etiqueta ? 'img' : undefined}
      aria-label={etiqueta}
      aria-hidden={etiqueta ? undefined : true}
      focusable={etiqueta ? undefined : false}
    >
      <rect x="3" y="0" width="4" height="1" fill={CABELLO} />
      <rect x="2" y="1" width="6" height="1" fill={CABELLO} />
      <rect x="1" y="2" width="1" height="3" fill={CABELLO} />
      <rect x="8" y="2" width="1" height="3" fill={CABELLO} />
      <rect x="2" y="2" width="6" height="4" fill={PIEL} />
      <rect x="2" y="2" width="6" height="1" fill={CABELLO} />
      <rect x="3" y="3" width="1" height="1" fill={OSCURO} />
      <rect x="6" y="3" width="1" height="1" fill={OSCURO} />
      <rect x="4" y="5" width="2" height="1" fill="#b5714f" />
      <rect x="4" y="6" width="2" height="1" fill={PIEL} />
      <rect x="1" y="7" width="8" height="3" fill={ropa} />
      <rect x="1" y="10" width="1" height="1" fill={PIEL} />
      <rect x="8" y="10" width="1" height="1" fill={PIEL} />
      <rect x="3" y="10" width="4" height="2" fill={OSCURO} />
    </svg>
  );
}
