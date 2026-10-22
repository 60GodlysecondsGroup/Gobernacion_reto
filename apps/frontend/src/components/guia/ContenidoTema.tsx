'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TarjetaServicio } from '@/components/orientacion/TarjetaServicio';
import { Aviso } from '@/components/ui';
import type { TemaGuia } from '@/config/guia';
import { mensajeDeError } from '@/lib/api/cliente';
import { obtenerCanalesDeAyuda, type FichaServicio } from '@/lib/api/orientacion';
import estilos from './Guia.module.css';

/** Canales institucionales reales, con institución, fuente y fecha de verificación (F25, B.6). */
function CanalesInstitucionales() {
  const [canales, setCanales] = useState<FichaServicio[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    obtenerCanalesDeAyuda()
      .then((r) => vigente && setCanales(r.canales.slice(0, 3)))
      .catch((e: unknown) => vigente && setError(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, []);

  if (error) return <Aviso tono="advertencia">{error}</Aviso>;
  if (!canales) return <span className="esqueleto" style={{ height: '8rem' }} />;
  if (canales.length === 0) {
    return <p>En este momento no hay canales verificados registrados.</p>;
  }
  return (
    <ul className={estilos.canales}>
      {canales.map((canal) => (
        <li key={canal.id}>
          <TarjetaServicio servicio={canal} nuevaPestana />
        </li>
      ))}
    </ul>
  );
}

export function ContenidoTema({ tema, alNavegar }: { tema: TemaGuia; alNavegar?: () => void }) {
  return (
    <div className={estilos.tema}>
      {tema.parrafos.map((parrafo) => (
        <p key={parrafo}>{parrafo}</p>
      ))}
      {tema.conCanales && <CanalesInstitucionales />}
      {tema.enlace && (
        <Link href={tema.enlace.href} className={estilos.enlaceTema} onClick={alNavegar}>
          {tema.enlace.texto}
        </Link>
      )}
    </div>
  );
}
