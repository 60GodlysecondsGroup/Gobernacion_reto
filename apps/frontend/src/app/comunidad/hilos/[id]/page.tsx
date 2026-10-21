import type { Metadata } from 'next';
import { Suspense } from 'react';
import { VistaHilo } from '@/components/comunidad/VistaHilo';
import { RequiereSesion } from '@/components/sesion/RequiereSesion';

export const metadata: Metadata = { title: 'Hilo' };

export default function PaginaHilo() {
  return (
    <RequiereSesion permiso="ver_comunidad_propia">
      <Suspense fallback={<p>Cargando…</p>}>
        <VistaHilo />
      </Suspense>
    </RequiereSesion>
  );
}
