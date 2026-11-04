'use client';

import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  type AnimationPlaybackControls,
} from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Cocuyo, type ExpresionCocuyo } from '@/components/guia/Cocuyo';
import { useSesion } from './ProveedorSesion';
import estilos from './EscenaAcceso.module.css';

type Modo = 'volar' | 'mirar' | 'tapar' | 'triste' | 'celebrar';
type Punto = { x: number; y: number };

const RESORTE_VUELO = { type: 'spring', stiffness: 70, damping: 16, mass: 0.9 } as const;
const DURACION_TRISTE = 2600;

/**
 * Escena del acceso: Cocuyo acompaña el formulario de iniciar sesión y de crear cuenta.
 *  - Vuela en una trayectoria suave junto al formulario (un ocho tendido a su derecha o, en
 *    pantallas estrechas, un vaivén corto sobre él).
 *  - Al enfocar un campo, vuela a su lado y lo mira; en la contraseña se tapa los ojos.
 *  - Si aparece un error (cualquier aviso con `role="alert"`), se pone triste un momento.
 *  - Cuando la sesión se abre, celebra.
 * No toca la lógica de los formularios: observa el foco, los avisos y la sesión. Es decorativo
 * (`aria-hidden`), no captura clics y con «reducir movimiento» se queda quieto junto al formulario.
 */
export function EscenaAcceso({ children }: { children: ReactNode }) {
  const escena = useRef<HTMLDivElement>(null);
  const reducir = useReducedMotion();
  const { usuario, cargando } = useSesion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [modo, setModo] = useState<Modo>('volar');
  const [objetivo, setObjetivo] = useState<Punto | null>(null);
  const [mira, setMira] = useState<'izquierda' | 'derecha' | undefined>(undefined);
  const [visible, setVisible] = useState(false);
  const [version, setVersion] = useState(0);
  const huboSinSesion = useRef(false);
  const modoTrasTristeza = useRef<{ modo: Modo; objetivo: Punto | null }>({
    modo: 'volar',
    objetivo: null,
  });

  const tamano = () => (window.innerWidth < 640 ? 36 : 46);

  /** Rectángulo del formulario visible, relativo a la escena. */
  const marco = () => {
    const raiz = escena.current;
    if (!raiz) return null;
    const panel =
      raiz.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])') ??
      raiz.querySelector<HTMLElement>('form') ??
      raiz.firstElementChild;
    if (!(panel instanceof HTMLElement)) return null;
    const base = raiz.getBoundingClientRect();
    const r = panel.getBoundingClientRect();
    return {
      ancho: base.width,
      izquierda: r.left - base.left,
      derecha: r.right - base.left,
      arriba: r.top - base.top,
      alto: r.height,
    };
  };

  /** Junto a un campo: a su derecha si hay sitio; si no, encima de su extremo derecho. */
  const junto = (campo: HTMLElement): Punto | null => {
    const raiz = escena.current;
    if (!raiz) return null;
    const base = raiz.getBoundingClientRect();
    const r = campo.getBoundingClientRect();
    const t = tamano();
    const derecha = r.right - base.left + 14;
    if (derecha + t < base.width - 4) {
      return { x: derecha, y: r.top - base.top + r.height / 2 - t / 2 - 4 };
    }
    return { x: r.right - base.left - t - 6, y: r.top - base.top - t + 4 };
  };

  // Foco: mirar el campo, o taparse los ojos en la contraseña.
  useEffect(() => {
    const raiz = escena.current;
    if (!raiz) return;
    let salida: ReturnType<typeof setTimeout> | undefined;
    const alEnfocar = (e: FocusEvent) => {
      const campo = e.target;
      if (!(campo instanceof HTMLInputElement || campo instanceof HTMLTextAreaElement)) return;
      if (campo instanceof HTMLInputElement && ['checkbox', 'radio'].includes(campo.type)) return;
      clearTimeout(salida);
      const punto = junto(campo);
      const nuevo: Modo = campo.type === 'password' ? 'tapar' : 'mirar';
      modoTrasTristeza.current = { modo: nuevo, objetivo: punto };
      setModo((actual) => (actual === 'triste' || actual === 'celebrar' ? actual : nuevo));
      setObjetivo(punto);
    };
    const alDesenfocar = () => {
      clearTimeout(salida);
      salida = setTimeout(() => {
        const activo = document.activeElement;
        if (activo instanceof HTMLInputElement && raiz.contains(activo)) return;
        modoTrasTristeza.current = { modo: 'volar', objetivo: null };
        setModo((actual) => (actual === 'triste' || actual === 'celebrar' ? actual : 'volar'));
        setObjetivo(null);
      }, 140);
    };
    // Mostrar u ocultar la contraseña cambia el tipo del campo con el foco puesto.
    const alCambiarTipo = new MutationObserver((cambios) => {
      for (const c of cambios) {
        const campo = c.target;
        if (campo instanceof HTMLInputElement && campo === document.activeElement) {
          setModo((actual) =>
            actual === 'triste' || actual === 'celebrar'
              ? actual
              : campo.type === 'password'
                ? 'tapar'
                : 'mirar',
          );
        }
      }
    });
    alCambiarTipo.observe(raiz, { attributes: true, attributeFilter: ['type'], subtree: true });
    raiz.addEventListener('focusin', alEnfocar);
    raiz.addEventListener('focusout', alDesenfocar);
    return () => {
      clearTimeout(salida);
      alCambiarTipo.disconnect();
      raiz.removeEventListener('focusin', alEnfocar);
      raiz.removeEventListener('focusout', alDesenfocar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  }, []);

  // Errores: cualquier aviso nuevo con role="alert" lo entristece un momento.
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
      setModo('triste');
      fin = setTimeout(() => {
        setModo(modoTrasTristeza.current.modo);
        setObjetivo(modoTrasTristeza.current.objetivo);
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
    const t = setTimeout(() => setModo('celebrar'), 0);
    return () => clearTimeout(t);
  }, [usuario, cargando]);

  // Recalcular la trayectoria si cambia el tamaño (otra pestaña, otra pantalla).
  useEffect(() => {
    const raiz = escena.current;
    if (!raiz) return;
    let marcoPendiente = 0;
    const observador = new ResizeObserver(() => {
      cancelAnimationFrame(marcoPendiente);
      marcoPendiente = requestAnimationFrame(() => setVersion((v) => v + 1));
    });
    observador.observe(raiz);
    return () => {
      cancelAnimationFrame(marcoPendiente);
      observador.disconnect();
    };
  }, []);

  // Vuelo.
  useEffect(() => {
    const m = marco();
    if (!m) return;
    const t = tamano();
    const estrecho = m.derecha + t + 70 > m.ancho;
    // Sitio de reposo: junto a la esquina superior derecha del formulario.
    const reposo: Punto = estrecho
      ? { x: m.derecha - t - 4, y: m.arriba - t - 6 }
      : { x: m.derecha + 18, y: m.arriba + 12 };
    const inicio = setTimeout(() => setVisible(true), 0);
    const controles: AnimationPlaybackControls[] = [];
    const parar = () => controles.forEach((c) => c.stop());

    if (reducir) {
      x.set(objetivo?.x ?? reposo.x);
      y.set(objetivo?.y ?? reposo.y);
      return () => {
        clearTimeout(inicio);
        parar();
      };
    }

    if ((modo === 'mirar' || modo === 'tapar' || modo === 'triste') && objetivo) {
      controles.push(animate(x, objetivo.x, RESORTE_VUELO), animate(y, objetivo.y, RESORTE_VUELO));
      setTimeout(() => setMira(objetivo.x > m.derecha - t ? 'izquierda' : undefined), 0);
      return () => {
        clearTimeout(inicio);
        parar();
      };
    }

    if (modo === 'celebrar' || modo === 'triste') {
      return () => clearTimeout(inicio);
    }

    // Trayectoria: un ocho tendido a la derecha del formulario, o un vaivén corto encima.
    const ruta: Punto[] = estrecho
      ? [
          reposo,
          { x: reposo.x - m.alto * 0.0 - 60, y: reposo.y - 10 },
          { x: reposo.x - 120, y: reposo.y + 4 },
          { x: reposo.x - 60, y: reposo.y + 12 },
          reposo,
        ]
      : [
          reposo,
          { x: m.derecha + 58, y: m.arriba + m.alto * 0.3 },
          { x: m.derecha + 24, y: m.arriba + m.alto * 0.55 },
          { x: m.derecha + 64, y: m.arriba + m.alto * 0.78 },
          { x: m.derecha + 30, y: m.arriba + m.alto * 0.42 },
          reposo,
        ];
    let vigente = true;
    const llegada = [animate(x, reposo.x, RESORTE_VUELO), animate(y, reposo.y, RESORTE_VUELO)];
    controles.push(...llegada);
    void Promise.all(llegada.map((c) => c.finished)).then(() => {
      if (!vigente) return;
      const duracion = estrecho ? 7 : 14;
      controles.push(
        animate(
          x,
          ruta.map((p) => p.x),
          { duration: duracion, ease: 'easeInOut', repeat: Infinity },
        ),
        animate(
          y,
          ruta.map((p) => p.y),
          { duration: duracion, ease: 'easeInOut', repeat: Infinity },
        ),
      );
    });
    return () => {
      vigente = false;
      clearTimeout(inicio);
      parar();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `x` e `y` son estables
  }, [modo, objetivo, reducir, version]);

  // Mientras vuela libre, mira hacia donde va (solo cambia al invertir el sentido).
  useMotionValueEvent(x, 'change', () => {
    if (modo !== 'volar') return;
    const v = x.getVelocity();
    if (Math.abs(v) < 4) return;
    const sentido = v < 0 ? 'izquierda' : 'derecha';
    if (sentido !== mira) setMira(sentido);
  });

  const expresion: ExpresionCocuyo | undefined =
    modo === 'tapar'
      ? 'tapado'
      : modo === 'triste'
        ? 'triste'
        : modo === 'celebrar'
          ? 'feliz'
          : undefined;

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
          <Cocuyo tamano={46} mira={mira} expresion={expresion} encendido={modo !== 'triste'} />
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
