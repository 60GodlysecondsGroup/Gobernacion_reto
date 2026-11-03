'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorApi, mensajeDeError } from '@/lib/api/cliente';

export type EstadoTurno = 'enviando' | 'listo' | 'error';

export type Turno<R> = {
  id: string;
  pregunta: string;
  estado: EstadoTurno;
  respuesta?: R;
  error?: { mensaje: string; sinConexion: boolean };
};

/**
 * Estado de una conversación con un asistente. La pregunta aparece en cuanto se envía y la
 * respuesta (o el error, con opción de reintentar) ocupa su lugar al llegar. Un candado síncrono
 * impide envíos duplicados aunque se pulse varias veces antes de que React vuelva a pintar, y
 * las respuestas de una conversación ya reiniciada se descartan.
 * No guarda nada ni cambia lo que se envía: cada pregunta va sola, como antes.
 */
export function useConversacion<R>(preguntar: (texto: string) => Promise<R>) {
  const [turnos, setTurnos] = useState<Turno<R>[]>([]);
  const ocupado = useRef(false);
  const generacion = useRef(0);
  const siguienteId = useRef(0);
  const preguntarActual = useRef(preguntar);

  useEffect(() => {
    preguntarActual.current = preguntar;
  }, [preguntar]);

  useEffect(
    () => () => {
      generacion.current++;
    },
    [],
  );

  const actualizar = useCallback((id: string, cambios: Partial<Turno<R>>) => {
    setTurnos((actuales) => actuales.map((t) => (t.id === id ? { ...t, ...cambios } : t)));
  }, []);

  const ejecutar = useCallback(
    async (id: string, texto: string) => {
      const propia = generacion.current;
      ocupado.current = true;
      try {
        const respuesta = await preguntarActual.current(texto);
        if (propia !== generacion.current) return;
        actualizar(id, { estado: 'listo', respuesta, error: undefined });
      } catch (e) {
        if (propia !== generacion.current) return;
        actualizar(id, {
          estado: 'error',
          error: {
            mensaje: mensajeDeError(e),
            sinConexion: e instanceof ErrorApi && e.codigo === 'SIN_CONEXION',
          },
        });
      } finally {
        if (propia === generacion.current) ocupado.current = false;
      }
    },
    [actualizar],
  );

  /** Envía una pregunta. Devuelve `false` si estaba vacía o si aún se espera otra respuesta. */
  const enviar = useCallback(
    (texto: string) => {
      const consulta = texto.trim();
      if (!consulta || ocupado.current) return false;
      ocupado.current = true;
      const id = `t${++siguienteId.current}`;
      setTurnos((actuales) => [...actuales, { id, pregunta: consulta, estado: 'enviando' }]);
      void ejecutar(id, consulta);
      return true;
    },
    [ejecutar],
  );

  const reintentar = useCallback(
    (turno: Turno<R>) => {
      if (ocupado.current) return;
      ocupado.current = true;
      actualizar(turno.id, { estado: 'enviando', error: undefined });
      void ejecutar(turno.id, turno.pregunta);
    },
    [actualizar, ejecutar],
  );

  /** Quita un turno fallido (por ejemplo, para corregir la pregunta y enviarla de nuevo). */
  const descartar = useCallback((id: string) => {
    setTurnos((actuales) => actuales.filter((t) => t.id !== id || t.estado !== 'error'));
  }, []);

  const reiniciar = useCallback(() => {
    generacion.current++;
    ocupado.current = false;
    setTurnos([]);
  }, []);

  const enviando = turnos.some((t) => t.estado === 'enviando');
  return { turnos, enviando, enviar, reintentar, descartar, reiniciar };
}
