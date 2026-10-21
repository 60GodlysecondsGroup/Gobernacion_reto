import type { Metadata } from 'next';
import { AccesoComunidad } from '@/components/comunidad/AccesoComunidad';
import { RequiereSesion } from '@/components/sesion/RequiereSesion';

export const metadata: Metadata = { title: 'Comunidad' };

export default function PaginaAccesoComunidad() {
  return (
    <RequiereSesion permiso="ver_comunidad_propia">
      <AccesoComunidad />
    </RequiereSesion>
  );
}
