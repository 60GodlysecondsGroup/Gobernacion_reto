'use client';

import { useEffect, useState } from 'react';
import { TarjetaServicio } from '@/components/orientacion/TarjetaServicio';
import { Aviso, CargandoLista } from '@/components/ui';
import { AVISO_LIMITES } from '@/config/textos';
import { mensajeDeError } from '@/lib/api/cliente';
import { obtenerCanalesDeAyuda, type FichaServicio } from '@/lib/api/orientacion';
import comun from '../comun.module.css';
import estilos from './Salas.module.css';

/**
 * «Necesito ayuda» dentro de la sala: muestra un canal institucional sin sacar a la persona de
 * la sala. La lista completa y las fichas se abren en otra pestaña.
 */
export function PanelAyudaSala() {
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

  const primero = canales?.[0];

  return (
    <section className={estilos.panelAyuda} aria-labelledby="titulo-ayuda-sala">
      <h2 id="titulo-ayuda-sala" className={estilos.tituloPanel}>
        Canales de ayuda institucionales
      </h2>
      <p className={comun.suave}>{AVISO_LIMITES}</p>
      {error && <Aviso tono="peligro">{error}</Aviso>}
      {!canales && !error && <CargandoLista etiqueta="Cargando canales…" />}
      {canales && !primero && (
        <Aviso tono="advertencia">En este momento no hay canales verificados registrados.</Aviso>
      )}
      {primero && <TarjetaServicio servicio={primero} nuevaPestana />}
      <a href="/ayuda" target="_blank" rel="noopener">
        Ver todos los canales de ayuda (se abre en otra pestaña)
      </a>
    </section>
  );
}
