import type { Metadata } from 'next';
import { AsistenteUsuario } from '@/components/asistente-usuario/AsistenteUsuario';
import { RequiereSesion } from '@/components/sesion/RequiereSesion';

export const metadata: Metadata = { title: 'Asistente de orientación' };

export default function PaginaAsistenteUsuario() {
  return (
    <RequiereSesion permiso="usar_asistente_usuario">
      <AsistenteUsuario />
    </RequiereSesion>
  );
}
