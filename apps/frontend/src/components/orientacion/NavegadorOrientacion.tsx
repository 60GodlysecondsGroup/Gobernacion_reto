'use client';

import { useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso, CargandoLista, EstadoError, EstadoVacio } from '@/components/ui';
import { AVISO_LIMITES } from '@/config/textos';
import { mensajeDeError } from '@/lib/api/cliente';
import { obtenerNecesidades, type Necesidad } from '@/lib/api/orientacion';
import comun from '../comun.module.css';
import { ExploradorTemas } from './ExploradorTemas';

/**
 * Navegador de orientación (F04). Las necesidades son categorías para buscar información:
 * aquí no hay preguntas, puntajes ni mensajes sobre el estado de nadie. Se eligen con la ruleta
 * de temas y se entra por el edificio de cada uno (`ExploradorTemas`).
 */
export function NavegadorOrientacion() {
  const [necesidades, setNecesidades] = useState<Necesidad[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    obtenerNecesidades()
      .then((r) => vigente && setNecesidades(r.necesidades))
      .catch((e: unknown) => vigente && setError(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, [intento]);

  return (
    <div className={comun.paginaAncha}>
      <EncabezadoPagina antetitulo="Orientación" titulo="¿Qué información buscas?">
        Elige un tema para ver servicios y canales de instituciones, siempre con su fuente y la
        fecha en que se verificaron.
      </EncabezadoPagina>

      {error && (
        <EstadoError
          alReintentar={() => {
            setError(null);
            setIntento((n) => n + 1);
          }}
        >
          {error}
        </EstadoError>
      )}
      {!necesidades && !error && (
        <CargandoLista filas={2} alto="11rem" etiqueta="Cargando temas…" />
      )}

      {necesidades && necesidades.length === 0 && (
        <EstadoVacio titulo="Aún no hay temas disponibles">
          Mientras tanto, «Necesito ayuda» muestra los canales institucionales disponibles.
        </EstadoVacio>
      )}
      {necesidades && necesidades.length > 0 && <ExploradorTemas necesidades={necesidades} />}

      <Aviso tono="info" titulo="Qué hace y qué no hace esta plataforma">
        {AVISO_LIMITES}
      </Aviso>
    </div>
  );
}
