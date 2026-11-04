'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { activarAudio, sonarPaso } from '@/lib/sonido/pasos';
import type { ParticipanteVivo } from './useSalaEnVivo';

const CLAVE = 'cp-sonido-pasos';
const EVENTO = 'cp-sonido-pasos';
/** Más allá de esta distancia (en casillas) los pasos ajenos ya no se oyen. */
const ALCANCE = 7;

function leer(): boolean {
  try {
    return localStorage.getItem(CLAVE) === 'si';
  } catch {
    return false;
  }
}

function suscribir(avisar: () => void) {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener('storage', avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener('storage', avisar);
  };
}

/**
 * Pasos sonoros en la sala, apagados por defecto. La preferencia se guarda en este navegador.
 * Suenan los pasos propios y, más bajo según la distancia, los de quien camina cerca.
 * `suelo` ajusta el timbre al suelo de la sala.
 */
export function usePasosSonoros(participantes: ParticipanteVivo[], yo: string | null, suelo = 1) {
  const activo = useSyncExternalStore(suscribir, leer, () => false);
  const anteriores = useRef(new Map<string, number>());

  const alternar = useCallback(() => {
    const siguiente = !leer();
    if (siguiente) activarAudio();
    try {
      localStorage.setItem(CLAVE, siguiente ? 'si' : 'no');
    } catch {
      // Sin almacenamiento: la preferencia vale para esta visita.
    }
    window.dispatchEvent(new Event(EVENTO));
  }, []);

  useEffect(() => {
    const propio = participantes.find((p) => p.id === yo);
    for (const p of participantes) {
      const pasos = p.pasos ?? 0;
      const antes = anteriores.current.get(p.id);
      anteriores.current.set(p.id, pasos);
      if (!activo || antes === undefined || pasos <= antes) continue;
      if (p.id === yo) {
        sonarPaso({ suelo });
        continue;
      }
      if (!propio) continue;
      const distancia = Math.hypot(p.x - propio.x, p.y - propio.y);
      if (distancia > ALCANCE) continue;
      sonarPaso({ volumen: 0.45 * (1 - distancia / (ALCANCE + 1)), suelo });
    }
  }, [participantes, yo, activo, suelo]);

  return { activo, alternar };
}
