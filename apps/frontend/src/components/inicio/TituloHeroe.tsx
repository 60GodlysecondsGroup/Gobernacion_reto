'use client';

import { useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import ShinyText from '@/components/react-bits/ShinyText';
import TextType from '@/components/react-bits/TextType';
import { useTextoEstatico } from '@/lib/hooks/useTextoEstatico';
import estilos from '@/app/page.module.css';

const INICIO = 'Un espacio para ';
const RESALTE = 'crecer, conectar y compartir';
const FINAL = ' en Villavicencio';
const TRAMOS = [INICIO, RESALTE, FINAL];

const VELOCIDAD = 45; // ms por letra
const ESPERA_INICIAL = 350; // ms antes de la primera letra
const HOLGURA = 80; // ms de margen al pasar de un tramo al siguiente

/** Resalte con brillo (ShinyText), con los colores del tema. */
const Resalte = () => (
  <ShinyText
    text={RESALTE}
    color="var(--brillo-base)"
    shineColor="var(--brillo-luz)"
    speed={3.2}
    spread={110}
    className={estilos.resalteBrillo}
  />
);

/**
 * Título del héroe: «Un espacio para crecer, conectar y compartir en Villavicencio», escrito
 * UNA sola vez (TextType con `loop={false}`) y luego estático. Se escribe en tres tramos
 * encadenados para que «crecer, conectar y compartir» salga ya en morado y, al terminar, pase a
 * ShinyText sin cambio de color. Solo el tramo que se escribe lleva cursor; al final no queda.
 * La frase completa se reserva invisible en la misma celda (el alto no cambia mientras escribe)
 * y los lectores de pantalla leen la etiqueta del título, no cada letra. En móvil se muestra
 * terminado (sin escritura ni temporizadores); el CSS enseña la reserva desde el primer pintado.
 */
export function TituloHeroe() {
  const reducir = useReducedMotion();
  const estatico = useTextoEstatico();
  // Tramo que se está escribiendo (0–2); 3 = terminado.
  const [fase, setFase] = useState(0);
  const terminado = reducir || estatico || fase >= TRAMOS.length;

  useEffect(() => {
    if (terminado) return;
    const espera = (fase === 0 ? ESPERA_INICIAL : 0) + TRAMOS[fase].length * VELOCIDAD + HOLGURA;
    const temporizador = setTimeout(() => setFase((f) => f + 1), espera);
    return () => clearTimeout(temporizador);
  }, [fase, terminado]);

  const tramo = (indice: number) => {
    if (terminado || indice < fase) return indice === 1 ? <Resalte key={indice} /> : TRAMOS[indice];
    if (indice > fase) return null;
    return (
      <TextType
        key={indice}
        as="span"
        // En línea (no inline-block): el texto corta las líneas igual que la versión final.
        style={{ display: 'inline' }}
        text={TRAMOS[indice]}
        loop={false}
        typingSpeed={VELOCIDAD}
        initialDelay={indice === 0 ? ESPERA_INICIAL : 0}
        textColors={indice === 1 ? ['var(--brillo-base)'] : []}
        cursorCharacter="▎"
        cursorClassName={estilos.cursor}
        cursorBlinkDuration={0.55}
      />
    );
  };

  return (
    <h1
      id="titulo-inicio"
      className={`${estilos.titulo} ${estilos.escritura}`}
      aria-label={`${INICIO}${RESALTE}${FINAL}`}
    >
      <span className={estilos.reserva} aria-hidden="true">
        {INICIO}
        <Resalte />
        {FINAL}
      </span>
      <span className={estilos.frase} aria-hidden="true">
        {TRAMOS.map((_, i) => tramo(i))}
      </span>
    </h1>
  );
}
