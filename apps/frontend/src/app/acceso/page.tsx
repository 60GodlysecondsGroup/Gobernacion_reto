import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SelectorAcceso } from '@/components/sesion/SelectorAcceso';

export const metadata: Metadata = { title: 'Acceso' };

export default function Acceso() {
  return (
    <Suspense fallback={<p>Cargando…</p>}>
      <SelectorAcceso />
    </Suspense>
  );
}
