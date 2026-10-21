'use client';

import { useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso, Insignia } from '@/components/ui';
import { mensajeDeError } from '@/lib/api/cliente';
import { obtenerComunidadPropia, type Comunidad } from '@/lib/api/comunidad';
import comun from '../comun.module.css';
import { BuscadorPersonas } from './BuscadorPersonas';

export function VistaComunidad() {
  const [comunidad, setComunidad] = useState<Comunidad | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    obtenerComunidadPropia()
      .then(({ comunidad }) => vigente && setComunidad(comunidad))
      .catch((e: unknown) => vigente && setError(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, []);

  if (error) return <Aviso tono="peligro">{error}</Aviso>;
  if (!comunidad) return <p className={comun.cargando}>Cargando tu comunidad…</p>;

  return (
    <div className={comun.pagina}>
      <EncabezadoPagina antetitulo="Tu comunidad" titulo={comunidad.nombre}>
        <div className={comun.fila}>
          <span>{comunidad.descripcion}</span>
          <Insignia tono="info">Rango {comunidad.rango}</Insignia>
        </div>
      </EncabezadoPagina>

      <Aviso tono="info" titulo="Un espacio solo para tu rango de edad">
        Solo ves contenido y personas de esta comunidad. Las demás comunidades no aparecen en
        búsquedas ni se pueden abrir, y nadie de otro rango puede ver este espacio.
      </Aviso>

      <BuscadorPersonas />
    </div>
  );
}
