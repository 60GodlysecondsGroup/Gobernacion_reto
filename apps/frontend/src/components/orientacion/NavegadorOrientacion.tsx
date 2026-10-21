'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso } from '@/components/ui';
import { AVISO_LIMITES } from '@/config/textos';
import { mensajeDeError } from '@/lib/api/cliente';
import { obtenerNecesidades, type Necesidad } from '@/lib/api/orientacion';
import comun from '../comun.module.css';
import estilos from './Orientacion.module.css';

/**
 * Navegador de orientación (F04). Las necesidades son categorías para buscar información:
 * aquí no hay preguntas, puntajes ni mensajes sobre el estado de nadie.
 */
export function NavegadorOrientacion() {
  const [necesidades, setNecesidades] = useState<Necesidad[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    obtenerNecesidades()
      .then((r) => vigente && setNecesidades(r.necesidades))
      .catch((e: unknown) => vigente && setError(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, []);

  return (
    <div className={comun.pagina}>
      <EncabezadoPagina antetitulo="Orientación" titulo="¿Qué información buscas?">
        Elige un tema para ver servicios y canales de instituciones, siempre con su fuente y la
        fecha en que se verificaron.
      </EncabezadoPagina>

      {error && <Aviso tono="peligro">{error}</Aviso>}
      {!necesidades && !error && <p className={comun.cargando}>Cargando temas…</p>}

      {necesidades && (
        <ul className={estilos.necesidades}>
          {necesidades.map((necesidad) => (
            <li key={necesidad.codigo}>
              <Link href={`/orientacion/${necesidad.codigo}`} className={estilos.necesidad}>
                <span className={estilos.nombreNecesidad}>{necesidad.nombre}</span>
                <span className={comun.suave}>{necesidad.descripcion}</span>
                <span className={comun.suave}>
                  {necesidad.servicios === 1 ? '1 servicio' : `${necesidad.servicios} servicios`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Aviso tono="info" titulo="Qué hace y qué no hace esta plataforma">
        {AVISO_LIMITES}
      </Aviso>
    </div>
  );
}
