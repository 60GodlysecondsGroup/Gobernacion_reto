import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AccesoPersonal } from '@/components/sesion/AccesoPersonal';

export const metadata: Metadata = { title: 'Acceso del equipo' };

export default function PaginaAccesoPersonal() {
  return (
    <Suspense fallback={<p>Cargando…</p>}>
      <AccesoPersonal />
    </Suspense>
  );
}
