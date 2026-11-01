import type { Metadata } from 'next';
import { GestionPersonal } from '@/components/panel/GestionPersonal';
import { RequiereSesion } from '@/components/sesion/RequiereSesion';

export const metadata: Metadata = { title: 'Cuentas de personal' };

export default function Pagina() {
  return (
    <RequiereSesion permiso="gestionar_personal">
      <GestionPersonal />
    </RequiereSesion>
  );
}
