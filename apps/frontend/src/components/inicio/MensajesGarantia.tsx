'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import estilos from './MensajesGarantia.module.css';

const POSICIONES = [0, 1, 2] as const;
const PAUSA = 3400;
const MENSAJES_POR_POSICION = [
  [
    'Participas con alias, sin datos personales',
    'Comunidades separadas por rangos de edad',
    'Encuentra orientación cuando la necesites',
  ],
  [
    'Cada fuente indica cuándo se verificó',
    'Comparte experiencias y escucha otras voces',
    'Explora recursos y canales de ayuda',
  ],
  [
    'Gratis y sin anuncios',
    'Explora salas y actividades interactivas',
    'Un espacio para aprender, conectar y crecer',
  ],
] as const;

function contarLetras(texto: string) {
  const cantidades = new Map<string, number>();

  return Array.from(texto, (letra) => {
    if (letra === ' ') return { letra, clave: null };
    const repeticion = cantidades.get(letra) ?? 0;
    cantidades.set(letra, repeticion + 1);
    return { letra, clave: `${letra}-${repeticion}` };
  });
}

function MensajeGarantia({
  posicion,
  indice,
}: {
  posicion: (typeof POSICIONES)[number];
  indice: number;
}) {
  const reducirMovimiento = useReducedMotion() ?? false;
  const mensajes = MENSAJES_POR_POSICION[posicion];
  const mensaje = mensajes[indice]!;
  const letras = contarLetras(mensaje);

  return (
    <li>
      <Check aria-hidden="true" size={15} strokeWidth={2.6} />
      <span className={estilos.texto}>
        <span className={estilos.medida} aria-hidden="true">
          {mensajes.reduce(
            (masLargo, actual) => (actual.length > masLargo.length ? actual : masLargo),
            mensajes[0],
          )}
        </span>
        <span className={estilos.mensaje} aria-hidden="true">
          <AnimatePresence initial={false} mode="popLayout">
            {letras.map(({ letra, clave }, indiceLetra) =>
              clave === null ? (
                <span key={`espacio-${indiceLetra}`}> </span>
              ) : (
                <motion.span
                  key={clave}
                  className={estilos.letra}
                  layout="position"
                  initial={reducirMovimiento ? false : { opacity: 0, y: 7, filter: 'blur(3px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={
                    reducirMovimiento ? { opacity: 0 } : { opacity: 0, y: -7, filter: 'blur(3px)' }
                  }
                  transition={{
                    layout: {
                      duration: reducirMovimiento ? 0 : 0.65,
                      ease: [0.22, 1, 0.36, 1],
                    },
                    duration: reducirMovimiento ? 0 : 0.28,
                  }}
                >
                  {letra}
                </motion.span>
              ),
            )}
          </AnimatePresence>
        </span>
        <span className="visualmente-oculto" aria-live="polite" aria-atomic="true">
          {mensaje}
        </span>
      </span>
    </li>
  );
}

export function MensajesGarantia({ className }: { className: string }) {
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    const temporizador = window.setInterval(() => setIndice((actual) => (actual + 1) % 3), PAUSA);
    return () => window.clearInterval(temporizador);
  }, []);

  return (
    <ul className={className}>
      {POSICIONES.map((posicion) => (
        <MensajeGarantia key={posicion} posicion={posicion} indice={indice} />
      ))}
    </ul>
  );
}
