'use client';

import { Lock } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { BotonEnlace, CargandoLista, EstadoVacio } from '@/components/ui';
import type { Permiso } from '@/lib/api/sesion';
import { useSesion } from './ProveedorSesion';

/**
 * Envuelve las páginas privadas: sin sesión redirige al acceso; sin permiso explica qué pasa y
 * ofrece un camino de salida. Es comodidad de interfaz: el backend vuelve a comprobar todo en
 * cada llamada.
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

  if (cargando || !usuario) {
    return <CargandoLista filas={2} alto="6rem" etiqueta="Comprobando tu sesión…" />;
  }

  if (permiso && !puede(permiso)) {
    return (
      <EstadoVacio
        icono={Lock}
        titulo="Esta sección no está disponible para tu cuenta"
        accion={
          <BotonEnlace href="/" variante="secundario">
            Volver al inicio
          </BotonEnlace>
        }
      >
        Tu rol no tiene permiso para abrir esta página. Si crees que es un error, habla con quien
        administra la plataforma.
      </EstadoVacio>
    );
  }

  return children;
}
