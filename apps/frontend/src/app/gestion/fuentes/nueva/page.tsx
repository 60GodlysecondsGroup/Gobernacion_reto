import type { Metadata } from 'next';
import { NuevaFuente } from '@/components/fuentes/NuevaFuente';
import { RequiereSesion } from '@/components/sesion/RequiereSesion';

export const metadata: Metadata = { title: 'Nueva fuente' };

export default function PaginaNuevaFuente() {
  return (
    <RequiereSesion permiso="gestionar_fuentes">
      <NuevaFuente />
    </RequiereSesion>
  );
}
