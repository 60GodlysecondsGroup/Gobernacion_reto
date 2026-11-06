'use client';

import Link from 'next/link';
import { useMarcoPanelActivo } from '@/components/panel/estadoMarcoPanel';
import { BotonModulosPanel } from '@/components/panel/MarcoPanel';
import estilos from './Encabezado.module.css';
import { MarcaCompleta } from './Logo';
import { Navegacion } from './Navegacion';

/**
 * Encabezado general. En las secciones administrativas (`MarcoPanel`) no se pinta en escritorio
 * (allí manda la barra lateral) y en móvil suma el botón «Módulos», que abre su cajón.
 */
export function Encabezado() {
  const enPanel = useMarcoPanelActivo();
  return (
    <header className={estilos.encabezado} data-panel={enPanel || undefined}>
      <div className={`contenedor ${estilos.barra}`}>
        {enPanel && <BotonModulosPanel />}
        <Link href="/" className={estilos.marca} aria-label="Comunidad Protegida, inicio">
          <MarcaCompleta tamano={38} compactaEnMovil />
        </Link>
        <Navegacion />
      </div>
    </header>
  );
}
