import type { Metadata } from 'next';
import { ServiciosPorNecesidad } from '@/components/orientacion/ServiciosPorNecesidad';

export const metadata: Metadata = { title: 'Orientación' };

export default function PaginaServiciosPorNecesidad() {
  return <ServiciosPorNecesidad />;
}
