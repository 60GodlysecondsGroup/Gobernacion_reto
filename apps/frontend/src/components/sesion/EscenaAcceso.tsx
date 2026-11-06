'use client';

import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Cocuyo, type ExpresionCocuyo, type ManosCocuyo } from '@/components/guia/Cocuyo';
import { useSesion } from './ProveedorSesion';
import estilos from './EscenaAcceso.module.css';

type Modo = 'reposo' | 'mirar' | 'tapar' | 'triste' | 'celebrar';
type Mirada = { x: number; y: number };

const RESORTE = { type: 'spring', stiffness: 120, damping: 20, mass: 0.8 } as const;
const DURACION_TRISTE = 2600;
const SEPARACION = 16;
/** Cada cuánto, con la contraseña oculta, Cocuyo abre una rendija para espiar (y cuánto dura). */
const CADA_ESPIADA = 4200;
const DURACION_ESPIADA = 850;

/** Solo el nametag (o el correo) y la contraseña atraen a Cocuyo. */
const esCampoVigilado = (el: Element | null): el is HTMLInputElement =>
  el instanceof HTMLInputElement && (el.name === 'username' || el.name === 'password');

/** Contraseña oculta: Cocuyo se tapa los ojos. */
const modoDeCampo = (campo: HTMLInputElement): Modo =>
  campo.name === 'password' && campo.type === 'password' ? 'tapar' : 'mirar';

let lienzo: CanvasRenderingContext2D | null | undefined;

/**
 * Qué tan avanzado está el cursor dentro del campo (0 = al principio, 1 = al final del ancho
 * visible). Mide el texto hasta el cursor con la misma fuente del campo; no toca el campo.
 */
function avanceDelCursor(campo: HTMLInputElement): number {
  lienzo ??= document.createElement('canvas').getContext('2d');
  if (!lienzo) return 0;
  const cs = getComputedStyle(campo);
  lienzo.font = cs.font || `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const hasta = campo.selectionEnd ?? campo.value.length;
  const texto = campo.type === 'password' ? '•'.repeat(hasta) : campo.value.slice(0, hasta);
  const espaciado = Number.parseFloat(cs.letterSpacing) || 0;
  const izquierda = Number.parseFloat(cs.paddingLeft) + Number.parseFloat(cs.borderLeftWidth);
  const derecha = Number.parseFloat(cs.paddingRight) + Number.parseFloat(cs.borderRightWidth);
  const util = campo.clientWidth - izquierda - derecha;
  if (util <= 0) return 0;
  const ancho = lienzo.measureText(texto).width + espaciado * texto.length - campo.scrollLeft;
  return Math.max(0, Math.min(1, ancho / util));
}

/**
 * Escena del acceso: Cocuyo acompaña los formularios de entrada (jóvenes y equipo) y el de crear
 * cuenta, siempre por fuera de ellos (a la derecha; en pantallas estrechas, encima).
 *  - En reposo se queda quieto junto al formulario, solo flotando un poco.
 *  - Al tocar el nametag o el correo se acerca a su altura y sigue con los ojos lo que se escribe
 *    (asiente con cada tecla e inclina la cabeza según dónde va el cursor).
 *  - En la contraseña: si está visible, la lee igual; si está oculta, sube las alas y se tapa los
 *    ojos (con cada tecla tiembla un poco y de vez en cuando espía con un ojo). Al pulsar
 *    «Mostrar» se sorprende; al pulsar «Ocultar» niega con la cabeza y se vuelve a tapar.
 *  - Ante un error (aviso con `role="alert"`) se pone triste; cuando se abre la sesión, celebra.
 * No toca la lógica de los formularios: observa el foco, el cursor, el tipo del campo, los avisos y
 * la sesión. Es decorativo (`aria-hidden`), no captura clics y con «reducir movimiento» no se anima.
 */
export function EscenaAcceso({ children }: { children: ReactNode }) {
  const escena = useRef<HTMLDivElement>(null);
  const personaje = useRef<HTMLDivElement>(null);
  const gesto = useRef<HTMLSpanElement>(null);
  const reducir = useReducedMotion();
  const { usuario, cargando } = useSesion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [modo, setModo] = useState<Modo>('reposo');
  const [campo, setCampo] = useState<HTMLInputElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [lateral, setLateral] = useState(true);
  const [version, setVersion] = useState(0);
  const [avance, setAvance] = useState(0);
  const [espiando, setEspiando] = useState(false);
  const campoActivo = useRef<HTMLInputElement | null>(null);
  const huboSinSesion = useRef(false);
  const temporal = useRef(false); // triste o celebrando: el foco no lo interrumpe
  const reducirRef = useRef(reducir);

  useEffect(() => {
    reducirRef.current = reducir;
  }, [reducir]);

  const tamano = () => (window.innerWidth < 640 ? 36 : 46);

  /** Un gesto corto sobre el personaje (sin pisar el que ya está en marcha). */
  const hacerGesto = (fotogramas: Keyframe[], duracion: number, interrumpir = false) => {
    const el = gesto.current;
    if (!el || reducirRef.current || typeof el.animate !== 'function') return;
    const enCurso = el.getAnimations();
    if (enCurso.length && !interrumpir) return;
    enCurso.forEach((a) => a.cancel());
    el.animate(fotogramas, { duration: duracion, easing: 'cubic-bezier(0.3, 1.3, 0.5, 1)' });
  };

  // Foco, cursor y visibilidad de la contraseña.
  useEffect(() => {
    const raiz = escena.current;
    if (!raiz) return;
    let salida: ReturnType<typeof setTimeout> | undefined;

    /** ¿El foco está en un control junto al campo activo (el botón «Mostrar / Ocultar»)? */
    const juntoAlCampo = (el: Element | null) => {
      const actual = campoActivo.current;
      return Boolean(
        actual &&
        el instanceof HTMLButtonElement &&
        raiz.contains(el) &&
        el.parentElement?.contains(actual),
      );
    };

    const medir = () => {
      const actual = campoActivo.current;
      if (actual) setAvance(avanceDelCursor(actual));
    };

    const fijarCampo = (nuevo: HTMLInputElement | null) => {
      campoActivo.current = nuevo;
      setCampo(nuevo);
      if (nuevo) setAvance(avanceDelCursor(nuevo));
      if (!temporal.current) setModo(nuevo ? modoDeCampo(nuevo) : 'reposo');
    };

    const alEnfocar = (e: FocusEvent) => {
      clearTimeout(salida);
      const el = e.target instanceof Element ? e.target : null;
      if (esCampoVigilado(el)) return fijarCampo(el);
      // El botón «Mostrar / Ocultar» está junto a su campo: Cocuyo sigue en la contraseña.
      if (juntoAlCampo(el)) return;
      fijarCampo(null);
    };

    const alDesenfocar = () => {
      clearTimeout(salida);
      salida = setTimeout(() => {
        const activo = document.activeElement;
        if (esCampoVigilado(activo) && raiz.contains(activo)) return;
        if (juntoAlCampo(activo)) return;
        fijarCampo(null);
      }, 150);
    };

    // Cada tecla: los ojos siguen el cursor y Cocuyo asiente (o, tapado, tiembla un poco).
    const alEscribir = (e: Event) => {
      if (e.target !== campoActivo.current || temporal.current) return;
      medir();
      const tapado = modoDeCampo(campoActivo.current!) === 'tapar';
      hacerGesto(
        tapado
          ? [
              { transform: 'none' },
              { transform: 'translateX(-1px) rotate(-3deg)' },
              { transform: 'translateX(1px) rotate(3deg)' },
              { transform: 'none' },
            ]
          : [
              { transform: 'none' },
              { transform: 'translateY(2px) rotate(-2deg)' },
              { transform: 'none' },
            ],
        tapado ? 200 : 170,
      );
    };

    // Mover el cursor con flechas, clic o selección también mueve la mirada.
    const alMoverCursor = (e: Event) => {
      if (e.target === campoActivo.current) medir();
    };

    // «Mostrar» / «Ocultar» cambian el tipo del campo de contraseña.
    const tipos = new MutationObserver((cambios) => {
      for (const c of cambios) {
        const el = c.target as HTMLInputElement;
        if (el !== campoActivo.current || temporal.current) continue;
        const nuevo = modoDeCampo(el);
        setModo(nuevo);
        setAvance(avanceDelCursor(el));
        if (nuevo === 'mirar') {
          // ¡Sorpresa! Salta un poco al ver la contraseña.
          hacerGesto(
            [
              { transform: 'none' },
              { transform: 'translateY(-7px) scale(1.12)', offset: 0.35 },
              { transform: 'translateY(0) scale(0.96, 1.04)', offset: 0.7 },
              { transform: 'none' },
            ],
            460,
            true,
          );
        } else {
          // «No, no miro»: niega con la cabeza mientras sube las alas.
          hacerGesto(
            [
              { transform: 'none' },
              { transform: 'rotate(-9deg)' },
              { transform: 'rotate(8deg)' },
              { transform: 'rotate(-5deg)' },
              { transform: 'none' },
            ],
            480,
            true,
          );
        }
      }
    });
    tipos.observe(raiz, { attributes: true, attributeFilter: ['type'], subtree: true });
    raiz.addEventListener('focusin', alEnfocar);
    raiz.addEventListener('focusout', alDesenfocar);
    raiz.addEventListener('input', alEscribir);
    raiz.addEventListener('keyup', alMoverCursor);
    raiz.addEventListener('pointerup', alMoverCursor);
    raiz.addEventListener('select', alMoverCursor);
    return () => {
      clearTimeout(salida);
      tipos.disconnect();
      raiz.removeEventListener('focusin', alEnfocar);
      raiz.removeEventListener('focusout', alDesenfocar);
      raiz.removeEventListener('input', alEscribir);
      raiz.removeEventListener('keyup', alMoverCursor);
      raiz.removeEventListener('pointerup', alMoverCursor);
      raiz.removeEventListener('select', alMoverCursor);
    };
  }, []);

  // Tapado, de vez en cuando abre una rendija y espía con un ojo.
  useEffect(() => {
    if (modo !== 'tapar' || reducir) return;
    let cerrar: ReturnType<typeof setTimeout> | undefined;
    const ciclo = setInterval(() => {
      setEspiando(true);
      cerrar = setTimeout(() => setEspiando(false), DURACION_ESPIADA);
    }, CADA_ESPIADA);
    return () => {
      clearInterval(ciclo);
      clearTimeout(cerrar);
      setEspiando(false);
    };
  }, [modo, reducir]);

  // Errores: un aviso nuevo con role="alert" lo entristece un momento.
  useEffect(() => {
    const raiz = escena.current;
    if (!raiz) return;
    let fin: ReturnType<typeof setTimeout> | undefined;
    const observador = new MutationObserver((cambios) => {
      const hayAlerta = cambios.some((c) =>
        [...c.addedNodes].some(
          (n) =>
            n instanceof HTMLElement &&
            (n.getAttribute('role') === 'alert' || n.querySelector('[role="alert"]')),
        ),
      );
      if (!hayAlerta) return;
      clearTimeout(fin);
      temporal.current = true;
      setModo('triste');
      fin = setTimeout(() => {
        temporal.current = false;
        const actual = campoActivo.current;
        setModo(actual ? modoDeCampo(actual) : 'reposo');
      }, DURACION_TRISTE);
    });
    observador.observe(raiz, { childList: true, subtree: true });
    return () => {
      clearTimeout(fin);
      observador.disconnect();
    };
  }, []);

  // Sesión: si no había y aparece, celebra.
  useEffect(() => {
    if (cargando) return;
    if (!usuario) {
      huboSinSesion.current = true;
      return;
    }
    if (!huboSinSesion.current) return;
    const t = setTimeout(() => {
      temporal.current = true;
      setModo('celebrar');
    }, 0);
    return () => clearTimeout(t);
  }, [usuario, cargando]);

  // Recalcular la posición si cambia el tamaño (otra pestaña del formulario, otra pantalla).
  useEffect(() => {
    const raiz = escena.current;
    if (!raiz) return;
    let pendiente = 0;
    const observador = new ResizeObserver(() => {
      cancelAnimationFrame(pendiente);
      pendiente = requestAnimationFrame(() => setVersion((v) => v + 1));
    });
    observador.observe(raiz);
    // Las entradas animadas del formulario lo desplazan un momento: al terminar, se vuelve a medir
    // para que Cocuyo quede siempre fuera de él.
    const remedir = (e: Event) => {
      // Las de Cocuyo (alas, ojos, gestos) no mueven el formulario.
      if (e.target instanceof Node && personaje.current?.contains(e.target)) return;
      cancelAnimationFrame(pendiente);
      pendiente = requestAnimationFrame(() => setVersion((v) => v + 1));
    };
    raiz.addEventListener('animationend', remedir);
    raiz.addEventListener('transitionend', remedir);
    return () => {
      cancelAnimationFrame(pendiente);
      observador.disconnect();
      raiz.removeEventListener('animationend', remedir);
      raiz.removeEventListener('transitionend', remedir);
    };
  }, []);

  // Posición: siempre fuera del formulario.
  useEffect(() => {
    const raiz = escena.current;
    if (!raiz) return;
    const panel =
      raiz.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])') ??
      raiz.querySelector<HTMLElement>('form');
    if (!panel) return;
    const base = raiz.getBoundingClientRect();
    const r = panel.getBoundingClientRect();
    const t = tamano();
    const derecha = r.right - base.left + SEPARACION;
    const hayLado = derecha + t <= base.width - 4;
    let destino: { x: number; y: number };
    if (hayLado) {
      // A la derecha del formulario: a la altura del campo elegido o junto a su parte de arriba.
      const ref = campo && raiz.contains(campo) ? campo.getBoundingClientRect() : null;
      const centro = ref ? ref.top - base.top + ref.height / 2 : r.top - base.top + 40;
      destino = { x: derecha, y: centro - t / 2 };
    } else {
      // Sin sitio al lado: encima de las pestañas, en su extremo derecho. Sin pestañas (acceso del
      // equipo), posado sobre el borde de arriba de la tarjeta, sin pisar el texto de encima.
      const pestanas = raiz.querySelector<HTMLElement>('[role="tablist"]');
      if (pestanas) {
        const arriba = pestanas.getBoundingClientRect();
        destino = { x: arriba.right - base.left - t, y: arriba.top - base.top - t - 8 };
      } else {
        destino = { x: r.right - base.left - t - 14, y: r.top - base.top - t * 0.62 };
      }
    }
    const mostrar = setTimeout(() => {
      setLateral(hayLado);
      setVisible(true);
    }, 0);
    if (reducir || !visible) {
      x.set(destino.x);
      y.set(destino.y);
      return () => clearTimeout(mostrar);
    }
    const controles = [animate(x, destino.x, RESORTE), animate(y, destino.y, RESORTE)];
    return () => {
      clearTimeout(mostrar);
      controles.forEach((c) => c.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `x` e `y` son estables
  }, [campo, version, reducir, visible]);

  const expresion: ExpresionCocuyo | undefined =
    modo === 'triste' ? 'triste' : modo === 'celebrar' ? 'feliz' : undefined;
  const manos: ManosCocuyo = modo === 'tapar' ? (espiando ? 'espiando' : 'tapando') : 'abajo';

  // Mirada: a la derecha del formulario, el campo queda a su izquierda y los ojos se acercan al
  // centro a medida que el cursor avanza hacia él; encima, el campo queda abajo a la izquierda.
  let mirada: Mirada | undefined;
  let inclinar = 0;
  if (modo === 'mirar') {
    mirada = lateral ? { x: -1 + avance * 0.9, y: 0.5 } : { x: -1 + avance * 1.6, y: 1 };
    // Cabeza ladeada hacia el campo: más cuanto más lejos esté el cursor.
    inclinar = reducir ? 0 : lateral ? -9 + avance * 7 : -4 + avance * 8;
  } else if (modo === 'tapar') {
    // Tapado, los ojos quedan centrados bajo las alas; al espiar, el ojo libre mira de reojo.
    mirada = { x: espiando && lateral ? -0.5 : 0, y: 0 };
  } else if (modo === 'reposo') {
    mirada = lateral ? { x: -1, y: 0 } : { x: 0, y: 0 };
  }

  return (
    <div ref={escena} className={estilos.escena}>
      {children}
      <motion.div
        ref={personaje}
        className={estilos.cocuyo}
        style={{ x, y }}
        data-modo={modo}
        data-visible={visible || undefined}
        aria-hidden="true"
      >
        <span className={estilos.cuerpo}>
          <span className={estilos.inclinacion} style={{ rotate: `${inclinar}deg` }}>
            <span ref={gesto} className={estilos.gesto}>
              <Cocuyo
                tamano={46}
                mirada={mirada}
                expresion={expresion}
                manos={manos}
                encendido={modo !== 'triste'}
              />
            </span>
          </span>
        </span>
        {modo === 'celebrar' && (
          <span className={estilos.chispas}>
            <span />
            <span />
            <span />
            <span />
          </span>
        )}
      </motion.div>
    </div>
  );
}
