import type { Metadata } from 'next';
import { GestionAdministradores } from '@/components/panel/GestionAdministradores';
import { RequiereSesion } from '@/components/sesion/RequiereSesion';

export const metadata: Metadata = { title: 'Superadmin · Cuentas de administración' };

/** Sección Superadmin. El backend exige `gestionar_administradores` en cada llamada. */
export default function Pagina() {
  return (
    <RequiereSesion permiso="gestionar_administradores">
      <GestionAdministradores />
    </RequiereSesion>
  );
}
