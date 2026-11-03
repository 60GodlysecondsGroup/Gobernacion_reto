'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { EstadoTurno } from './useConversacion';

/** Distancia al final (px) por debajo de la cual se considera que la persona sigue la conversación. */
const UMBRAL_FINAL = 96;
/** Tiempo (ms) en que un desplazamiento automático no cuenta como gesto de la persona. */
const VENTANA_AUTOMATICA = 600;

const movimientoReducido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Desplazamiento de la conversación:
 * - al enviar, baja hasta la pregunta y el indicador de escritura;
 * - al llegar una respuesta, la muestra desde su inicio (las largas no saltan hasta el final);
 * - si la persona subió a leer, no la mueve: aparece un botón para volver a lo último;
 * - si el área cambia de alto (el campo crece, carga un gráfico), conserva el final a la vista.
 */
export function useDesplazamiento(turnos: { id: string; estado: EstadoTurno }[]) {
  const contenedor = useRef<HTMLDivElement>(null);
  const contenido = useRef<HTMLDivElement>(null);
  const pegado = useRef(true);
  const automaticoHasta = useRef(0);
  const anteriores = useRef(turnos);
  const [alejado, setAlejado] = useState(false);
  const [novedad, setNovedad] = useState(false);

  const revision = useRef<number | undefined>(undefined);

  /** Actualiza si la persona sigue el final de la conversación según la posición actual. */
  const evaluar = useCallback(() => {
    const el = contenedor.current;
    if (!el) return;
    const cerca = el.scrollHeight - el.scrollTop - el.clientHeight < UMBRAL_FINAL;
    pegado.current = cerca;
    setAlejado(!cerca);
    if (cerca) setNovedad(false);
  }, []);

  const desplazar = useCallback(
    (top: number, suave = true) => {
      const el = contenedor.current;
      if (!el) return;
      automaticoHasta.current = performance.now() + VENTANA_AUTOMATICA;
      el.scrollTo({ top, behavior: suave && !movimientoReducido() ? 'smooth' : 'auto' });
      // Al terminar, se revisa dónde quedó (p. ej. al inicio de una respuesta larga).
      window.clearTimeout(revision.current);
      revision.current = window.setTimeout(evaluar, VENTANA_AUTOMATICA + 50);
    },
    [evaluar],
  );

  useEffect(() => () => window.clearTimeout(revision.current), []);

  const irAlFinal = useCallback(() => {
    const el = contenedor.current;
    if (!el) return;
    pegado.current = true;
    setNovedad(false);
    desplazar(el.scrollHeight);
  }, [desplazar]);

  const alDesplazar = useCallback(() => {
    const el = contenedor.current;
    if (!el) return;
    const cerca = el.scrollHeight - el.scrollTop - el.clientHeight < UMBRAL_FINAL;
    // Mientras dura un desplazamiento automático, las posiciones intermedias no cuentan.
    if (!cerca && performance.now() < automaticoHasta.current) return;
    evaluar();
  }, [evaluar]);

  // Antes de pintar, para que nada salte: el contenido nuevo aparece ya en su sitio.
  useLayoutEffect(() => {
    const previos = anteriores.current;
    anteriores.current = turnos;
    const el = contenedor.current;
    if (!el) return;
    if (turnos.length === 0) {
      pegado.current = true;
      return;
    }
    const estadoPrevio = (id: string) => previos.find((p) => p.id === id)?.estado;
    const enviado = turnos.length > previos.length;
    const reintento = turnos.some((t) => t.estado === 'enviando' && estadoPrevio(t.id) === 'error');
    const completado = turnos.find(
      (t) => t.estado !== 'enviando' && estadoPrevio(t.id) === 'enviando',
    );

    if (enviado || (reintento && pegado.current)) {
      pegado.current = true;
      desplazar(el.scrollHeight);
      return;
    }
    if (!completado) return;
    if (!pegado.current) {
      // Quien está leyendo más arriba no se mueve: solo se le avisa.
      const aviso = requestAnimationFrame(() => setNovedad(true));
      return () => cancelAnimationFrame(aviso);
    }
    const turno = el.querySelector<HTMLElement>(`[data-turno="${completado.id}"]`);
    const final = el.scrollHeight - el.clientHeight;
    const destino = turno ? Math.min(final, turno.offsetTop - 12) : final;
    // Una respuesta más alta que el área se lee desde su inicio: ya no se sigue el final.
    if (destino < final - UMBRAL_FINAL) pegado.current = false;
    desplazar(destino);
  }, [turnos, desplazar]);

  // Si cambia el alto disponible o el del contenido y la persona estaba al final, se queda ahí.
  useEffect(() => {
    const el = contenedor.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(() => {
      // Durante un desplazamiento automático se respeta su destino (y su suavidad).
      if (pegado.current && performance.now() > automaticoHasta.current) {
        el.scrollTop = el.scrollHeight;
      }
    });
    observador.observe(el);
    if (contenido.current) observador.observe(contenido.current);
    return () => observador.disconnect();
  }, []);

  /** Para una conversación nueva: vuelve al estado inicial. */
  const reiniciar = useCallback(() => {
    pegado.current = true;
    setAlejado(false);
    setNovedad(false);
  }, []);

  return { contenedor, contenido, alDesplazar, irAlFinal, reiniciar, alejado, novedad };
}
