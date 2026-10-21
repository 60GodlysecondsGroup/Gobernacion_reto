import type { Metadata } from 'next';
import { VistaComunidad } from '@/components/comunidad/VistaComunidad';
import { RequiereSesion } from '@/components/sesion/RequiereSesion';

export const metadata: Metadata = { title: 'Mi comunidad' };

export default function PaginaComunidad() {
  return (
    <RequiereSesion permiso="ver_comunidad_propia">
      <VistaComunidad />
    </RequiereSesion>
  );
}
