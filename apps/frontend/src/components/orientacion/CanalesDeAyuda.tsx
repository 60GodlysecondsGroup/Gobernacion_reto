'use client';

import { useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso, BotonEnlace } from '@/components/ui';
import { AVISO_LIMITES } from '@/config/textos';
import { mensajeDeError } from '@/lib/api/cliente';
import { obtenerCanalesDeAyuda, type FichaServicio } from '@/lib/api/orientacion';
import comun from '../comun.module.css';
import { TarjetaServicio } from './TarjetaServicio';

/**
 * «Necesito ayuda» (F18): un solo paso hasta los canales institucionales, con su contacto
 * visible. La plataforma no crea protocolos propios: solo muestra lo que ofrecen las instituciones.
 */
export function CanalesDeAyuda() {
  const [canales, setCanales] = useState<FichaServicio[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    obtenerCanalesDeAyuda()
      .then((r) => vigente && setCanales(r.canales))
      .catch((e: unknown) => vigente && setError(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, []);

  return (
    <div className={comun.pagina}>
      <EncabezadoPagina antetitulo="Necesito ayuda" titulo="Canales de ayuda institucionales">
        Estos son canales que ofrecen instituciones. Cada uno indica de dónde viene la información y
        cuándo se verificó. Abre la ficha para ver todos los detalles.
      </EncabezadoPagina>

      <Aviso tono="info" titulo="Esta plataforma no presta servicios de salud">
        {AVISO_LIMITES}
      </Aviso>

      {error && <Aviso tono="peligro">{error}</Aviso>}
      {!canales && !error && <p className={comun.cargando}>Cargando canales…</p>}
      {canales && canales.length === 0 && (
        <Aviso tono="advertencia">
          En este momento no hay canales verificados registrados. Consulta Orientación.
        </Aviso>
      )}
      {canales && canales.length > 0 && (
        <ul className={comun.lista} aria-label="Canales institucionales">
          {canales.map((canal) => (
            <li key={canal.id}>
              <TarjetaServicio servicio={canal} />
            </li>
          ))}
        </ul>
      )}

      <div className={comun.fila}>
        <BotonEnlace href="/orientacion" variante="secundario">
          Ver más información por temas
        </BotonEnlace>
      </div>
    </div>
  );
}
