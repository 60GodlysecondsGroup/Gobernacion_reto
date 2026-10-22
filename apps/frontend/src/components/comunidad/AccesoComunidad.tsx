'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso, BotonEnlace, CargandoLista } from '@/components/ui';
import { ErrorApi, mensajeDeError } from '@/lib/api/cliente';
import { obtenerComunidad, type Comunidad } from '@/lib/api/comunidad';
import comun from '../comun.module.css';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'propia'; comunidad: Comunidad }
  | { tipo: 'no_disponible' }
  | { tipo: 'error'; mensaje: string };

/**
 * Acceso directo a /comunidades/<id o A–D>. El backend responde 404 tanto si la comunidad
 * no existe como si es de otro rango, así que aquí tampoco se distingue.
 */
export function AccesoComunidad() {
  const { referencia } = useParams<{ referencia: string }>();
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  useEffect(() => {
    let vigente = true;
    obtenerComunidad(referencia)
      .then(({ comunidad }) => vigente && setEstado({ tipo: 'propia', comunidad }))
      .catch((e: unknown) => {
        if (!vigente) return;
        setEstado(
          e instanceof ErrorApi && e.estado === 404
            ? { tipo: 'no_disponible' }
            : { tipo: 'error', mensaje: mensajeDeError(e) },
        );
      });
    return () => {
      vigente = false;
    };
  }, [referencia]);

  if (estado.tipo === 'cargando') return <CargandoLista etiqueta="Buscando la comunidad…" />;
  if (estado.tipo === 'error') return <Aviso tono="peligro">{estado.mensaje}</Aviso>;

  return (
    <div className={comun.pagina}>
      <EncabezadoPagina antetitulo="Comunidades" titulo="Acceso a una comunidad" />
      {estado.tipo === 'no_disponible' ? (
        <Aviso tono="peligro" titulo="No encontramos esa comunidad">
          Solo puedes entrar a la comunidad de tu rango de edad. Las demás no son visibles.
        </Aviso>
      ) : (
        <Aviso tono="exito" titulo={`${estado.comunidad.nombre} es tu comunidad`}>
          {estado.comunidad.descripcion}
        </Aviso>
      )}
      <div className={comun.fila}>
        <BotonEnlace href="/comunidad">Ir a mi comunidad</BotonEnlace>
      </div>
    </div>
  );
}
