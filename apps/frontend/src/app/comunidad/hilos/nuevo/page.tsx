import type { Metadata } from 'next';
import { NuevoHilo } from '@/components/comunidad/NuevoHilo';
import { RequiereSesion } from '@/components/sesion/RequiereSesion';

export const metadata: Metadata = { title: 'Crear hilo' };

export default function PaginaNuevoHilo() {
  return (
    <RequiereSesion permiso="crear_hilo">
      <NuevoHilo />
    </RequiereSesion>
  );
}
