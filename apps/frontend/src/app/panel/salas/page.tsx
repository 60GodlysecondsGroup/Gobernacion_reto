import type { Metadata } from 'next';
import { RequiereSesion } from '@/components/sesion/RequiereSesion';
import { GestionSalas } from '@/components/panel/GestionSalas';

export const metadata: Metadata = { title: 'Salas temáticas' };

export default function Pagina() {
  return (
    <RequiereSesion permiso="configurar_comunidades">
      <GestionSalas />
    </RequiereSesion>
  );
}
