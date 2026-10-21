import type { Metadata } from 'next';
import { DetalleFuenteGestion } from '@/components/fuentes/DetalleFuenteGestion';
import { RequiereSesion } from '@/components/sesion/RequiereSesion';

export const metadata: Metadata = { title: 'Fuente institucional' };

export default function PaginaDetalleFuente() {
  return (
    <RequiereSesion permiso="gestionar_fuentes">
      <DetalleFuenteGestion />
    </RequiereSesion>
  );
}
