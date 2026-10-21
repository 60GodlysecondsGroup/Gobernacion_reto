'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Aviso, Boton, CampoTexto } from '@/components/ui';
import { LARGO_MAXIMO_MENSAJE } from '@/lib/api/salas';
import { formatearHora } from '@/lib/fechas';
import estilos from './Salas.module.css';
import type { EntradaChat } from './useSalaEnVivo';

/**
 * Chat de la sala (F14). No se guarda: solo se ven los mensajes desde que entraste.
 * Cada mensaje pasa por el DLP en el servidor; si se bloquea, solo quien lo escribió ve el
 * aviso y su texto se conserva en el campo para corregirlo.
 */
export function ChatSala({
  chat,
  yo,
  bloqueo,
  error,
  publicados,
  alEnviar,
  alEditar,
}: {
  chat: EntradaChat[];
  yo: string | null;
  bloqueo: string | null;
  error: string | null;
  /** Cambia cuando el servidor publica un mensaje propio: entonces se limpia el campo. */
  publicados: number;
  alEnviar: (texto: string) => void;
  alEditar: () => void;
}) {
  const [texto, setTexto] = useState('');
  const [publicadosVistos, setPublicadosVistos] = useState(publicados);
  const registro = useRef<HTMLOListElement>(null);

  if (publicados !== publicadosVistos) {
    setPublicadosVistos(publicados);
    setTexto('');
  }

  useEffect(() => {
    const lista = registro.current;
    if (lista) lista.scrollTop = lista.scrollHeight;
  }, [chat]);

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (texto.trim()) alEnviar(texto);
  }

  return (
    <section className={estilos.chat} aria-labelledby="titulo-chat">
      <h2 id="titulo-chat" className={estilos.tituloPanel}>
        Chat de la sala
      </h2>
      <ol ref={registro} className={estilos.registro} role="log" aria-live="polite">
        {chat.length === 0 && (
          <li className={estilos.avisoChat}>Todavía no hay mensajes. Saluda si quieres.</li>
        )}
        {chat.map((entrada) =>
          entrada.tipo === 'aviso' ? (
            <li key={entrada.id} className={estilos.avisoChat}>
              {entrada.texto}
            </li>
          ) : (
            <li
              key={entrada.id}
              className={entrada.autor.id === yo ? estilos.mensajePropio : estilos.mensaje}
            >
              <span className={estilos.autorMensaje}>
                {entrada.autor.id === yo ? 'Tú' : entrada.autor.alias}
                <time dateTime={entrada.fecha}>{formatearHora(entrada.fecha)}</time>
              </span>
              <span className={estilos.textoMensaje}>{entrada.texto}</span>
            </li>
          ),
        )}
      </ol>

      {bloqueo && (
        <Aviso tono="peligro" titulo="Tu mensaje no se envió">
          {bloqueo} Solo tú ves este aviso.
        </Aviso>
      )}
      {error && <Aviso tono="advertencia">{error}</Aviso>}

      <form className={estilos.formularioChat} onSubmit={enviar} noValidate>
        <CampoTexto
          etiqueta="Escribe un mensaje"
          ayuda="Se revisa antes de mostrarse. No compartas datos personales ni de contacto."
          maxLength={LARGO_MAXIMO_MENSAJE}
          autoComplete="off"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            alEditar();
          }}
        />
        <Boton type="submit" disabled={!texto.trim()}>
          Enviar
        </Boton>
      </form>
    </section>
  );
}
