'use client';

import { ArrowRight, Compass } from 'lucide-react';
import { BotonEnlace } from '@/components/ui';
import { useSesion } from './ProveedorSesion';

export function AccionesInicio() {
  const { cargando, usuario, puede } = useSesion();
  if (cargando)
    return (
      <span
        className="esqueleto"
        style={{ width: '22rem', maxWidth: '100%', height: '3.375rem', borderRadius: 999 }}
      />
    );

  const principal = !usuario ? (
    <BotonEnlace href="/acceso" tamano="lg">
      Entrar con un usuario de prueba
      <ArrowRight aria-hidden="true" size={18} />
    </BotonEnlace>
  ) : usuario.comunidad ? (
    <BotonEnlace href="/comunidad" tamano="lg">
      Ir a {usuario.comunidad.nombre}
      <ArrowRight aria-hidden="true" size={18} />
    </BotonEnlace>
  ) : puede('revisar_reportes') ? (
    <BotonEnlace href="/panel" tamano="lg">
      Ir al panel
      <ArrowRight aria-hidden="true" size={18} />
    </BotonEnlace>
  ) : puede('gestionar_fuentes') ? (
    <BotonEnlace href="/gestion/fuentes" tamano="lg">
      Ir a las fuentes
      <ArrowRight aria-hidden="true" size={18} />
    </BotonEnlace>
  ) : (
    <BotonEnlace href="/perfil" tamano="lg">
      Ir a mi perfil
      <ArrowRight aria-hidden="true" size={18} />
    </BotonEnlace>
  );

  return (
    <>
      {principal}
      <BotonEnlace href="/orientacion" variante="secundario" tamano="lg">
        <Compass aria-hidden="true" size={18} />
        Explorar orientación
      </BotonEnlace>
    </>
  );
}
