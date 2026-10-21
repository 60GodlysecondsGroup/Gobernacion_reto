'use client';

import { BotonEnlace } from '@/components/ui';
import { useSesion } from './ProveedorSesion';

export function AccionesInicio() {
  const { cargando, usuario } = useSesion();
  if (cargando) return null;

  if (!usuario) {
    return <BotonEnlace href="/acceso">Entrar con un usuario de prueba</BotonEnlace>;
  }
  return usuario.comunidad ? (
    <BotonEnlace href="/comunidad">Ir a {usuario.comunidad.nombre}</BotonEnlace>
  ) : (
    <BotonEnlace href="/perfil">Ir a mi perfil</BotonEnlace>
  );
}
