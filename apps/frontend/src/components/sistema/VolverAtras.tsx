'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { Boton } from '@/components/ui';

const sinSuscripcion = () => () => {};

/**
 * «Volver atrás», a la página anterior del historial. Solo aparece si la pestaña tiene historial: si la persona abrió
 * el enlace en una pestaña nueva no hay a dónde volver, y basta con «Ir al inicio».
 */
export function VolverAtras() {
  const router = useRouter();
  const hayHistorial = useSyncExternalStore(
    sinSuscripcion,
    () => window.history.length > 1,
    () => false,
  );

  if (!hayHistorial) return null;

  return (
    <Boton variante="secundario" tamano="lg" onClick={() => router.back()}>
      <ArrowLeft aria-hidden="true" size={18} />
      Volver atrás
    </Boton>
  );
}
