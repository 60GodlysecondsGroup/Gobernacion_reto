'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { Aviso, Boton, CampoTexto, Insignia, Tarjeta } from '@/components/ui';
import { mensajeDeError } from '@/lib/api/cliente';
import {
  listarHilos,
  obtenerCategorias,
  type CategoriaForo,
  type HiloResumen,
} from '@/lib/api/hilos';
import comun from '../comun.module.css';
import { AutorContenido } from './AutorContenido';
import estilos from './Comunidad.module.css';

type Filtro = { categoria?: string; buscar?: string; pagina: number };

/** Hilos de la comunidad propia: filtro por categoría, búsqueda y carga de 10 en 10. */
export function ListaHilos() {
  const [categorias, setCategorias] = useState<CategoriaForo[]>([]);
  const [filtro, setFiltro] = useState<Filtro>({ pagina: 1 });
  const [texto, setTexto] = useState('');
  const [hilos, setHilos] = useState<HiloResumen[] | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorBusqueda, setErrorBusqueda] = useState<string | undefined>();

  useEffect(() => {
    let vigente = true;
    obtenerCategorias()
      .then((r) => vigente && setCategorias(r.categorias))
      .catch(() => vigente && setCategorias([]));
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    let vigente = true;
    listarHilos(filtro)
      .then((r) => {
        if (!vigente) return;
        setHilos((anteriores) =>
          filtro.pagina === 1 ? r.hilos : [...(anteriores ?? []), ...r.hilos],
        );
        setHayMas(r.hayMas);
      })
      .catch((e: unknown) => vigente && setError(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, [filtro]);

  const aplicar = (nuevo: Omit<Filtro, 'pagina'>) => {
    setHilos(null);
    setError(null);
    setFiltro({ ...nuevo, pagina: 1 });
  };

  function alBuscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const consulta = texto.trim();
    if (consulta && consulta.length < 2) {
      setErrorBusqueda('Escribe al menos 2 letras.');
      return;
    }
    setErrorBusqueda(undefined);
    aplicar({ categoria: filtro.categoria, buscar: consulta || undefined });
  }

  return (
    <Tarjeta titulo="Hilos de tu comunidad" descripcion="Los más activos primero.">
      <div className={comun.formulario}>
        <div className={estilos.categorias} role="group" aria-label="Filtrar por categoría">
          <button
            type="button"
            className={estilos.categoria}
            aria-pressed={!filtro.categoria}
            onClick={() => aplicar({ buscar: filtro.buscar })}
          >
            Todas
          </button>
          {categorias.map((categoria) => (
            <button
              key={categoria.codigo}
              type="button"
              className={estilos.categoria}
              aria-pressed={filtro.categoria === categoria.codigo}
              onClick={() => aplicar({ categoria: categoria.codigo, buscar: filtro.buscar })}
            >
              {categoria.nombre} ({categoria.hilos})
            </button>
          ))}
        </div>

        <form className={estilos.busqueda} onSubmit={alBuscar} role="search">
          <CampoTexto
            etiqueta="Buscar en los hilos"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            error={errorBusqueda}
            maxLength={60}
            autoComplete="off"
          />
          <Boton type="submit" variante="secundario">
            Buscar
          </Boton>
        </form>

        {error && <Aviso tono="peligro">{error}</Aviso>}
        {!hilos && !error && <p className={comun.cargando}>Cargando hilos…</p>}
        {hilos && hilos.length === 0 && (
          <Aviso tono="info">
            {filtro.buscar || filtro.categoria
              ? 'No hay hilos que coincidan.'
              : 'Todavía no hay hilos. ¡Puedes empezar el primero!'}
          </Aviso>
        )}

        {hilos && hilos.length > 0 && (
          <ul className={comun.lista}>
            {hilos.map((hilo) => (
              <li key={hilo.id}>
                <article className={estilos.hilo}>
                  <div className={comun.fila}>
                    <Insignia tono="info">{hilo.categoria.nombre}</Insignia>
                    {hilo.estado === 'cerrado' && <Insignia>Cerrado</Insignia>}
                  </div>
                  <h3 className={estilos.tituloHilo}>
                    <Link href={`/comunidad/hilos/${hilo.id}`}>{hilo.titulo}</Link>
                  </h3>
                  <p className={estilos.extracto}>{hilo.extracto}</p>
                  <div className={estilos.pieHilo}>
                    <AutorContenido autor={hilo.autor} fecha={hilo.fecha} />
                    <span className={comun.suave}>
                      {hilo.respuestas === 1 ? '1 respuesta' : `${hilo.respuestas} respuestas`}
                    </span>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}

        {hayMas && (
          <div className={comun.fila}>
            <Boton
              variante="secundario"
              onClick={() => setFiltro((actual) => ({ ...actual, pagina: actual.pagina + 1 }))}
            >
              Ver más hilos
            </Boton>
          </div>
        )}
      </div>
    </Tarjeta>
  );
}
