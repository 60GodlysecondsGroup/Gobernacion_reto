import type { Metadata } from 'next';
import { ListaReportes } from '@/components/panel/ListaReportes';

export const metadata: Metadata = { title: 'Reportes' };

export default function PaginaReportes() {
  return <ListaReportes />;
}
