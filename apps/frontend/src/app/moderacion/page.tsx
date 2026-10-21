import type { Metadata } from 'next';
import { PanelIncidencias } from '@/components/moderacion/PanelIncidencias';
import { RequiereSesion } from '@/components/sesion/RequiereSesion';

export const metadata: Metadata = { title: 'Moderación' };

export default function PaginaModeracion() {
  return (
    <RequiereSesion permiso="revisar_incidencias_dlp">
      <PanelIncidencias />
    </RequiereSesion>
  );
}
