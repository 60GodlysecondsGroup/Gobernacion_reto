import type { Metadata } from 'next';
import { GestionComunidades } from '@/components/panel/GestionComunidades';
import { RequiereSesion } from '@/components/sesion/RequiereSesion';

export const metadata: Metadata = { title: 'Comunidades y categorías' };

export default function Pagina() {
  return (
    <RequiereSesion permiso="configurar_comunidades">
      <GestionComunidades />
    </RequiereSesion>
  );
}
