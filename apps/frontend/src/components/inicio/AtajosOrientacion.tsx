'use client';

import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Destello } from '@/components/efectos/Destello';
import { EstadoError } from '@/components/ui';
import { iconoNecesidad, tonoNecesidad } from '@/config/necesidades';
import { mensajeDeError } from '@/lib/api/cliente';
import { obtenerNecesidades, type Necesidad } from '@/lib/api/orientacion';
import ventanas from '@/styles/ventanas.module.css';
import estilos from './AtajosOrientacion.module.css';

/** Las seis necesidades del navegador (F04), con su número real de servicios. */
export function AtajosOrientacion() {
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

  if (error) {
    return (
      <EstadoError
        titulo="No pudimos cargar los temas"
        alReintentar={() => {
          setError(null);
          setIntento((n) => n + 1);
        }}
      >
        {error} Mientras tanto, puedes abrir <Link href="/orientacion">Orientación</Link> o{' '}
        <Link href="/ayuda">Necesito ayuda</Link> directamente.
      </EstadoError>
    );
  }

  return (
    <ul className={estilos.lista} aria-busy={!necesidades}>
      {(necesidades ?? Array.from({ length: 6 }, () => null)).map((necesidad, i) => {
        if (!necesidad) {
          return (
            <li key={i}>
              <span className={`esqueleto ${estilos.esqueleto}`} />
            </li>
          );
        }
        const Icono = iconoNecesidad(necesidad.codigo);
        return (
          <li key={necesidad.codigo}>
            <Destello className={estilos.marco}>
              <Link href={`/orientacion/${necesidad.codigo}`} className={estilos.atajo}>
                <span
                  className={`${ventanas.ficha} ${ventanas[tonoNecesidad(necesidad.codigo)]}`}
                  aria-hidden="true"
                >
                  <Icono size={22} strokeWidth={1.9} />
                </span>
                <span className={estilos.textos}>
                  <span className={estilos.nombre}>{necesidad.nombre}</span>
                  <span className={estilos.cuenta}>
                    {necesidad.servicios === 1 ? '1 servicio' : `${necesidad.servicios} servicios`}
                  </span>
                </span>
                <ArrowUpRight aria-hidden="true" size={20} className={estilos.flecha} />
              </Link>
            </Destello>
          </li>
        );
      })}
    </ul>
  );
}
