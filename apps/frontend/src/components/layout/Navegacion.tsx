'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { enlacesNavegacion } from '@/config/navegacion';
import estilos from './Encabezado.module.css';

export function Navegacion() {
  const ruta = usePathname();

  return (
    <nav aria-label="Principal">
      <ul className={estilos.menu}>
        {enlacesNavegacion.map(({ href, etiqueta }) => {
          const activo = href === '/' ? ruta === '/' : ruta.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={estilos.enlace}
                aria-current={activo ? 'page' : undefined}
              >
                {etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
