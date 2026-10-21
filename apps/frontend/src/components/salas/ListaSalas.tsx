'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso, BotonEnlace } from '@/components/ui';
import { mensajeDeError } from '@/lib/api/cliente';
import { listarSalas, type SalaResumen } from '@/lib/api/salas';
import comun from '../comun.module.css';
import { OcupacionSala } from './OcupacionSala';
import estilos from './Salas.module.css';

/** La ocupación cambia en vivo: la lista se refresca cada cierto tiempo. */
const REFRESCO_MS = 10_000;

/** Salas temáticas de la propia comunidad (F11). Las salas son fijas: nadie las crea. */
export function ListaSalas() {
  const [salas, setSalas] = useState<SalaResumen[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    const cargar = () =>
      listarSalas()
        .then((r) => {
          if (!vigente) return;
          setSalas(r.salas);
          setError(null);
        })
        .catch((e: unknown) => vigente && setError(mensajeDeError(e)));
    void cargar();
    const intervalo = setInterval(cargar, REFRESCO_MS);
    return () => {
      vigente = false;
      clearInterval(intervalo);
    };
  }, []);

  return (
    <div className={comun.pagina}>
      <EncabezadoPagina antetitulo="Tu comunidad" titulo="Salas temáticas">
        Espacios en vivo para conversar por temas con personas de tu comunidad. Cada sala admite
        hasta 10 personas a la vez.
      </EncabezadoPagina>

      <Aviso tono="info">
        En las salas entras con tu alias y tu avatar. Los mensajes se revisan antes de mostrarse y
        no se guardan. Si una sala queda vacía un tiempo, se cierra y se abre otra del mismo tema.
        Lee las <Link href="/reglas">reglas de la comunidad</Link> antes de entrar.
      </Aviso>

      {error && <Aviso tono="peligro">{error}</Aviso>}
      {!salas && !error && <p className={comun.cargando}>Cargando salas…</p>}
      {salas && salas.length === 0 && (
        <Aviso tono="advertencia">Tu comunidad no tiene salas abiertas en este momento.</Aviso>
      )}
      {salas && salas.length > 0 && (
        <ul className={estilos.listaSalas} aria-label="Salas de tu comunidad">
          {salas.map((sala) => (
            <li key={sala.id} className={estilos.tarjetaSala}>
              <h2 className={estilos.nombreSala}>{sala.nombre}</h2>
              <p className={comun.suave}>{sala.descripcion}</p>
              <div className={estilos.pieSala}>
                <OcupacionSala sala={sala} />
                <BotonEnlace
                  href={`/salas/${sala.id}`}
                  variante="secundario"
                  tamano="sm"
                  aria-label={`Ver la sala ${sala.nombre}`}
                >
                  Ver sala
                </BotonEnlace>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
