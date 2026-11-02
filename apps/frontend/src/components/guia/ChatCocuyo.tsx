'use client';

import { ArrowUp, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { PRESENTACION_GUIA, TEMAS_GUIA, type TemaGuia } from '@/config/guia';
import { ErrorApi } from '@/lib/api/cliente';
import {
  LARGO_MAXIMO_MENSAJE_COCUYO,
  preguntarACocuyo,
  type RespuestaCocuyo,
} from '@/lib/api/cocuyo';
import { Cocuyo } from './Cocuyo';
import { CanalesInstitucionales } from './ContenidoTema';
import estilos from './Guia.module.css';

type MensajeChat =
  | { id: number; de: 'persona'; texto: string }
  | { id: number; de: 'cocuyo'; respuesta: RespuestaCocuyo | null };

const TODOS = TEMAS_GUIA.map((tema) => tema.id);

/** Respuesta de un acceso rápido: el contenido preparado tal cual, sin red ni IA. */
const respuestaPreparada = (tema: TemaGuia): RespuestaCocuyo => ({
  tipo: 'respuesta',
  intencion: tema.id,
  texto: tema.parrafos.join('\n\n'),
  origen: 'predeterminada',
  enlace: tema.enlace ?? null,
  conCanales: Boolean(tema.conCanales),
  sugerencias: [],
  aviso: null,
});

/** Si el backend no responde, Cocuyo no se queda callado: ofrece las preguntas frecuentes. */
const respuestaDeReserva = (error: unknown): RespuestaCocuyo => ({
  tipo: 'aclaracion',
  intencion: null,
  texto:
    error instanceof ErrorApi && error.estado === 429
      ? error.message
      : 'No pude procesar tu pregunta en este momento. Elige una de las preguntas frecuentes o inténtalo de nuevo en un rato.',
  origen: 'predeterminada',
  enlace: null,
  conCanales: false,
  sugerencias: TODOS,
  aviso: null,
});

/**
 * Estado de una conversación con Cocuyo. Vive en el componente que la usa (la guía flotante la
 * conserva al cerrarse y abrirse) y nunca se guarda en el navegador ni en el servidor.
 */
export function useConversacionCocuyo() {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [pendiente, setPendiente] = useState(false);
  const siguienteId = useRef(0);
  const solicitud = useRef<AbortController | null>(null);

  useEffect(() => () => solicitud.current?.abort(), []);

  const elegirTema = useCallback((tema: TemaGuia) => {
    const id = (siguienteId.current += 2);
    setMensajes((actuales) => [
      ...actuales,
      { id: id - 1, de: 'persona', texto: tema.pregunta },
      { id, de: 'cocuyo', respuesta: respuestaPreparada(tema) },
    ]);
  }, []);

  const preguntar = useCallback(async (texto: string) => {
    const mensaje = texto.trim().slice(0, LARGO_MAXIMO_MENSAJE_COCUYO);
    if (!mensaje || solicitud.current) return;
    const id = (siguienteId.current += 2);
    const controlador = new AbortController();
    solicitud.current = controlador;
    setPendiente(true);
    setMensajes((actuales) => [
      ...actuales,
      { id: id - 1, de: 'persona', texto: mensaje },
      { id, de: 'cocuyo', respuesta: null },
    ]);
    let respuesta: RespuestaCocuyo;
    try {
      respuesta = await preguntarACocuyo(mensaje, controlador.signal);
    } catch (error) {
      if (controlador.signal.aborted) return;
      respuesta = respuestaDeReserva(error);
    } finally {
      if (solicitud.current === controlador) {
        solicitud.current = null;
        setPendiente(false);
      }
    }
    setMensajes((actuales) => actuales.map((m) => (m.id === id ? { ...m, respuesta } : m)));
  }, []);

  const reiniciar = useCallback(() => {
    solicitud.current?.abort();
    solicitud.current = null;
    setPendiente(false);
    setMensajes([]);
  }, []);

  return { mensajes, pendiente, elegirTema, preguntar, reiniciar };
}

export type ConversacionCocuyo = ReturnType<typeof useConversacionCocuyo>;

function AccesosRapidos({
  ids,
  alElegir,
  etiqueta,
  compacto = false,
}: {
  ids: string[];
  alElegir: (tema: TemaGuia) => void;
  etiqueta: string;
  compacto?: boolean;
}) {
  const temas = ids.flatMap((id) => TEMAS_GUIA.filter((tema) => tema.id === id));
  if (temas.length === 0) return null;
  return (
    <ul className={compacto ? estilos.accesosCompactos : estilos.accesos} aria-label={etiqueta}>
      {temas.map((tema) => (
        <li key={tema.id}>
          <button type="button" className={estilos.acceso} onClick={() => alElegir(tema)}>
            {tema.pregunta}
          </button>
        </li>
      ))}
    </ul>
  );
}

function RespuestaDeCocuyo({
  respuesta,
  alElegir,
  alNavegar,
}: {
  respuesta: RespuestaCocuyo;
  alElegir: (tema: TemaGuia) => void;
  alNavegar?: () => void;
}) {
  const preparada = TEMAS_GUIA.find((tema) => tema.id === respuesta.intencion);
  return (
    <div className={estilos.respuesta} data-tipo={respuesta.tipo}>
      {respuesta.texto.split(/\n+/).map((parrafo, i) => (
        <p key={i}>{parrafo}</p>
      ))}
      {respuesta.aviso && <p className={estilos.aviso}>{respuesta.aviso}</p>}
      {respuesta.conCanales && <CanalesInstitucionales />}
      {respuesta.enlace && (
        <Link href={respuesta.enlace.href} className={estilos.enlaceTema} onClick={alNavegar}>
          {respuesta.enlace.texto}
        </Link>
      )}
      {respuesta.origen === 'ia' && preparada && (
        <details className={estilos.preparada}>
          <summary>Redactada con IA a partir de la respuesta preparada · Ver original</summary>
          {preparada.parrafos.map((parrafo) => (
            <p key={parrafo}>{parrafo}</p>
          ))}
        </details>
      )}
      <AccesosRapidos
        ids={respuesta.sugerencias}
        alElegir={alElegir}
        etiqueta="Temas sugeridos por Cocuyo"
      />
    </div>
  );
}

/**
 * Chat de Cocuyo (F25): la persona escribe en lenguaje natural o usa las preguntas frecuentes
 * como accesos rápidos. Los accesos responden al instante con el contenido preparado; el texto
 * libre lo atiende el backend, que solo responde temas del catálogo. Si el backend falla, la
 * conversación sigue con las preguntas frecuentes.
 */
export function ChatCocuyo({
  conversacion,
  intro,
  alNavegar,
  enfocarAlAbrir = false,
  variante = 'flotante',
}: {
  conversacion: ConversacionCocuyo;
  /** Contenido extra bajo la presentación (p. ej. los consejos de la página). */
  intro?: ReactNode;
  alNavegar?: () => void;
  enfocarAlAbrir?: boolean;
  variante?: 'flotante' | 'pagina';
}) {
  const { mensajes, pendiente, elegirTema, preguntar, reiniciar } = conversacion;
  const [borrador, setBorrador] = useState('');
  const entrada = useRef<HTMLTextAreaElement>(null);
  const conversacionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (enfocarAlAbrir) entrada.current?.focus();
  }, [enfocarAlAbrir]);

  // Lleva la conversación al último mensaje sin mover el resto de la página.
  useEffect(() => {
    const contenedor = conversacionRef.current;
    if (mensajes.length === 0 || !contenedor) return;
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    contenedor.scrollTo({ top: contenedor.scrollHeight, behavior: reducir ? 'auto' : 'smooth' });
  }, [mensajes]);

  const enviar = () => {
    if (!borrador.trim() || pendiente) return;
    void preguntar(borrador);
    setBorrador('');
  };

  const alEnviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    enviar();
  };

  const alTeclear = (evento: KeyboardEvent<HTMLTextAreaElement>) => {
    if (evento.key === 'Enter' && !evento.shiftKey && !evento.nativeEvent.isComposing) {
      evento.preventDefault();
      enviar();
    }
  };

  const idEntrada = `cocuyo-entrada-${variante}`;
  const restantes = LARGO_MAXIMO_MENSAJE_COCUYO - borrador.length;

  return (
    <div className={estilos.chat} data-variante={variante}>
      <div
        ref={conversacionRef}
        className={estilos.conversacion}
        role="log"
        aria-label="Conversación con Cocuyo"
      >
        <div className={estilos.mensajeCocuyo}>
          <span className={estilos.avatarCocuyo} aria-hidden="true">
            <Cocuyo tamano={22} />
          </span>
          <p className={estilos.burbuja}>{PRESENTACION_GUIA}</p>
        </div>
        {intro}
        <AccesosRapidos ids={TODOS} alElegir={elegirTema} etiqueta="Preguntas frecuentes" />

        {mensajes.map((mensaje) =>
          mensaje.de === 'persona' ? (
            <p key={mensaje.id} className={estilos.mensajePersona}>
              <span className="visualmente-oculto">Tú: </span>
              {mensaje.texto}
            </p>
          ) : (
            <div key={mensaje.id} className={estilos.mensajeCocuyo}>
              <span className={estilos.avatarCocuyo} aria-hidden="true">
                <Cocuyo tamano={22} />
              </span>
              {mensaje.respuesta ? (
                <div className={estilos.burbuja}>
                  <span className="visualmente-oculto">Cocuyo: </span>
                  <RespuestaDeCocuyo
                    respuesta={mensaje.respuesta}
                    alElegir={elegirTema}
                    alNavegar={alNavegar}
                  />
                </div>
              ) : (
                <p className={`${estilos.burbuja} ${estilos.escribiendo}`} role="status">
                  <span aria-hidden="true" />
                  Cocuyo está buscando la respuesta…
                </p>
              )}
            </div>
          ),
        )}
      </div>

      <div className={estilos.pie}>
        {mensajes.length > 0 && (
          <div className={estilos.barraAccesos}>
            <AccesosRapidos
              ids={TODOS}
              alElegir={elegirTema}
              etiqueta="Preguntas frecuentes"
              compacto
            />
            <button type="button" className={estilos.reiniciar} onClick={reiniciar}>
              <RotateCcw aria-hidden="true" size={14} />
              <span className="visualmente-oculto">Empezar una conversación nueva</span>
            </button>
          </div>
        )}
        <form className={estilos.compositor} onSubmit={alEnviar}>
          <label className="visualmente-oculto" htmlFor={idEntrada}>
            Escribe tu pregunta sobre cómo funciona la plataforma
          </label>
          <textarea
            ref={entrada}
            id={idEntrada}
            value={borrador}
            onChange={(evento) => setBorrador(evento.target.value)}
            onKeyDown={alTeclear}
            placeholder="Escribe tu pregunta…"
            maxLength={LARGO_MAXIMO_MENSAJE_COCUYO}
            rows={1}
            aria-describedby={`${idEntrada}-nota`}
          />
          <button type="submit" className={estilos.enviar} disabled={!borrador.trim() || pendiente}>
            <ArrowUp aria-hidden="true" size={18} />
            <span className="visualmente-oculto">Enviar pregunta</span>
          </button>
        </form>
        <p id={`${idEntrada}-nota`} className={estilos.nota}>
          {restantes < 50 ? `Te quedan ${restantes} caracteres. ` : ''}
          Solo respondo sobre cómo funciona la plataforma. No escribas datos personales: algunas
          preguntas se procesan con un proveedor externo de IA y no se guardan.
        </p>
      </div>
    </div>
  );
}

/** El chat en la página /guia (en móvil y tableta no hay botón flotante). */
export function ChatCocuyoPagina() {
  const conversacion = useConversacionCocuyo();
  return <ChatCocuyo conversacion={conversacion} variante="pagina" />;
}
