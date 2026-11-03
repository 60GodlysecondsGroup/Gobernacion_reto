'use client';

import { ArrowUp, LoaderCircle } from 'lucide-react';
import {
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type Ref,
} from 'react';
import estilos from './ChatAsistente.module.css';

export type ControlCompositor = {
  /** Pone un texto en el campo (por ejemplo, para corregir una pregunta que falló). */
  escribir: (texto: string) => void;
  enfocar: () => void;
};

type Props = {
  ref?: Ref<ControlCompositor>;
  id: string;
  etiqueta: string;
  placeholder: string;
  /** El asistente está respondiendo: se puede seguir escribiendo, pero no enviar. */
  ocupado: boolean;
  /** Devuelve `true` si el mensaje se aceptó (entonces se vacía el campo). */
  alEnviar: (texto: string) => boolean;
  maximo?: number;
};

/**
 * Campo para escribir al asistente. Enter envía y Shift + Enter añade una línea; el campo crece
 * con el texto hasta un tope y después se desplaza por dentro. El borrador vive aquí, así que
 * escribir no vuelve a pintar la conversación.
 */
export function Compositor({
  ref,
  id,
  etiqueta,
  placeholder,
  ocupado,
  alEnviar,
  maximo = 800,
}: Props) {
  const [texto, setTexto] = useState('');
  const campo = useRef<HTMLTextAreaElement>(null);
  const vacio = !texto.trim();
  const idAyuda = `${id}-ayuda`;

  useImperativeHandle(ref, () => ({
    escribir(nuevo) {
      setTexto(nuevo.slice(0, maximo));
      requestAnimationFrame(() => {
        const el = campo.current;
        el?.focus();
        el?.setSelectionRange(el.value.length, el.value.length);
      });
    },
    enfocar() {
      campo.current?.focus();
    },
  }));

  // Ajusta el alto al contenido; el tope lo pone `max-height` en CSS.
  useLayoutEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`;
  }, [texto]);

  function enviar() {
    if (vacio || ocupado) return;
    if (alEnviar(texto)) setTexto('');
  }

  function alPulsar(evento: KeyboardEvent<HTMLTextAreaElement>) {
    // Durante una composición (acentos, teclados asiáticos) Enter confirma el carácter.
    if (evento.key !== 'Enter' || evento.shiftKey || evento.nativeEvent.isComposing) return;
    evento.preventDefault();
    enviar();
  }

  function alEnviarFormulario(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    enviar();
  }

  const cercaDelLimite = texto.length >= maximo * 0.8;

  return (
    <form
      className={estilos.compositor}
      onSubmit={alEnviarFormulario}
      data-ocupado={ocupado || undefined}
    >
      <label className="visualmente-oculto" htmlFor={id}>
        {etiqueta}
      </label>
      <textarea
        ref={campo}
        id={id}
        className={estilos.campo}
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        onKeyDown={alPulsar}
        placeholder={placeholder}
        maxLength={maximo}
        rows={1}
        enterKeyHint="send"
        aria-describedby={idAyuda}
      />
      <div className={estilos.controlesCompositor}>
        <span id={idAyuda} className={estilos.ayudaCompositor}>
          {cercaDelLimite ? (
            <span className={estilos.contador} data-tope={texto.length >= maximo || undefined}>
              {texto.length}/{maximo}
            </span>
          ) : (
            <span className={estilos.atajos}>
              <kbd>Enter</kbd> envía · <kbd>Shift</kbd> + <kbd>Enter</kbd> nueva línea
            </span>
          )}
        </span>
        <button
          type="submit"
          className={estilos.enviar}
          aria-label={ocupado ? 'El asistente está respondiendo' : 'Enviar pregunta'}
          title={ocupado ? 'Esperando la respuesta…' : 'Enviar (Enter)'}
          disabled={vacio || ocupado}
        >
          {ocupado ? (
            <LoaderCircle className={estilos.girando} size={18} aria-hidden="true" />
          ) : (
            <ArrowUp size={19} aria-hidden="true" />
          )}
        </button>
      </div>
    </form>
  );
}
