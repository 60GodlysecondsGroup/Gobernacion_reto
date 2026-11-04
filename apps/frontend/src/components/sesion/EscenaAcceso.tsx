'use client';

import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Cocuyo, type ExpresionCocuyo } from '@/components/guia/Cocuyo';
import { useSesion } from './ProveedorSesion';
import estilos from './EscenaAcceso.module.css';

type Modo = 'reposo' | 'mirar' | 'espaldas' | 'triste' | 'celebrar';

const RESORTE = { type: 'spring', stiffness: 120, damping: 20, mass: 0.8 } as const;
const DURACION_TRISTE = 2600;
const SEPARACION = 16;

/** Solo el nametag y la contraseña atraen a Cocuyo. */
const esCampoVigilado = (el: Element | null): el is HTMLInputElement =>
  el instanceof HTMLInputElement && (el.name === 'username' || el.name === 'password');

/** Contraseña escrita y oculta: Cocuyo no mira. */
const modoDeCampo = (campo: HTMLInputElement): Modo =>
  campo.name === 'password' && campo.type === 'password' ? 'espaldas' : 'mirar';

/**
 * Escena del acceso: Cocuyo acompaña el formulario de iniciar sesión y de crear cuenta, siempre
 * por fuera de él (a la derecha; en pantallas estrechas, encima de las pestañas).
 *  - En reposo se queda quieto junto al formulario, solo flotando un poco.
 *  - Al tocar el nametag, se acerca a su altura y lo mira.
 *  - En la contraseña: si está visible, la mira; si está oculta (o se oculta con «Ocultar»), se
 *    voltea y cierra los ojos.
 *  - Ante un error (aviso con `role="alert"`) se pone triste; cuando se abre la sesión, celebra.
 * No toca la lógica de los formularios: observa el foco, el tipo del campo, los avisos y la
 * sesión. Es decorativo (`aria-hidden`), no captura clics y con «reducir movimiento» no se anima.
 */
export function EscenaAcceso({ children }: { children: ReactNode }) {
  const escena = useRef<HTMLDivElement>(null);
  const reducir = useReducedMotion();
  const { usuario, cargando } = useSesion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [modo, setModo] = useState<Modo>('reposo');
  const [campo, setCampo] = useState<HTMLInputElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [lateral, setLateral] = useState(true);
  const [version, setVersion] = useState(0);
  const campoActivo = useRef<HTMLInputElement | null>(null);
  const huboSinSesion = useRef(false);
  const temporal = useRef(false); // triste o celebrando: el foco no lo interrumpe

  const tamano = () => (window.innerWidth < 640 ? 36 : 46);

  // Foco y visibilidad de la contraseña.
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

    const fijarCampo = (nuevo: HTMLInputElement | null) => {
      campoActivo.current = nuevo;
      setCampo(nuevo);
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

    // «Mostrar» / «Ocultar» cambian el tipo del campo de contraseña.
    const tipos = new MutationObserver((cambios) => {
      for (const c of cambios) {
        if (c.target === campoActivo.current && !temporal.current) {
          setModo(modoDeCampo(c.target as HTMLInputElement));
        }
      }
    });
    tipos.observe(raiz, { attributes: true, attributeFilter: ['type'], subtree: true });
    raiz.addEventListener('focusin', alEnfocar);
    raiz.addEventListener('focusout', alDesenfocar);
    return () => {
      clearTimeout(salida);
      tipos.disconnect();
      raiz.removeEventListener('focusin', alEnfocar);
      raiz.removeEventListener('focusout', alDesenfocar);
    };
  }, []);

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
    const remedir = () => {
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
      // Sin sitio al lado: encima de las pestañas, en su extremo derecho.
      const pestanas = raiz.querySelector<HTMLElement>('[role="tablist"]');
      const arriba = (pestanas ?? panel).getBoundingClientRect();
      destino = { x: arriba.right - base.left - t, y: arriba.top - base.top - t - 8 };
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
    modo === 'espaldas'
      ? 'cerrado'
      : modo === 'triste'
        ? 'triste'
        : modo === 'celebrar'
          ? 'feliz'
          : undefined;
  // A la derecha del formulario mira hacia él; encima de las pestañas, al frente.
  const mira = lateral && (modo === 'mirar' || modo === 'reposo') ? 'izquierda' : undefined;

  return (
    <div ref={escena} className={estilos.escena}>
      {children}
      <motion.div
        className={estilos.cocuyo}
        style={{ x, y }}
        data-modo={modo}
        data-visible={visible || undefined}
        aria-hidden="true"
      >
        <span className={estilos.cuerpo}>
          <span className={estilos.giro}>
            <Cocuyo tamano={46} mira={mira} expresion={expresion} encendido={modo !== 'triste'} />
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
