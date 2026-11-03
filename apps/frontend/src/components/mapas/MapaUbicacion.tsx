'use client';

import { ExternalLink, MapPin } from 'lucide-react';
import { useState } from 'react';
import { CLAVE_MAPA_INCRUSTADO } from '@/config/mapas';
import { urlMapaIncrustado, type UbicacionFuente } from '@/lib/mapas';
import estilos from './MapaUbicacion.module.css';

type Props = {
  ubicacion: UbicacionFuente;
  /** Nombre del lugar para lectores de pantalla, p. ej. «Gobernación del Meta». */
  lugar: string;
  /**
   * Enlace al que lleva toda la superficie del mapa (Google Maps). Sin él (datos de
   * demostración), la vista previa no es interactiva.
   */
  enlace?: string | null;
};

/**
 * Vista previa pequeña de una ubicación. Con clave, un mapa de Google (Maps Embed API) con su
 * marcador; sin clave, una tarjeta con el pin y la dirección, que cumple la misma función.
 *
 * La superficie entera es UN enlace a Google Maps: el iframe queda fuera del orden de tabulación
 * y oculto a lectores de pantalla, para que no haya un mapa dentro del mapa que atrape el foco.
 * El iframe carga en diferido (`loading="lazy"`): no frena la ficha ni carga si no se ve.
 */
export function MapaUbicacion({ ubicacion, lugar, enlace }: Props) {
  const fuente = urlMapaIncrustado(ubicacion, CLAVE_MAPA_INCRUSTADO);
  const [cargado, setCargado] = useState(false);

  return (
    <div className={estilos.mapa}>
      {fuente ? (
        <>
          {!cargado && <span className={`esqueleto ${estilos.cargando}`} aria-hidden="true" />}
          <iframe
            className={estilos.marco}
            src={fuente}
            title={`Mapa de ${lugar}`}
            loading="lazy"
            tabIndex={-1}
            aria-hidden="true"
            onLoad={() => setCargado(true)}
          />
        </>
      ) : (
        // Sin clave (o en un entorno sin configurar): la dirección sigue a la vista.
        <div className={estilos.sinMapa} aria-hidden="true">
          <MapPin size={30} strokeWidth={2} className={estilos.pin} />
          <span className={estilos.textoSinMapa}>{ubicacion.direccion}</span>
        </div>
      )}

      {enlace && (
        <a
          className={estilos.superficie}
          href={enlace}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Ver ${lugar} en Google Maps (se abre en otra pestaña)`}
        >
          <span className={estilos.etiqueta} aria-hidden="true">
            Abrir en Google Maps
            <ExternalLink size={14} />
          </span>
        </a>
      )}
    </div>
  );
}
