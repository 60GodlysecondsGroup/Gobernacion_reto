'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { Direccion } from '@/lib/api/salas';
import { claveVector, combinar, siguientePaso, type EjePaso, type Vector } from './direcciones';

/**
 * Tiempo entre dos pasos mientras se mantiene una dirección. Es el mismo ritmo que tenía la
 * repetición de teclas; el servidor también limita (`intervaloMovimientoMs`).
 */
export const INTERVALO_PASO_MS = 110;

/** Cada mecanismo de entrada informa su intención con un nombre propio. */
export type FuenteEntrada = 'teclado' | 'joystick';

export type ControlMovimiento = {
  /** La fuente informa su intención actual; `null` cuando la suelta. */
  fijarEntrada: (fuente: FuenteEntrada, vector: Vector | null) => void;
  /** Un solo paso (botones de la cruceta). */
  pasoUnico: (direccion: Direccion) => void;
};

/**
 * Controlador de movimiento: une las intenciones de todas las fuentes de entrada y, mientras
 * haya alguna, envía un paso cada `INTERVALO_PASO_MS`. Las fuentes no saben de pasos ni de
 * servidor, y este controlador no sabe de teclas ni de toques: agregar otra forma de moverse es
 * agregar otra fuente.
 */
export function useControlMovimiento({
  alPaso,
  puedeIr,
  habilitado,
}: {
  alPaso: (direccion: Direccion) => void;
  /** Anticipa si un paso es posible, para elegir el eje libre en diagonal. */
  puedeIr: (direccion: Direccion) => boolean;
  /** Si devuelve false (una actividad abierta encima de la sala), no se envían pasos. */
  habilitado: () => boolean;
}): ControlMovimiento {
  const entradas = useRef(new Map<FuenteEntrada, Vector>());
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimoPaso = useRef(-Infinity);
  const ultimoEje = useRef<EjePaso>('y');
  // Contra un borde o un mueble, el paso bloqueado se envía una sola vez (el servidor lo
  // explica) y no se repite mientras la intención sea la misma.
  const avisado = useRef(false);
  // Una pulsación nueva (sin otra intención activa) da al menos un paso, aunque se suelte
  // antes de que termine la espera entre pasos: un toque rápido no se pierde.
  const pendiente = useRef<Vector | null>(null);
  const funciones = useRef({ alPaso, puedeIr, habilitado });

  useEffect(() => {
    funciones.current = { alPaso, puedeIr, habilitado };
  });

  const detener = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
  }, []);

  const avanzar = useCallback(function paso() {
    temporizador.current = null;
    const vector = combinar(entradas.current.values()) ?? pendiente.current;
    if (!vector) return;
    const ahora = performance.now();
    const espera = ultimoPaso.current + INTERVALO_PASO_MS - ahora;
    if (espera > 0) {
      temporizador.current = setTimeout(paso, espera);
      return;
    }
    pendiente.current = null;
    const { alPaso, puedeIr, habilitado } = funciones.current;
    if (habilitado()) {
      const { direccion, eje, libre } = siguientePaso(vector, ultimoEje.current, puedeIr);
      ultimoEje.current = eje;
      if (libre || !avisado.current) {
        ultimoPaso.current = ahora;
        avisado.current = !libre;
        alPaso(direccion);
      }
    }
    temporizador.current = setTimeout(paso, INTERVALO_PASO_MS);
  }, []);

  const fijarEntrada = useCallback(
    (fuente: FuenteEntrada, vector: Vector | null) => {
      const antes = claveVector(combinar(entradas.current.values()));
      if (vector) entradas.current.set(fuente, vector);
      else entradas.current.delete(fuente);
      const despues = combinar(entradas.current.values());
      if (claveVector(despues) !== antes) avisado.current = false;
      if (despues && !antes) pendiente.current = despues;
      if (!despues && !pendiente.current) detener();
      else if (!temporizador.current) avanzar();
    },
    [avanzar, detener],
  );

  const pasoUnico = useCallback((direccion: Direccion) => {
    const ahora = performance.now();
    if (ahora - ultimoPaso.current < INTERVALO_PASO_MS) return;
    ultimoPaso.current = ahora;
    funciones.current.alPaso(direccion);
  }, []);

  // Con la pestaña oculta no llegan los eventos de soltar: se sueltan todas las entradas.
  useEffect(() => {
    const alCambiarVisibilidad = () => {
      if (!document.hidden) return;
      entradas.current.clear();
      pendiente.current = null;
      detener();
    };
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    return () => {
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      detener();
    };
  }, [detener]);

  return { fijarEntrada, pasoUnico };
}
