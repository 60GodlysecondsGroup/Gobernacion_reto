import type { Metadata } from 'next';
import { CanalesDeAyuda } from '@/components/orientacion/CanalesDeAyuda';

export const metadata: Metadata = { title: 'Necesito ayuda' };

/** Pública y a un clic desde cualquier página (botón fijo del encabezado). */
export default function PaginaAyuda() {
  return <CanalesDeAyuda />;
}
