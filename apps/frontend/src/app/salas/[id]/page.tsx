import type { Metadata } from 'next';
import { VistaSala } from '@/components/salas/VistaSala';
import { RequiereSesion } from '@/components/sesion/RequiereSesion';

export const metadata: Metadata = { title: 'Sala' };

export default function PaginaSala() {
  return (
    <RequiereSesion permiso="acceder_salas">
      <VistaSala />
    </RequiereSesion>
  );
}
