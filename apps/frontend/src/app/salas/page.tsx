import type { Metadata } from 'next';
import { ListaSalas } from '@/components/salas/ListaSalas';
import { RequiereSesion } from '@/components/sesion/RequiereSesion';

export const metadata: Metadata = { title: 'Salas' };

export default function PaginaSalas() {
  return (
    <RequiereSesion permiso="acceder_salas">
      <ListaSalas />
    </RequiereSesion>
  );
}
