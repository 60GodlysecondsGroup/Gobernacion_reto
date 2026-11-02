'use client';

import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import estilos from './Guia.module.css';

const DURACION_SALIDA_MS = 280;
/** Por encima de esta diferencia (px) entre la pantalla y lo visible, hay un teclado abierto. */
const UMBRAL_TECLADO = 80;

/**
 * Hoja inferior de Cocuyo en móvil y tableta, sobre el elemento nativo `<dialog>` (como
 * `ModalFicha`): el navegador atrapa el foco, deja inerte la página y, al cerrar, devuelve el foco
 * a la burbuja. Sube desde abajo hasta casi todo el alto y oscurece el fondo; baja con la misma
 * animación al cerrarse con su botón, con Escape o al tocar el fondo. El contenido se queda montado
 * al cerrarla, así que el borrador y la posición de la conversación no se pierden.
 */
export function HojaCocuyo({
  abierta,
  alCerrar,
  irAlFinal,
  devolverFocoA,
  children,
}: {
  abierta: boolean;
  alCerrar: () => void;
  /** Al abrirse, muestra el último mensaje (si no, la presentación de Cocuyo). */
  irAlFinal: boolean;
  /** Recibe el foco al cerrarse (iOS no enfoca los botones al tocarlos, así que no basta el nativo). */
  devolverFocoA: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const hoja = ref.current;
    if (!hoja) return;
    if (abierta) {
      delete hoja.dataset.cerrando;
      if (!hoja.open) {
        hoja.showModal();
        // Mientras estuvo oculta la conversación perdió su desplazamiento: vuelve al último mensaje.
        const conversacion = hoja.querySelector('[role="log"]');
        conversacion?.scrollTo({ top: irAlFinal ? conversacion.scrollHeight : 0 });
      }
      // La página de fondo no se desplaza (ni turna sus barras) mientras la hoja está abierta.
      document.documentElement.classList.add(estilos.sinScroll!);
      return;
    }
    if (!hoja.open) return;
    const cerrar = () => {
      delete hoja.dataset.cerrando;
      hoja.close();
      document.documentElement.classList.remove(estilos.sinScroll!);
      devolverFocoA.current?.focus({ preventScroll: true });
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cerrar();
      return;
    }
    hoja.dataset.cerrando = '';
    const temporizador = setTimeout(cerrar, DURACION_SALIDA_MS);
    return () => clearTimeout(temporizador);
    // `irAlFinal` solo se usa al pasar de cerrada a abierta; con la hoja ya abierta no hace nada.
  }, [abierta, irAlFinal, devolverFocoA]);

  // Si la hoja desaparece abierta (otra página, otro tamaño de pantalla), se libera el desplazamiento.
  useEffect(() => () => document.documentElement.classList.remove(estilos.sinScroll!), []);

  // Teclado virtual: la hoja se ajusta a la parte visible de la pantalla para que el campo de
  // escritura quede siempre justo encima del teclado (iOS y Android no achican `position: fixed`).
  useEffect(() => {
    const hoja = ref.current;
    const vista = window.visualViewport;
    if (!abierta || !hoja || !vista) return;
    let marco = 0;
    const ajustar = () => {
      marco = 0;
      // Con zoom la parte visible no es la pantalla: se queda con el alto completo.
      if (vista.scale > 1.01) {
        hoja.style.removeProperty('--hoja-arriba');
        hoja.style.removeProperty('--hoja-alto');
        delete hoja.dataset.teclado;
        return;
      }
      const oculto = document.documentElement.clientHeight - vista.height - vista.offsetTop;
      hoja.style.setProperty('--hoja-arriba', `${vista.offsetTop}px`);
      hoja.style.setProperty('--hoja-alto', `${vista.height}px`);
      if (oculto > UMBRAL_TECLADO) hoja.dataset.teclado = '';
      else delete hoja.dataset.teclado;
    };
    const alCambiar = () => {
      if (!marco) marco = requestAnimationFrame(ajustar);
    };
    ajustar();
    vista.addEventListener('resize', alCambiar);
    vista.addEventListener('scroll', alCambiar);
    return () => {
      vista.removeEventListener('resize', alCambiar);
      vista.removeEventListener('scroll', alCambiar);
      cancelAnimationFrame(marco);
    };
  }, [abierta]);

  return (
    <dialog
      ref={ref}
      id="guia-virtual"
      className={estilos.hoja}
      aria-labelledby="guia-titulo"
      onCancel={(evento) => {
        // Escape: cerramos con la misma animación de salida que el botón «Minimizar».
        evento.preventDefault();
        alCerrar();
      }}
      onClick={(evento) => {
        // Toque en el fondo oscurecido (fuera de la hoja): cierra.
        if (evento.target === evento.currentTarget) alCerrar();
      }}
    >
      {children}
    </dialog>
  );
}
