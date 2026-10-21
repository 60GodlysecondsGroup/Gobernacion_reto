import type { Metadata } from 'next';
import { FichaCompleta } from '@/components/orientacion/FichaCompleta';

export const metadata: Metadata = { title: 'Ficha del servicio' };

export default function PaginaFichaServicio() {
  return <FichaCompleta />;
}
