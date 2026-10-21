import type { Metadata } from 'next';
import { EditorPerfil } from '@/components/perfil/EditorPerfil';
import { RequiereSesion } from '@/components/sesion/RequiereSesion';

export const metadata: Metadata = { title: 'Mi perfil' };

export default function PaginaPerfil() {
  return (
    <RequiereSesion permiso="editar_perfil_propio">
      <EditorPerfil />
    </RequiereSesion>
  );
}
