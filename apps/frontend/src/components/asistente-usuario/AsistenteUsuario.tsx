'use client';

import { ArrowUp, Bot, RotateCcw, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso } from '@/components/ui';
import { mensajeDeError } from '@/lib/api/cliente';
import {
  preguntarAsistenteUsuario,
  type RespuestaAsistenteUsuario,
} from '@/lib/api/asistente-usuario';
import estilos from './AsistenteUsuario.module.css';

type Turno = { id: number; pregunta: string; respuesta: RespuestaAsistenteUsuario };

function textoConFormato(texto: string) {
  const patron = /(\*\*\*([^*]+?)\*\*\*|\*\*([^*]+?)\*\*|(?<!\*)\*([^*]+?)\*(?!\*)|`([^`]+)`)/g;
  const partes: ReactNode[] = [];
  let inicio = 0;
  let coincidencia: RegExpExecArray | null;

  while ((coincidencia = patron.exec(texto)) !== null) {
    if (coincidencia.index > inicio) partes.push(texto.slice(inicio, coincidencia.index));
    const clave = `${coincidencia.index}-${partes.length}`;
    if (coincidencia[2]) {
      partes.push(<strong key={clave}><em>{coincidencia[2]}</em></strong>);
    } else if (coincidencia[3]) {
      partes.push(<strong key={clave}>{coincidencia[3]}</strong>);
    } else if (coincidencia[4]) {
      partes.push(<em key={clave}>{coincidencia[4]}</em>);
    } else if (coincidencia[5]) {
      partes.push(<code key={clave}>{coincidencia[5]}</code>);
    }
    inicio = patron.lastIndex;
  }
  if (inicio < texto.length) partes.push(texto.slice(inicio));
  return partes;
}

function respuestaConFormato(texto: string) {
  const lineas = texto.split(/\r?\n/);
  const bloques: ReactNode[] = [];
  let parrafo: string[] = [];
  let lista: string[] = [];
  let tipoLista: 'ul' | 'ol' | null = null;

  const vaciarParrafo = () => {
    if (parrafo.length) {
      bloques.push(<p key={`p-${bloques.length}`}>{textoConFormato(parrafo.join(' '))}</p>);
      parrafo = [];
    }
  };
  const vaciarLista = () => {
    if (!lista.length || !tipoLista) return;
    const Elemento = tipoLista;
    bloques.push(
      <Elemento key={`l-${bloques.length}`}>
        {lista.map((elemento, indice) => <li key={`${indice}-${elemento}`}>{textoConFormato(elemento)}</li>)}
      </Elemento>,
    );
    lista = [];
    tipoLista = null;
  };

  for (const linea of lineas) {
    const recortada = linea.trim();
    if (!recortada) {
      vaciarParrafo();
      vaciarLista();
      continue;
    }
    if (/^(\*\s*){3,}$|^(-\s*){3,}$|^(_\s*){3,}$/.test(recortada)) {
      vaciarParrafo();
      vaciarLista();
      continue;
    }
    const viñeta = recortada.match(/^(?:[-*•])\s+(.+)$/);
    const numerada = recortada.match(/^\d+[.)]\s+(.+)$/);
    if (viñeta || numerada) {
      vaciarParrafo();
      const nuevoTipo = viñeta ? 'ul' : 'ol';
      if (tipoLista && tipoLista !== nuevoTipo) vaciarLista();
      tipoLista = nuevoTipo;
      lista.push((viñeta ?? numerada)![1]);
      continue;
    }
    vaciarLista();
    parrafo.push(recortada.replace(/^#{1,3}\s+/, ''));
  }
  vaciarParrafo();
  vaciarLista();
  return <div className={estilos.textoFormateado}>{bloques}</div>;
}

const SUGERENCIAS = [
  '¿Cómo puedo ingresar a una sala?',
  '¿Dónde encuentro los canales de ayuda?',
  '¿Cómo configuro mi perfil?',
  '¿Cómo reporto un contenido?',
];

export function AsistenteUsuario() {
  const [pregunta, setPregunta] = useState('');
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entrada = useRef<HTMLTextAreaElement>(null);

  async function enviar(texto = pregunta) {
    const consulta = texto.trim();
    if (!consulta || cargando) return;
    setPregunta('');
    setError(null);
    setCargando(true);
    try {
      const respuesta = await preguntarAsistenteUsuario(consulta);
      setTurnos((actuales) => [...actuales, { id: Date.now(), pregunta: consulta, respuesta }]);
    } catch (e) {
      setPregunta(consulta);
      setError(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    void enviar();
  }

  return (
    <section className={estilos.pagina}>
      <EncabezadoPagina antetitulo="Guía de la plataforma" titulo="Asistente de orientación">
        Te ayudo a encontrar funciones, salas y recursos publicados. No doy atención clínica ni
        reemplazo los canales humanos de ayuda.
      </EncabezadoPagina>

      <div className={estilos.marco}>
        <header className={estilos.cabecera}>
          <span className={estilos.icono}>
            <Bot size={22} aria-hidden="true" />
          </span>
          <div>
            <h2>Cocuyo te orienta</h2>
            <p>Respuestas sobre cómo usar Refugio</p>
          </div>
          {turnos.length > 0 && (
            <button
              className={estilos.nueva}
              type="button"
              onClick={() => {
                setTurnos([]);
                setError(null);
                setPregunta('');
                entrada.current?.focus();
              }}
            >
              <RotateCcw size={15} aria-hidden="true" />
              Nueva consulta
            </button>
          )}
        </header>

        <div className={estilos.conversacion} aria-live="polite" aria-busy={cargando}>
          {turnos.length === 0 ? (
            <div className={estilos.bienvenida}>
              <span className={estilos.destello}>
                <Sparkles size={21} aria-hidden="true" />
              </span>
              <h3>Hola, ¿qué quieres hacer?</h3>
              <p>Pregúntame cómo navegar o elige una consulta frecuente.</p>
              <div className={estilos.sugerencias}>
                {SUGERENCIAS.map((sugerencia) => (
                  <button
                    key={sugerencia}
                    type="button"
                    onClick={() => void enviar(sugerencia)}
                    disabled={cargando}
                  >
                    {sugerencia}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            turnos.map((turno) => (
              <article className={estilos.turno} key={turno.id}>
                <p className={estilos.pregunta}>{turno.pregunta}</p>
                <div className={estilos.respuesta}>
                  <span className={estilos.avatar}>
                    <Bot size={17} aria-hidden="true" />
                  </span>
                  <div className={estilos.contenidoRespuesta}>
                    {respuestaConFormato(turno.respuesta.respuesta)}
                    {turno.respuesta.accesos.length > 0 && (
                      <nav className={estilos.accesos} aria-label="Accesos relacionados">
                        {turno.respuesta.accesos.map((acceso, indice) =>
                          acceso.href.startsWith('tel:') ? (
                            <a href={acceso.href} key={acceso.href + '-' + indice}>
                              {acceso.texto}
                            </a>
                          ) : (
                            <Link href={acceso.href} key={acceso.href + '-' + indice}>
                              {acceso.texto}
                            </Link>
                          ),
                        )}
                      </nav>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
          {cargando && (
            <p className={estilos.generando} role="status">
              <span /> Buscando una respuesta…
            </p>
          )}
        </div>

        {error && (
          <div className={estilos.error}>
            <Aviso tono="peligro" titulo="No pude responder ahora">
              {error} Puedes intentarlo de nuevo.
            </Aviso>
          </div>
        )}

        <form className={estilos.compositor} onSubmit={alEnviar}>
          <label className="visualmente-oculto" htmlFor="pregunta-asistente-usuario">
            Escribe una pregunta sobre cómo usar la aplicación
          </label>
          <textarea
            ref={entrada}
            id="pregunta-asistente-usuario"
            value={pregunta}
            onChange={(evento) => setPregunta(evento.target.value)}
            placeholder="¿Cómo encuentro una sala?"
            maxLength={800}
            rows={2}
            disabled={cargando}
          />
          <button
            type="submit"
            aria-label="Enviar pregunta"
            disabled={!pregunta.trim() || cargando}
          >
            <ArrowUp size={19} aria-hidden="true" />
          </button>
        </form>
        <p className={estilos.privacidad}>
          Algunas preguntas se envían a un proveedor externo de IA. No escribas nombres, teléfonos
          ni detalles personales o de salud. Si necesitas ayuda urgente, abre{' '}
          <Link href="/ayuda">Necesito ayuda</Link>. El asistente no contacta servicios de
          emergencia.
        </p>
      </div>
    </section>
  );
}
