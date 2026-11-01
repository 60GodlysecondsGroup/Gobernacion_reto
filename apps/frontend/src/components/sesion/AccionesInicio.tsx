'use client';

import { ArrowRight } from 'lucide-react';
import { BotonEnlace } from '@/components/ui';
import { useSesion } from './ProveedorSesion';

export function AccionesInicio() {
  const { cargando, usuario, puede } = useSesion();
  if (cargando)
    return (
      <span
        className="esqueleto"
        style={{ width: '17rem', maxWidth: '100%', height: '3.375rem', borderRadius: 999 }}
      />
    );

  const principal = !usuario ? (
    <BotonEnlace href="/acceso" tamano="lg">
      Iniciar con mi Avatar
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

  // Una sola acción principal: Orientación sigue a un clic en la navegación y en la portada.
  return principal;
}
