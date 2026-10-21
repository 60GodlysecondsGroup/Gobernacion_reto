import type { Metadata } from 'next';
import { NavegadorOrientacion } from '@/components/orientacion/NavegadorOrientacion';

export const metadata: Metadata = { title: 'Orientación' };

/** Pública: la información institucional no exige iniciar sesión. */
export default function PaginaOrientacion() {
  return <NavegadorOrientacion />;
}
