'use client';

import { ElementoEscalonado, ListaEscalonada } from '@/components/movimiento/Escalonado';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso, CargandoLista, EstadoError } from '@/components/ui';
import { iconoNecesidad, tonoNecesidad } from '@/config/necesidades';
import { AVISO_LIMITES } from '@/config/textos';
import { mensajeDeError } from '@/lib/api/cliente';
import { obtenerNecesidades, type Necesidad } from '@/lib/api/orientacion';
import ventanas from '@/styles/ventanas.module.css';
import comun from '../comun.module.css';
import estilos from './Orientacion.module.css';

/**
 * Navegador de orientación (F04). Las necesidades son categorías para buscar información:
 * aquí no hay preguntas, puntajes ni mensajes sobre el estado de nadie.
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

      {necesidades && (
        <ListaEscalonada className={estilos.necesidades}>
          {necesidades.map((necesidad) => {
            const Icono = iconoNecesidad(necesidad.codigo);
            return (
              <ElementoEscalonado key={necesidad.codigo}>
                <Link
                  href={`/orientacion/${necesidad.codigo}`}
                  className={`${estilos.necesidad} con-luz`}
                >
                  <span
                    className={`${ventanas.ficha} ${ventanas[tonoNecesidad(necesidad.codigo)]}`}
                    aria-hidden="true"
                  >
                    <Icono size={22} strokeWidth={1.9} />
                  </span>
                  <span className={estilos.nombreNecesidad}>{necesidad.nombre}</span>
                  <span className={estilos.descripcionNecesidad}>{necesidad.descripcion}</span>
                  <span className={estilos.pieNecesidad}>
                    {necesidad.servicios === 1 ? '1 servicio' : `${necesidad.servicios} servicios`}
                    <ArrowRight aria-hidden="true" size={18} />
                  </span>
                </Link>
              </ElementoEscalonado>
            );
          })}
        </ListaEscalonada>
      )}

      <Aviso tono="info" titulo="Qué hace y qué no hace esta plataforma">
        {AVISO_LIMITES}
      </Aviso>
    </div>
  );
}
