import type { Metadata } from 'next';
import { PanelFuentes } from '@/components/fuentes/PanelFuentes';
import { RequiereSesion } from '@/components/sesion/RequiereSesion';

export const metadata: Metadata = { title: 'Fuentes institucionales' };

export default function PaginaFuentes() {
  return (
    <RequiereSesion permiso="gestionar_fuentes">
      <PanelFuentes />
    </RequiereSesion>
  );
}
