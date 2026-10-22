'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useBorrador } from '@/lib/hooks/useBorrador';
import { useSesion } from '@/components/sesion/ProveedorSesion';
import {
  Aviso,
  Boton,
  CampoTexto,
  CargandoLista,
  EnlaceVolver,
  ErrorDePagina,
  Insignia,
  Tarjeta,
} from '@/components/ui';
import { ErrorApi, mensajeDeError } from '@/lib/api/cliente';
import { obtenerHilo, responderHilo, type DetalleHilo } from '@/lib/api/hilos';
import comun from '../comun.module.css';
import { AutorContenido } from './AutorContenido';
import { BotonReportar } from './BotonReportar';
import estilos from './Comunidad.module.css';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; detalle: DetalleHilo }
  | { tipo: 'no_encontrado' }
  | { tipo: 'error'; mensaje: string };

/** Hilo con sus respuestas (F08, F09). Cada contenido ajeno tiene «Reportar». */
export function VistaHilo() {
  const { id } = useParams<{ id: string }>();
  const recienPublicado = useSearchParams().get('publicado') === '1';
  const { usuario, puede } = useSesion();
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  useEffect(() => {
    let vigente = true;
    obtenerHilo(id)
      .then((detalle) => vigente && setEstado({ tipo: 'listo', detalle }))
      .catch((e: unknown) => {
        if (!vigente) return;
        setEstado(
          e instanceof ErrorApi && e.estado === 404
            ? { tipo: 'no_encontrado' }
            : { tipo: 'error', mensaje: mensajeDeError(e) },
        );
      });
    return () => {
      vigente = false;
    };
  }, [id]);

  const volver = (
    <nav aria-label="Ruta">
      <EnlaceVolver href="/comunidad">Volver a la comunidad</EnlaceVolver>
    </nav>
  );

  if (estado.tipo === 'cargando') return <CargandoLista etiqueta="Cargando el hilo…" />;
  if (estado.tipo === 'error') {
    return (
      <ErrorDePagina
        mensaje={estado.mensaje}
        volverA="/comunidad"
        textoVolver="Volver a la comunidad"
      />
    );
  }
  if (estado.tipo === 'no_encontrado') {
    return (
      <div className={comun.pagina}>
        {volver}
        <Aviso tono="peligro" titulo="No encontramos ese hilo en tu comunidad" />
      </div>
    );
  }

  const { hilo, respuestas } = estado.detalle;
  const esPropio = (idAutor: string) => idAutor === usuario?.id;

  return (
    <div className={comun.pagina}>
      {volver}
      {recienPublicado && <Aviso tono="exito">Hilo publicado.</Aviso>}

      <Tarjeta>
        <article className={comun.formulario}>
          <div className={comun.fila}>
            <Insignia tono="info">{hilo.categoria.nombre}</Insignia>
            {hilo.estado === 'cerrado' && <Insignia>Cerrado</Insignia>}
          </div>
          <h1 className={estilos.tituloDetalle}>{hilo.titulo}</h1>
          <AutorContenido autor={hilo.autor} fecha={hilo.fecha} />
          <p className={`${estilos.contenido} ${estilos.contenidoDetalle}`}>{hilo.contenido}</p>
          {!esPropio(hilo.autor.id) && <BotonReportar tipoContenido="hilo" idContenido={hilo.id} />}
        </article>
      </Tarjeta>

      <section aria-labelledby="titulo-respuestas" className={comun.formulario}>
        <h2 id="titulo-respuestas">
          {respuestas.length === 1 ? '1 respuesta' : `${respuestas.length} respuestas`}
        </h2>
        {respuestas.length === 0 && <p className={comun.suave}>Todavía nadie ha respondido.</p>}
        <ol className={comun.lista}>
          {respuestas.map((respuesta) => (
            <li key={respuesta.id} className={estilos.respuesta}>
              <AutorContenido autor={respuesta.autor} fecha={respuesta.fecha} />
              <p className={estilos.contenido}>{respuesta.contenido}</p>
              {!esPropio(respuesta.autor.id) && (
                <div className={estilos.respuestaPie}>
                  <BotonReportar tipoContenido="respuesta" idContenido={respuesta.id} />
                </div>
              )}
            </li>
          ))}
        </ol>
      </section>

      {hilo.estado === 'cerrado' ? (
        <Aviso tono="info">Este hilo está cerrado y ya no admite respuestas.</Aviso>
      ) : (
        puede('responder_hilo') && (
          <FormularioRespuesta
            idHilo={hilo.id}
            alResponder={(detalle) => setEstado({ tipo: 'listo', detalle })}
          />
        )
      )}

      <p className={comun.suave}>
        ¿Buscas información o un canal de apoyo? Usa <Link href="/ayuda">Necesito ayuda</Link> o{' '}
        <Link href="/orientacion">Orientación</Link>.
      </p>
    </div>
  );
}

function FormularioRespuesta({
  idHilo,
  alResponder,
}: {
  idHilo: string;
  alResponder: (detalle: DetalleHilo) => void;
}) {
  const [borrador, setBorrador, descartarBorrador] = useBorrador(`respuesta-${idHilo}`, {
    texto: '',
  });
  const texto = borrador.texto;
  const setTexto = (valor: string) => setBorrador({ texto: valor });
  const [errorCampo, setErrorCampo] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ tono: 'exito' | 'peligro'; mensaje: string } | null>(null);

  async function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!texto.trim()) {
      setErrorCampo('Escribe tu respuesta antes de publicarla.');
      return;
    }
    setEnviando(true);
    setAviso(null);
    try {
      alResponder(await responderHilo(idHilo, texto));
      descartarBorrador();
      setAviso({ tono: 'exito', mensaje: 'Respuesta publicada.' });
    } catch (e) {
      // Si el DLP la bloquea, el texto se conserva para poder corregirlo.
      setAviso({ tono: 'peligro', mensaje: mensajeDeError(e) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tarjeta titulo="Responder">
      <form className={comun.formulario} onSubmit={alEnviar} noValidate>
        {aviso && <Aviso tono={aviso.tono}>{aviso.mensaje}</Aviso>}
        <CampoTexto
          etiqueta="Tu respuesta"
          obligatorio
          error={errorCampo}
          ayuda="Se revisa antes de publicarse. No compartas datos personales ni de contacto."
          multilinea
          rows={3}
          maxLength={2000}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setAviso(null);
            setErrorCampo(undefined);
          }}
        />
        <div className={comun.fila}>
          <Boton type="submit" cargando={enviando}>
            {enviando ? 'Publicando…' : 'Publicar respuesta'}
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
