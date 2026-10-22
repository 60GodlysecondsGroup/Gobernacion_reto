import type { Metadata } from 'next';
import { RequiereSesion } from '@/components/sesion/RequiereSesion';
import { AsistenteAdmin } from '@/components/panel/AsistenteAdmin';

export const metadata: Metadata = { title: 'Asistente IA' };

export default function PaginaAsistenteAdmin() {
  return (
    <RequiereSesion permiso="usar_asistente_admin">
      <AsistenteAdmin />
    </RequiereSesion>
  );
}
