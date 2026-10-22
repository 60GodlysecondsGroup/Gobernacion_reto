import type { Metadata } from 'next';
import { DetalleReporte } from '@/components/panel/DetalleReporte';

export const metadata: Metadata = { title: 'Reporte' };

export default async function PaginaReporte({ params }: PageProps<'/panel/reportes/[id]'>) {
  const { id } = await params;
  return <DetalleReporte id={id} />;
}
