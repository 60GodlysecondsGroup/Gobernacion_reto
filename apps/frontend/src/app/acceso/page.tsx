import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Acceso } from '@/components/sesion/Acceso';
import { EscenaAcceso } from '@/components/sesion/EscenaAcceso';

export const metadata: Metadata = { title: 'Iniciar con mi Avatar' };

export default function PaginaAcceso() {
  return (
    <Suspense fallback={<p>Cargando…</p>}>
      <EscenaAcceso>
        <Acceso />
      </EscenaAcceso>
    </Suspense>
  );
}
