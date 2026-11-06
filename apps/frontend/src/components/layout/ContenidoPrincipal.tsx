'use client';

import { useMarcoPanelActivo } from '@/components/panel/estadoMarcoPanel';

/**
 * `<main>` de todas las páginas. En las secciones administrativas lo marca (`data-zona`) para
 * que en escritorio ocupe todo el ancho junto a la barra lateral (ver `globals.css`).
 */
export function ContenidoPrincipal({ children }: { children: React.ReactNode }) {
  const enPanel = useMarcoPanelActivo();
  return (
    <main
      id="contenido"
      className="contenedor contenedor-principal"
      data-zona={enPanel ? 'panel' : undefined}
    >
      {children}
    </main>
  );
}
