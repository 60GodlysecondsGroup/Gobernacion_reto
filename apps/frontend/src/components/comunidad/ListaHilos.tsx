'use client';

import { MessageSquare, MessagesSquare, PenLine, Search, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { useSesion } from '@/components/sesion/ProveedorSesion';
import {
  Boton,
  BotonEnlace,
  CargandoLista,
  EstadoError,
  EstadoVacio,
  Insignia,
} from '@/components/ui';
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
  const { puede } = useSesion();
  const idBusqueda = useId();

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

  const filtrando = Boolean(filtro.buscar || filtro.categoria);

  return (
    <section className={estilos.hilos} aria-labelledby="titulo-hilos">
      <div className={estilos.cabeceraHilos}>
        <h2 id="titulo-hilos" className={estilos.tituloSeccion}>
          Hilos de tu comunidad
        </h2>
        <p className={comun.suave}>Los más activos primero.</p>
      </div>

      <div className={estilos.herramientas}>
        <form className={estilos.busqueda} onSubmit={alBuscar} role="search">
          <label htmlFor={idBusqueda} className="visualmente-oculto">
            Buscar en los hilos
          </label>
          <span className={estilos.campoBusqueda}>
            <Search aria-hidden="true" size={18} />
            <input
              id={idBusqueda}
              type="search"
              placeholder="Buscar en los hilos…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={60}
              autoComplete="off"
              aria-invalid={errorBusqueda ? true : undefined}
              aria-describedby={errorBusqueda ? `${idBusqueda}-error` : undefined}
            />
          </span>
          <Boton type="submit" variante="oscuro">
            Buscar
          </Boton>
          {errorBusqueda && (
            <p id={`${idBusqueda}-error`} className={estilos.errorBusqueda} role="alert">
              {errorBusqueda}
            </p>
          )}
        </form>

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
              {categoria.nombre}
              <span className={estilos.cuentaCategoria}>{categoria.hilos}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <EstadoError
          alReintentar={() => aplicar({ categoria: filtro.categoria, buscar: filtro.buscar })}
        >
          {error}
        </EstadoError>
      )}
      {!hilos && !error && <CargandoLista filas={3} etiqueta="Cargando hilos…" alto="8.5rem" />}
      {hilos && hilos.length === 0 && (
        <EstadoVacio
          icono={filtrando ? SearchX : MessagesSquare}
          titulo={filtrando ? 'No hay hilos que coincidan' : 'Todavía no hay hilos'}
          accion={
            filtrando ? (
              <Boton
                variante="secundario"
                onClick={() => {
                  setTexto('');
                  aplicar({});
                }}
              >
                Quitar filtros
              </Boton>
            ) : (
              puede('crear_hilo') && (
                <BotonEnlace href="/comunidad/hilos/nuevo">
                  <PenLine aria-hidden="true" size={18} />
                  Crear el primer hilo
                </BotonEnlace>
              )
            )
          }
        >
          {filtrando
            ? 'Prueba con otra palabra o con otra categoría.'
            : 'Puedes empezar la primera conversación de tu comunidad.'}
        </EstadoVacio>
      )}

      {hilos && hilos.length > 0 && (
        <ul className={estilos.listaHilos}>
          {hilos.map((hilo) => (
            <li key={hilo.id}>
              <article className={estilos.hilo}>
                <div className={comun.fila}>
                  <Insignia tono="info">{hilo.categoria.nombre}</Insignia>
                  {hilo.estado === 'cerrado' && <Insignia>Cerrado</Insignia>}
                </div>
                <h3 className={estilos.tituloHilo}>
                  <Link href={`/comunidad/hilos/${hilo.id}`} className={estilos.enlaceHilo}>
                    {hilo.titulo}
                  </Link>
                </h3>
                <p className={estilos.extracto}>{hilo.extracto}</p>
                <div className={estilos.pieHilo}>
                  <AutorContenido autor={hilo.autor} fecha={hilo.fecha} />
                  <span className={estilos.respuestas}>
                    <MessageSquare aria-hidden="true" size={16} />
                    {hilo.respuestas === 1 ? '1 respuesta' : `${hilo.respuestas} respuestas`}
                  </span>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {hayMas && (
        <div className={estilos.verMas}>
          <Boton
            variante="secundario"
            onClick={() => setFiltro((actual) => ({ ...actual, pagina: actual.pagina + 1 }))}
          >
            Ver más hilos
          </Boton>
        </div>
      )}
    </section>
  );
}
