import type { Metadata } from 'next';
import { EditorAvatar } from '@/components/avatar/EditorAvatar';
import { RequiereSesion } from '@/components/sesion/RequiereSesion';

export const metadata: Metadata = { title: 'Mi avatar' };

export default function PaginaMiAvatar() {
  return (
    <RequiereSesion permiso="editar_perfil_propio">
      <EditorAvatar />
    </RequiereSesion>
  );
}
