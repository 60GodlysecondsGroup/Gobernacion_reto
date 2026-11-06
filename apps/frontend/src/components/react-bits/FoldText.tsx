'use client';

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useTextoEstatico } from '@/lib/hooks/useTextoEstatico';
import { CONSULTA_TEXTO_ESTATICO } from '@/lib/movimiento';
import estilos from './FoldText.module.css';

/*
 * FoldText — adaptado de React Bits (https://reactbits.dev, MIT + Commons Clause), variante
 * JS + CSS, a TypeScript. Misma API y misma lógica de pliegue (paper, blinds, flip), escalonado,
 * disparadores y repliegue al pasar el cursor. Cambios para este proyecto:
 *  - Sin GSAP (no está instalado): la línea de tiempo, el escalonado y las curvas se calculan
 *    con `requestAnimationFrame`; `ease` acepta los nombres de GSAP («power3.out», «power2.inOut»,
 *    «sine.out», «expo.out», «none»…).
 *  - `trigger="scroll"` usa IntersectionObserver (mismo punto: cuando la parte superior llega al
 *    82 % de la pantalla).
 *  - Estilos en CSS Modules.
 *  - En móvil no se pliega: el texto se ve tal cual, sin bucle de animación ni escuchas del
 *    puntero (el CSS lo deja visible también antes de hidratar).
 */

type Hinge = 'top' | 'bottom' | 'left' | 'right';
type FoldStyle = 'paper' | 'blinds' | 'flip';
type StaggerFrom = 'start' | 'center' | 'end' | 'edges' | 'random';

type FoldTextProps = {
  text?: string;
  splitBy?: 'char' | 'word' | 'line';
  hinge?: Hinge;
  foldStyle?: FoldStyle;
  duration?: number;
  stagger?: number;
  staggerFrom?: StaggerFrom;
  foldAngle?: number;
  ease?: string;
  perspective?: number;
  creaseShading?: number;
  trigger?: 'mount' | 'hover' | 'scroll' | 'loop';
  loopDelay?: number;
  hoverRefold?: boolean;
  refoldRadius?: number;
  refoldAngle?: number;
  fontSize?: string | number;
  fontWeight?: string | number;
  color?: string;
  className?: string;
  style?: CSSProperties;
};

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const HINGES: Record<Hinge, { origin: string; axis: 'rotateX' | 'rotateY'; sign: number }> = {
  top: { origin: '50% 0%', axis: 'rotateX', sign: -1 },
  bottom: { origin: '50% 100%', axis: 'rotateX', sign: 1 },
  left: { origin: '0% 50%', axis: 'rotateY', sign: 1 },
  right: { origin: '100% 50%', axis: 'rotateY', sign: -1 },
};

const SLATS = {
  rotateX: {
    origins: ['50% 25%', '50% 75%'],
    clips: ['inset(-40% -20% 50% -20%)', 'inset(50% -20% -40% -20%)'],
  },
  rotateY: {
    origins: ['25% 50%', '75% 50%'],
    clips: ['inset(-40% 50% -40% -20%)', 'inset(-40% -20% -40% 50%)'],
  },
};

const FOLD_STYLES: FoldStyle[] = ['paper', 'blinds', 'flip'];
const SLAT_DELAY = 0.24;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Curvas con los nombres de GSAP que se usan en React Bits. */
function parseEase(nombre: string): (t: number) => number {
  const [familia = 'power3', tipo = 'out'] = nombre.split('.');
  const base: Record<string, (t: number) => number> = {
    none: (t) => t,
    linear: (t) => t,
    power0: (t) => t,
    power1: (t) => t ** 2,
    quad: (t) => t ** 2,
    power2: (t) => t ** 3,
    cubic: (t) => t ** 3,
    power3: (t) => t ** 4,
    quart: (t) => t ** 4,
    power4: (t) => t ** 5,
    quint: (t) => t ** 5,
    sine: (t) => 1 - Math.cos((t * Math.PI) / 2),
    expo: (t) => (t === 0 ? 0 : 2 ** (10 * (t - 1))),
    circ: (t) => 1 - Math.sqrt(1 - t * t),
  };
  const entrada = base[familia] ?? base.power3!;
  if (familia === 'none' || familia === 'linear') return entrada;
  if (tipo === 'in') return entrada;
  if (tipo === 'inOut') {
    return (t) => (t < 0.5 ? entrada(t * 2) / 2 : 1 - entrada((1 - t) * 2) / 2);
  }
  return (t) => 1 - entrada(1 - t);
}

/** Retrasos del escalonado según `staggerFrom` (en unidades de `stagger`). */
function ordenEscalonado(total: number, desde: StaggerFrom): number[] {
  const indices = Array.from({ length: total }, (_, i) => i);
  if (desde === 'end') return indices.map((i) => total - 1 - i);
  if (desde === 'center') {
    const centro = (total - 1) / 2;
    return indices.map((i) => Math.abs(i - centro));
  }
  if (desde === 'edges') {
    const centro = (total - 1) / 2;
    return indices.map((i) => centro - Math.abs(i - centro));
  }
  if (desde === 'random') {
    const barajados = [...indices].sort(() => Math.random() - 0.5);
    return indices.map((i) => barajados.indexOf(i));
  }
  return indices;
}

type Pieza = {
  element: HTMLElement;
  parts: HTMLElement[];
  t: number;
  f: number;
  r: number;
  aim: number;
};

export default function FoldText({
  text = 'Design unfolds',
  splitBy = 'char',
  hinge = 'top',
  foldStyle = 'paper',
  duration = 0.65,
  stagger = 0.045,
  staggerFrom = 'start',
  foldAngle = 92,
  ease = 'power3.out',
  perspective = 700,
  creaseShading = 0.55,
  trigger = 'mount',
  loopDelay = 1.4,
  hoverRefold = false,
  refoldRadius = 140,
  refoldAngle = 45,
  fontSize = 80,
  fontWeight = 800,
  color = 'currentColor',
  className = '',
  style = {},
}: FoldTextProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const safeHinge: Hinge = HINGES[hinge] ? hinge : 'top';
  const hingeConfig = HINGES[safeHinge];
  const safeStyle: FoldStyle = FOLD_STYLES.includes(foldStyle) ? foldStyle : 'paper';
  const safeCrease = clamp(creaseShading, 0, 1);
  const safeAngle = clamp(foldAngle, 0, 180);
  const safeStagger = Math.max(0, stagger);
  const safeDelay = Math.max(0, loopDelay);
  const safeRadius = Math.max(1, refoldRadius);
  const safeRefold = clamp(refoldAngle, 0, 180);
  const startsFolded = trigger !== 'hover';
  const estatico = useTextoEstatico();

  const segments = useMemo(() => {
    const renderPiece = (content: string, key: string, isLine = false) => (
      <span className={estilos.segment} data-fold-split={isLine ? 'line' : undefined} key={key}>
        {safeStyle === 'blinds' ? (
          <span
            className={estilos.piece}
            data-fold-hinge={safeHinge}
            data-fold-style="blinds"
            style={startsFolded ? { opacity: 0 } : undefined}
          >
            <span className={estilos.slat} data-fold-text={content}>
              {content}
            </span>
            <span className={estilos.slat} data-fold-slat="b" data-fold-text={content}>
              {content}
            </span>
          </span>
        ) : (
          <span
            className={estilos.piece}
            data-fold-hinge={safeHinge}
            data-fold-style={safeStyle}
            data-fold-text={content}
            style={startsFolded ? { opacity: 0 } : undefined}
          >
            {content}
          </span>
        )}
      </span>
    );

    if (splitBy === 'line') {
      return text.split('\n').map((line, index) => renderPiece(line || ' ', `line-${index}`, true));
    }

    return text.split(/(\s+)/).flatMap((part, partIndex): ReactNode[] => {
      if (!part) return [];
      if (/^\s+$/.test(part)) {
        return part
          .split('\n')
          .flatMap((spaces, lineIndex) => [
            lineIndex > 0 ? <br key={`br-${partIndex}-${lineIndex}`} /> : null,
            spaces,
          ])
          .filter(Boolean);
      }
      if (splitBy === 'word') return [renderPiece(part, `word-${partIndex}`)];
      return [
        <span className={estilos.word} key={`word-${partIndex}`}>
          {Array.from(part).map((char, charIndex) =>
            renderPiece(char, `char-${partIndex}-${charIndex}`),
          )}
        </span>,
      ];
    });
  }, [text, splitBy, safeHinge, safeStyle, startsFolded]);

  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    // Se consulta aquí también: en la hidratación `estatico` aún vale lo del servidor (escritorio).
    if (estatico || window.matchMedia(CONSULTA_TEXTO_ESTATICO).matches) return undefined;
    const elements = Array.from(root.querySelectorAll<HTMLElement>(`.${estilos.piece}`));
    if (!elements.length) return undefined;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const { axis, sign, origin } = hingeConfig;
    const slats = SLATS[axis];
    const unfoldEase = parseEase(reduceMotion ? 'power1.out' : ease);
    const foldEase = parseEase(reduceMotion ? 'power1.in' : 'power2.in');
    const angle = reduceMotion ? 0 : safeStyle === 'flip' ? 180 : safeAngle;
    const crease = reduceMotion ? 0 : safeCrease;
    const refold = hoverRefold && !reduceMotion ? safeRefold : 0;
    const lift = safeStyle === 'flip' && !reduceMotion ? 0.45 : 0;
    const unfoldDuration = reduceMotion ? Math.min(duration, 0.22) : duration;
    const each = reduceMotion ? Math.min(safeStagger, 0.02) : safeStagger;
    const retrasos = ordenEscalonado(elements.length, staggerFrom).map((n) => n * each);
    const ultimo = Math.max(0, ...retrasos);

    const pieces: Pieza[] = elements.map((element) => {
      const parts =
        safeStyle === 'blinds' ? (Array.from(element.children) as HTMLElement[]) : [element];
      if (safeStyle === 'blinds') {
        element.style.opacity = '1';
        parts.forEach((part, index) => {
          part.style.transformOrigin = slats.origins[index]!;
          if (index > 0) part.style.clipPath = slats.clips[index]!;
        });
      } else {
        element.style.transformOrigin = safeStyle === 'flip' ? '50% 50%' : origin;
        element.style.backfaceVisibility = safeStyle === 'flip' ? 'visible' : '';
      }
      return { element, parts, t: startsFolded ? 0 : 1, f: 0, r: 0, aim: 0 };
    });

    const shade = (progress: number, tilt: number) =>
      String(crease * clamp(1 - progress + tilt / 90, 0, 1));

    const render = () => {
      pieces.forEach((piece) => {
        const tilt = piece.r * refold;
        if (safeStyle === 'blinds') {
          let resting = tilt < 0.05;
          piece.parts.forEach((part, index) => {
            const offset = index * SLAT_DELAY;
            const open = unfoldEase(clamp((piece.t - offset) / (1 - SLAT_DELAY), 0, 1));
            const close = foldEase(clamp((piece.f - offset) / (1 - SLAT_DELAY), 0, 1));
            const progress = open * (1 - close);
            if (Math.abs(1 - progress) > 0.002) resting = false;
            part.style.transform = `${axis}(${sign * ((1 - progress) * angle + tilt)}deg)`;
            part.style.opacity = String(clamp(progress, 0, 1));
            part.style.setProperty('--fold-crease', shade(progress, tilt));
          });
          piece.parts[0]!.style.clipPath = resting ? 'none' : slats.clips[0]!;
          piece.parts[1]!.style.visibility = resting ? 'hidden' : 'visible';
          return;
        }
        const progress = unfoldEase(piece.t) * (1 - foldEase(piece.f));
        const rise = lift * Math.sin(Math.PI * clamp(progress, 0, 1));
        const turn = `${axis}(${sign * ((1 - progress) * angle + tilt)}deg)`;
        piece.element.style.transform = rise > 0.001 ? `translateZ(${rise}em) ${turn}` : turn;
        piece.element.style.opacity = String(clamp(progress, 0, 1));
        piece.element.style.setProperty('--fold-crease', shade(progress, tilt));
      });
    };

    // ── Línea de tiempo (equivalente a la de GSAP) ──
    let marco = 0;
    const play = (loop: boolean) => {
      cancelAnimationFrame(marco);
      const abrir = ultimo + unfoldDuration;
      const cerrar = ultimo + unfoldDuration * 0.75;
      const ciclo = abrir + safeDelay + cerrar + 0.35;
      const inicio = performance.now();
      const paso = (ahora: number) => {
        let s = (ahora - inicio) / 1000;
        if (loop) s %= ciclo;
        pieces.forEach((piece, i) => {
          piece.t = clamp((s - retrasos[i]!) / unfoldDuration, 0, 1);
          piece.f = loop
            ? clamp((s - abrir - safeDelay - retrasos[i]!) / (unfoldDuration * 0.75), 0, 1)
            : 0;
        });
        render();
        if (loop || s < abrir) marco = requestAnimationFrame(paso);
      };
      marco = requestAnimationFrame(paso);
      render();
    };

    const handleEnter = () => play(false);
    let observador: IntersectionObserver | null = null;

    if (trigger === 'hover') {
      render();
      root.addEventListener('mouseenter', handleEnter);
    } else if (trigger === 'scroll') {
      render();
      observador = new IntersectionObserver(
        (entradas) => {
          if (entradas.some((e) => e.isIntersecting)) {
            observador?.disconnect();
            handleEnter();
          }
        },
        // Equivale a «top 82%»: la parte superior entra en el 82 % superior de la pantalla.
        { rootMargin: '0px 0px -18% 0px' },
      );
      observador.observe(root);
    } else {
      play(trigger === 'loop');
    }

    // ── Repliegue al pasar el cursor ──
    let pointer: { x: number; y: number } | null = null;
    let centers: { x: number; y: number }[] | null = null;
    let measured: { width: number; height: number } | null = null;
    let relajando = 0;
    let anterior = 0;

    const measure = (box: DOMRect) => {
      centers = pieces.map((piece) => {
        const rect = piece.element.parentElement!.getBoundingClientRect();
        return {
          x: rect.left - box.left + rect.width / 2,
          y: rect.top - box.top + rect.height / 2,
        };
      });
      measured = { width: box.width, height: box.height };
    };

    const relax = (ahora: number) => {
      const step = Math.min(ahora - anterior, 64) / 1000;
      anterior = ahora;
      let moving = false;
      pieces.forEach((piece) => {
        const rate = piece.aim > piece.r ? 14 : 6;
        piece.r += (piece.aim - piece.r) * (1 - Math.exp(-rate * step));
        if (Math.abs(piece.aim - piece.r) > 0.001) moving = true;
        else piece.r = piece.aim;
      });
      render();
      relajando = moving ? requestAnimationFrame(relax) : 0;
    };

    const aim = () => {
      const box = root.getBoundingClientRect();
      const near =
        pointer &&
        pointer.x > box.left - safeRadius &&
        pointer.x < box.right + safeRadius &&
        pointer.y > box.top - safeRadius &&
        pointer.y < box.bottom + safeRadius;
      if (
        near &&
        (!centers ||
          !measured ||
          Math.abs(box.width - measured.width) + Math.abs(box.height - measured.height) > 1)
      ) {
        measure(box);
      }
      let changed = false;
      pieces.forEach((piece, index) => {
        let value = 0;
        if (near && pointer && centers) {
          const center = centers[index]!;
          const distance =
            Math.hypot(box.left + center.x - pointer.x, box.top + center.y - pointer.y) /
            safeRadius;
          if (distance < 1) value = 1 - distance * distance * (3 - 2 * distance);
        }
        if (value !== piece.aim) changed = true;
        piece.aim = value;
      });
      if (changed && !relajando) {
        anterior = performance.now();
        relajando = requestAnimationFrame(relax);
      }
    };

    const handleMove = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      aim();
    };
    const handleLeave = () => {
      pointer = null;
      aim();
    };
    const handleScroll = () => {
      if (pointer) aim();
    };

    if (refold) {
      window.addEventListener('pointermove', handleMove, { passive: true });
      window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
      document.documentElement.addEventListener('pointerleave', handleLeave);
    }

    return () => {
      root.removeEventListener('mouseenter', handleEnter);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('scroll', handleScroll, { capture: true });
      document.documentElement.removeEventListener('pointerleave', handleLeave);
      observador?.disconnect();
      cancelAnimationFrame(marco);
      cancelAnimationFrame(relajando);
    };
  }, [
    segments,
    hingeConfig,
    safeStyle,
    duration,
    safeStagger,
    staggerFrom,
    safeAngle,
    ease,
    safeCrease,
    trigger,
    safeDelay,
    hoverRefold,
    safeRadius,
    safeRefold,
    startsFolded,
    estatico,
  ]);

  const rootStyle = {
    '--fold-text-font-size': typeof fontSize === 'number' ? `${fontSize}px` : fontSize,
    '--fold-text-font-weight': fontWeight,
    '--fold-text-color': color,
    '--fold-perspective': `${Math.max(120, perspective)}px`,
    ...style,
  } as CSSProperties;

  return (
    <span ref={rootRef} className={`${estilos.foldText} ${className}`.trim()} style={rootStyle}>
      <span className={estilos.srOnly}>{text}</span>
      <span className={estilos.visual} aria-hidden="true">
        {segments}
      </span>
    </span>
  );
}
