'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AvatarProvisional } from '@/components/avatar/AvatarProvisional';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso, BotonEnlace, Insignia, Tarjeta } from '@/components/ui';
import { ErrorApi, mensajeDeError } from '@/lib/api/cliente';
import { obtenerPerfilPublico, type PerfilPublico } from '@/lib/api/comunidad';
import comun from '../comun.module.css';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; perfil: PerfilPublico }
  | { tipo: 'no_encontrado' }
  | { tipo: 'error'; mensaje: string };

export function VistaPerfilPublico() {
  const { id } = useParams<{ id: string }>();
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  useEffect(() => {
    let vigente = true;
    obtenerPerfilPublico(id)
      .then(({ perfil }) => vigente && setEstado({ tipo: 'listo', perfil }))
      .catch((e: unknown) => {
        if (!vigente) return;
        setEstado(
          e instanceof ErrorApi && e.estado === 404
            ? { tipo: 'no_encontrado' }
            : { tipo: 'error', mensaje: mensajeDeError(e) },
        );
      });
    return () => {
      vigente = false;
    };
  }, [id]);

  if (estado.tipo === 'cargando') return <p className={comun.cargando}>Cargando perfil…</p>;
  if (estado.tipo === 'error') return <Aviso tono="peligro">{estado.mensaje}</Aviso>;

  return (
    <div className={comun.pagina}>
      {estado.tipo === 'no_encontrado' ? (
        <Aviso tono="peligro" titulo="No encontramos ese perfil en tu comunidad" />
      ) : (
        <>
          <EncabezadoPagina antetitulo="Perfil" titulo={estado.perfil.alias} />
          <Tarjeta>
            <div className={comun.fila}>
              <AvatarProvisional
                recurso={estado.perfil.avatar?.recurso}
                tamano={64}
                etiqueta={`Avatar de ${estado.perfil.alias}`}
              />
              {estado.perfil.intereses.length > 0 ? (
                <ul className={comun.etiquetas} aria-label="Intereses">
                  {estado.perfil.intereses.map((interes) => (
                    <li key={interes}>
                      <Insignia>{interes}</Insignia>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className={comun.suave}>Sin intereses públicos.</span>
              )}
            </div>
          </Tarjeta>
        </>
      )}
      <div className={comun.fila}>
        <BotonEnlace href="/comunidad" variante="secundario">
          Volver a mi comunidad
        </BotonEnlace>
      </div>
    </div>
  );
}
