'use client';

import { useEffect, useRef } from 'react';
import type { Direccion } from '@/lib/api/salas';
import { direccionDeTecla, vectorDeDirecciones, type Vector } from './direcciones';

/**
 * Elementos que usan estas teclas para otra cosa: escribir (chat, formularios) o moverse entre
 * opciones (radios, listas, menús). Ahí las teclas no mueven el avatar.
 */
const CON_TECLAS_PROPIAS = [
  'input',
  'textarea',
  'select',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="textbox"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="menu"]',
  '[role="menubar"]',
  '[role="radiogroup"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="tablist"]',
  '[role="tree"]',
  '[role="grid"]',
].join(', ');

function usaLasTeclas(destino: EventTarget | null) {
  return destino instanceof Element && destino.closest(CON_TECLAS_PROPIAS) !== null;
}

/**
 * Fuente de entrada del teclado: WASD y flechas, en cualquier parte de la página salvo donde
 * esas teclas ya tienen otro uso. Lleva la cuenta de las teclas mantenidas (dos a la vez es una
 * diagonal) e informa la intención cada vez que cambia. La repetición automática del sistema se
 * ignora: el ritmo de los pasos lo pone el controlador de movimiento.
 */
export function useTeclasMovimiento(alCambiar: (vector: Vector | null) => void) {
  const avisar = useRef(alCambiar);

  useEffect(() => {
    avisar.current = alCambiar;
  });

  useEffect(() => {
    // Identificador de cada tecla mantenida y su dirección.
    const mantenidas = new Map<string, Direccion>();
    const informar = () => avisar.current(vectorDeDirecciones(mantenidas.values()));
    const soltarTodas = () => {
      if (mantenidas.size === 0) return;
      mantenidas.clear();
      informar();
    };
    const identificador = (evento: KeyboardEvent) => evento.code || evento.key.toLowerCase();

    const alBajar = (evento: KeyboardEvent) => {
      // Con un atajo en curso, el sistema puede no avisar cuando se suelta la tecla.
      if (evento.ctrlKey || evento.metaKey || evento.altKey) return soltarTodas();
      if (evento.isComposing) return;
      const direccion = direccionDeTecla(evento);
      if (!direccion || usaLasTeclas(evento.target)) return;
      // Con una actividad abierta encima de la sala, las teclas son de la actividad.
      if (document.querySelector('dialog[open]')) return;
      // También en las repeticiones: las flechas no desplazan la página mientras se camina.
      evento.preventDefault();
      const id = identificador(evento);
      if (mantenidas.get(id) === direccion) return;
      mantenidas.set(id, direccion);
      informar();
    };

    // Soltar siempre cuenta, aunque el foco ya esté en otro elemento.
    const alSubir = (evento: KeyboardEvent) => {
      if (mantenidas.delete(identificador(evento))) informar();
    };

    // Al cambiar de ventana o de pestaña no llega el evento de soltar.
    const alOcultar = () => {
      if (document.hidden) soltarTodas();
    };

    window.addEventListener('keydown', alBajar);
    window.addEventListener('keyup', alSubir);
    window.addEventListener('blur', soltarTodas);
    document.addEventListener('visibilitychange', alOcultar);
    return () => {
      window.removeEventListener('keydown', alBajar);
      window.removeEventListener('keyup', alSubir);
      window.removeEventListener('blur', soltarTodas);
      document.removeEventListener('visibilitychange', alOcultar);
    };
  }, []);
}
