import type { Metadata } from 'next';
import { GestionUsuarios } from '@/components/panel/GestionUsuarios';

export const metadata: Metadata = { title: 'Usuarios' };

export default function Pagina() {
  return <GestionUsuarios />;
}
