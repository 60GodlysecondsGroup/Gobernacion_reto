'use client';

import { useEffect, useRef, useState, type ComponentProps, type PointerEvent } from 'react';
import estilos from './Joystick.module.css';

/** Posición de la palanca: cada eje entre -1 y 1 (la `y` crece hacia abajo) y longitud ≤ 1. */
export type PosicionJoystick = { x: number; y: number };

type Arrastre = { id: number; centroX: number; centroY: number; radio: number };

/**
 * Joystick virtual: una base y una palanca que sigue al dedo mientras se mantiene pulsada.
 * Funciona con Pointer Events, así que sirve igual con el dedo, un lápiz o el ratón. Solo
 * informa la posición analógica: qué significa (moverse, apuntar…) lo decide quien lo usa.
 * El tamaño sale del CSS (`--tamano-joystick`), así se adapta a cada distribución.
 */
export function Joystick({
  etiqueta,
  alMover,
  alSoltar,
  className,
  ...resto
}: Omit<ComponentProps<'div'>, 'children'> & {
  /** Nombre accesible del control. */
  etiqueta: string;
  alMover: (posicion: PosicionJoystick) => void;
  alSoltar: () => void;
}) {
  const palanca = useRef<HTMLSpanElement>(null);
  const arrastre = useRef<Arrastre | null>(null);
  const soltar = useRef(alSoltar);
  const [activo, setActivo] = useState(false);

  useEffect(() => {
    soltar.current = alSoltar;
  });

  // Si el control desaparece con la palanca empujada, la intención no queda pegada.
  useEffect(
    () => () => {
      if (arrastre.current) soltar.current();
    },
    [],
  );

  const colocar = (x: number, y: number) =>
    palanca.current?.style.setProperty('--desplazamiento', `${x}px, ${y}px`);

  const seguir = (evento: PointerEvent<HTMLDivElement>) => {
    const actual = arrastre.current;
    if (!actual || evento.pointerId !== actual.id) return;
    let x = evento.clientX - actual.centroX;
    let y = evento.clientY - actual.centroY;
    const distancia = Math.hypot(x, y);
    if (distancia > actual.radio) {
      x *= actual.radio / distancia;
      y *= actual.radio / distancia;
    }
    colocar(x, y);
    alMover({ x: x / actual.radio, y: y / actual.radio });
  };

  const empezar = (evento: PointerEvent<HTMLDivElement>) => {
    // Un solo dedo a la vez; con el ratón, solo el botón principal.
    if (arrastre.current || evento.button !== 0) return;
    // Sin selección de texto, menú contextual ni desplazamiento de la página.
    evento.preventDefault();
    const base = evento.currentTarget;
    const caja = base.getBoundingClientRect();
    const radio = Math.max(1, (caja.width - (palanca.current?.offsetWidth ?? 0)) / 2);
    // Con la captura, el dedo puede salirse de la base sin soltar la palanca. Falla si el
    // puntero ya no está activo (un toque muy breve): entonces sigue solo mientras esté encima.
    try {
      base.setPointerCapture(evento.pointerId);
    } catch {
      // Sin captura.
    }
    arrastre.current = {
      id: evento.pointerId,
      centroX: caja.left + caja.width / 2,
      centroY: caja.top + caja.height / 2,
      radio,
    };
    setActivo(true);
    seguir(evento);
  };

  const terminar = (evento: PointerEvent<HTMLDivElement>) => {
    if (arrastre.current?.id !== evento.pointerId) return;
    arrastre.current = null;
    colocar(0, 0);
    setActivo(false);
    alSoltar();
  };

  return (
    <div
      {...resto}
      role="group"
      aria-roledescription="joystick"
      aria-label={etiqueta}
      className={[estilos.base, className].filter(Boolean).join(' ')}
      data-activo={activo || undefined}
      onPointerDown={empezar}
      onPointerMove={seguir}
      onPointerUp={terminar}
      onPointerCancel={terminar}
      onLostPointerCapture={terminar}
      onContextMenu={(evento) => evento.preventDefault()}
    >
      <span className={estilos.guias} aria-hidden="true" />
      <span ref={palanca} className={estilos.palanca} aria-hidden="true" />
    </div>
  );
}
