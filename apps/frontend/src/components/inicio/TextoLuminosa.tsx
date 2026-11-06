'use client';

import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
} from 'motion/react';
import { useRef, useState, type PointerEvent } from 'react';
import { useTextoEstatico } from '@/lib/hooks/useTextoEstatico';
import estilos from './TextoLuminosa.module.css';

const contenedor = {
  visible: {
    transition: { staggerChildren: 0.035 },
  },
};

const palabra = {
  hidden: { opacity: 0, y: 8, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.36 },
  },
};

export function TextoLuminosa({ texto, className }: { texto: string; className: string }) {
  const reducirMovimiento = useReducedMotion() ?? false;
  // Móvil: las palabras no entran animadas (spans simples); la luz al tocar se conserva.
  const estatico = useTextoEstatico();
  const [animacionCompleta, setAnimacionCompleta] = useState(false);
  const entradaCompleta = reducirMovimiento || estatico || animacionCompleta;
  const elemento = useRef<HTMLParagraphElement>(null);
  const x = useMotionValue(50);
  const y = useMotionValue(50);
  const opacidad = useMotionValue(0);
  const xSuave = useSpring(x, { stiffness: 220, damping: 30, mass: 0.35 });
  const ySuave = useSpring(y, { stiffness: 220, damping: 30, mass: 0.35 });
  const opacidadSuave = useSpring(opacidad, { stiffness: 240, damping: 32 });
  const luzX = reducirMovimiento ? x : xSuave;
  const luzY = reducirMovimiento ? y : ySuave;
  const intensidad = reducirMovimiento ? opacidad : opacidadSuave;

  useMotionValueEvent(luzX, 'change', (valor) => {
    elemento.current?.style.setProperty('--luz-x', `${valor}%`);
  });
  useMotionValueEvent(luzY, 'change', (valor) => {
    elemento.current?.style.setProperty('--luz-y', `${valor}%`);
  });
  useMotionValueEvent(intensidad, 'change', (valor) => {
    elemento.current?.style.setProperty('--luz-opacidad', `${valor}`);
  });

  const seguirPuntero = (evento: PointerEvent<HTMLParagraphElement>) => {
    if (!entradaCompleta) return;
    const caja = evento.currentTarget.getBoundingClientRect();
    x.set(caja.width ? ((evento.clientX - caja.left) / caja.width) * 100 : 50);
    y.set(caja.height ? ((evento.clientY - caja.top) / caja.height) * 100 : 50);
    opacidad.set(1);
  };

  const apagarLuz = () => opacidad.set(0);

  return (
    <motion.p
      ref={elemento}
      className={`${estilos.texto} ${className}`}
      variants={contenedor}
      initial={reducirMovimiento ? 'visible' : 'hidden'}
      animate="visible"
      onAnimationComplete={() => setAnimacionCompleta(true)}
      onPointerMove={seguirPuntero}
      onPointerDown={(evento) => {
        if (evento.pointerType === 'touch' && entradaCompleta) {
          seguirPuntero(evento);
        }
      }}
      onPointerUp={(evento) => {
        if (evento.pointerType === 'touch') apagarLuz();
      }}
      onPointerCancel={apagarLuz}
      onPointerLeave={apagarLuz}
      data-luminosa={entradaCompleta || undefined}
      data-texto={texto}
    >
      {texto.split(/(\s+)/u).map((parte, indice) =>
        /^\s+$/u.test(parte) ? (
          parte
        ) : estatico ? (
          <span key={indice} className={estilos.palabra}>
            {parte}
          </span>
        ) : (
          <motion.span key={indice} variants={palabra} className={estilos.palabra}>
            {parte}
          </motion.span>
        ),
      )}
    </motion.p>
  );
}
