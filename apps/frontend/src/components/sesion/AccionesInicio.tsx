'use client';

import { BotonEnlace } from '@/components/ui';
import { useSesion } from './ProveedorSesion';

export function AccionesInicio() {
  const { cargando, usuario, puede } = useSesion();
  if (cargando) return null;

  const principal = !usuario ? (
    <BotonEnlace href="/acceso">Entrar con un usuario de prueba</BotonEnlace>
  ) : usuario.comunidad ? (
    <BotonEnlace href="/comunidad">Ir a {usuario.comunidad.nombre}</BotonEnlace>
  ) : puede('gestionar_fuentes') ? (
    <BotonEnlace href="/gestion/fuentes">Ir a las fuentes</BotonEnlace>
  ) : (
    <BotonEnlace href="/perfil">Ir a mi perfil</BotonEnlace>
  );

  return (
    <>
      {principal}
      <BotonEnlace href="/orientacion" variante="secundario">
        Explorar orientación
      </BotonEnlace>
    </>
  );
}
