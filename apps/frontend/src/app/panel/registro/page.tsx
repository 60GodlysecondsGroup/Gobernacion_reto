import type { Metadata } from 'next';
import { RegistroAcciones } from '@/components/panel/RegistroAcciones';

export const metadata: Metadata = { title: 'Registro de acciones' };

export default function Pagina() {
  return <RegistroAcciones />;
}
