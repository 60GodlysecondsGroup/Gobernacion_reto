'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Aviso } from '@/components/ui';
import type { Permiso } from '@/lib/api/sesion';
import { useSesion } from './ProveedorSesion';

/**
 * Envuelve las páginas privadas: sin sesión redirige al acceso; sin permiso muestra un aviso.
 * Es comodidad de interfaz: el backend vuelve a comprobar todo en cada llamada.
 */
export function RequiereSesion({
  permiso,
  children,
}: {
  permiso?: Permiso;
  children: React.ReactNode;
}) {
  const { cargando, usuario, puede } = useSesion();
  const router = useRouter();
  const ruta = usePathname();

  useEffect(() => {
    if (!cargando && !usuario) router.replace(`/acceso?siguiente=${encodeURIComponent(ruta)}`);
  }, [cargando, usuario, router, ruta]);

  if (cargando || !usuario) return <p aria-busy="true">Cargando…</p>;

  if (permiso && !puede(permiso)) {
    return (
      <Aviso tono="peligro" titulo="No tienes acceso a esta sección">
        Tu rol no tiene permiso para ver esta página.
      </Aviso>
    );
  }

  return children;
}
