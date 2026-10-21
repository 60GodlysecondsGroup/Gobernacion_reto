import type { Metadata } from 'next';
import { VistaPerfilPublico } from '@/components/perfil/VistaPerfilPublico';
import { RequiereSesion } from '@/components/sesion/RequiereSesion';

export const metadata: Metadata = { title: 'Perfil' };

export default function PaginaPerfilPublico() {
  return (
    <RequiereSesion permiso="ver_comunidad_propia">
      <VistaPerfilPublico />
    </RequiereSesion>
  );
}
