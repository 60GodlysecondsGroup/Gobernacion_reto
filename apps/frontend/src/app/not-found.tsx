import type { Metadata } from 'next';
import { PaginaNoEncontrada } from '@/components/sistema/PaginaNoEncontrada';

export const metadata: Metadata = { title: 'Página no encontrada' };

/**
 * 404 de toda la aplicación. El `not-found` de la raíz atiende cualquier URL que no coincide con
 * una ruta (Next.js responde con estado HTTP 404) y también las llamadas a `notFound()`. Se dibuja
 * dentro del layout raíz, así que conserva el encabezado, el pie y la barra inferior.
 */
export default function NoEncontrada() {
  return <PaginaNoEncontrada />;
}
