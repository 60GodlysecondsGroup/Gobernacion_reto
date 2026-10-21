'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Avatar } from '@/components/avatar/Avatar';
import { Aviso, Boton, CampoTexto, Tarjeta } from '@/components/ui';
import { mensajeDeError } from '@/lib/api/cliente';
import { buscarPerfiles, type PerfilPublico } from '@/lib/api/comunidad';
import comun from '../comun.module.css';
import estilos from './BuscadorPersonas.module.css';

export function BuscadorPersonas() {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<PerfilPublico[] | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [buscando, setBuscando] = useState(false);

  async function alBuscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const consulta = texto.trim();
    if (consulta.length < 2) {
      setError('Escribe al menos 2 letras del alias.');
      return;
    }
    setError(undefined);
    setBuscando(true);
    try {
      setResultados((await buscarPerfiles(consulta)).perfiles);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setBuscando(false);
    }
  }

  return (
    <Tarjeta
      titulo="Buscar personas de tu comunidad"
      descripcion="Por alias. La búsqueda solo recorre tu comunidad."
    >
      <div className={comun.formulario}>
        <form className={estilos.busqueda} onSubmit={alBuscar} role="search">
          <CampoTexto
            etiqueta="Alias"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            error={error}
            autoComplete="off"
            maxLength={30}
          />
          <Boton type="submit" cargando={buscando}>
            Buscar
          </Boton>
        </form>

        {resultados && resultados.length === 0 && (
          <Aviso tono="info">No encontramos a nadie con ese alias en tu comunidad.</Aviso>
        )}

        {resultados && resultados.length > 0 && (
          <ul className={comun.lista} aria-label="Resultados">
            {resultados.map((perfil) => (
              <li key={perfil.id}>
                <Link href={`/perfiles/${perfil.id}`} className={estilos.persona}>
                  <Avatar apariencia={perfil.avatar} tamano={32} />
                  <span>
                    <strong>{perfil.alias}</strong>
                    {perfil.intereses.length > 0 && (
                      <span className={comun.suave}> · {perfil.intereses.join(', ')}</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Tarjeta>
  );
}
