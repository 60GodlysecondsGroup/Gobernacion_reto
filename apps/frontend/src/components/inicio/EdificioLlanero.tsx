'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import estilos from './EdificioLlanero.module.css';

/**
 * Ilustración original en pixel art (RF28): el edificio de la metáfora «Hotel → Comunidades»
 * (sección 28.1) al anochecer sobre el llano, con moriches. Cada piso es una comunidad y las
 * losas entre pisos no tienen escaleras: nadie pasa de un piso a otro (segmentación, 8.1).
 */
const PISOS = [
  { codigo: 'D', rango: '18 a 22 años', y: 34 },
  { codigo: 'C', rango: '16 a 17 años', y: 52 },
  { codigo: 'B', rango: '13 a 15 años', y: 70 },
  { codigo: 'A', rango: '10 a 12 años', y: 88 },
] as const;

type CodigoPiso = (typeof PISOS)[number]['codigo'];

// Qué ventanas están encendidas en cada piso (de izquierda a derecha).
const LUCES: Record<CodigoPiso, boolean[]> = {
  D: [true, false, true, true],
  C: [false, true, true, false],
  B: [true, true, false, true],
  A: [true, false, true, true],
};

const ESTRELLAS = [
  [12, 8],
  [30, 16],
  [44, 6],
  [70, 12],
  [118, 8],
  [132, 18],
  [148, 10],
  [24, 28],
  [140, 30],
  [96, 4],
];

function Moriche({ x, base, alto }: { x: number; base: number; alto: number }) {
  const copa = base - alto;
  return (
    <g fill="#14173d">
      <rect x={x} y={copa} width="2" height={alto} />
      <rect x={x - 6} y={copa - 1} width="14" height="2" />
      <rect x={x - 4} y={copa - 3} width="10" height="2" />
      <rect x={x - 2} y={copa - 5} width="6" height="2" />
      <rect x={x - 8} y={copa + 1} width="4" height="2" />
      <rect x={x + 6} y={copa + 1} width="4" height="2" />
      <rect x={x - 9} y={copa + 3} width="2" height="2" />
      <rect x={x + 9} y={copa + 3} width="2" height="2" />
    </g>
  );
}

export function EdificioLlanero() {
  const [piso, setPiso] = useState<CodigoPiso | null>(null);
  const reducir = useReducedMotion();
  const seleccionado = PISOS.find((p) => p.codigo === piso);

  return (
    <figure className={estilos.figura}>
      <svg
        className={estilos.lienzo}
        viewBox="0 0 160 120"
        shapeRendering="crispEdges"
        role="img"
        aria-labelledby="edificio-titulo"
      >
        <title id="edificio-titulo">
          Edificio de cuatro pisos al anochecer sobre el llano. Cada piso es una comunidad de un
          rango de edad, separada de las demás.
        </title>
        {/* Cielo en franjas, del añil de la noche al violeta del atardecer */}
        {[
          '#1e2152',
          '#262a63',
          '#30336f',
          '#3d3b7c',
          '#4c4488',
          '#5b4f9a',
          '#7a5a9e',
          '#a8669a',
        ].map((color, i) => (
          <rect key={color} x="0" y={i * 13} width="160" height="13" fill={color} />
        ))}
        {ESTRELLAS.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#e8e6ff" />
        ))}
        {/* Sol que se oculta en el horizonte */}
        <g fill="#f2a93b">
          <rect x="120" y="86" width="20" height="2" />
          <rect x="118" y="88" width="24" height="4" />
          <rect x="116" y="92" width="28" height="10" />
        </g>
        <rect x="116" y="96" width="28" height="1" fill="#e8834a" />
        <rect x="116" y="99" width="28" height="1" fill="#e8834a" />

        <Moriche x={18} base={104} alto={30} />
        <Moriche x={34} base={104} alto={20} />
        <Moriche x={130} base={104} alto={24} />
        <Moriche x={146} base={104} alto={34} />

        {/* Llano */}
        <rect x="0" y="102" width="160" height="18" fill="#1f5b40" />
        <rect x="0" y="102" width="160" height="2" fill="#2f7a57" />
        <rect x="0" y="110" width="160" height="1" fill="#22654a" />
        <rect x="0" y="116" width="160" height="1" fill="#22654a" />
        <rect x="76" y="104" width="8" height="16" fill="#c9a26a" />

        {/* Edificio */}
        <rect x="56" y="24" width="48" height="4" fill="#14173d" />
        <rect x="60" y="20" width="40" height="4" fill="#14173d" />
        <rect x="54" y="28" width="52" height="76" fill="#2c3086" />
        <rect x="54" y="28" width="3" height="76" fill="#3b3fa8" />

        {PISOS.map(({ codigo, y }) => {
          const activo = piso === codigo;
          const atenuado = piso !== null && !activo;
          return (
            <g key={codigo} className={estilos.piso} opacity={atenuado ? 0.35 : 1}>
              {/* Losa entre pisos: sin escaleras ni puertas entre comunidades */}
              <rect x="54" y={y - 2} width="52" height="2" fill="#14173d" />
              {activo && <rect x="57" y={y} width="49" height="16" fill="#3b3fa8" />}
              {LUCES[codigo].map((encendida, i) => (
                <motion.rect
                  key={i}
                  x={67 + i * 9}
                  y={y + 5}
                  width="6"
                  height="6"
                  fill={encendida || activo ? '#f2a93b' : '#1b1e55'}
                  initial={reducir ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    delay:
                      0.25 + (3 - PISOS.findIndex((p) => p.codigo === codigo)) * 0.18 + i * 0.05,
                    duration: 0.4,
                  }}
                />
              ))}
              <text
                x="59"
                y={y + 11.5}
                className={estilos.letra}
                fill={activo ? '#f2a93b' : '#e8e6ff'}
              >
                {codigo}
              </text>
            </g>
          );
        })}
        {/* Puerta: la entrada pasa siempre por la asignación de rango */}
        <rect x="76" y="96" width="8" height="8" fill="#f2a93b" />
        <rect x="79" y="96" width="2" height="8" fill="#e8834a" />
      </svg>

      <figcaption className={estilos.leyenda}>
        <p className={estilos.ayudaLeyenda} id="leyenda-pisos">
          Cuatro comunidades, una por piso. Elige un piso:
        </p>
        <div className={estilos.botones} role="group" aria-labelledby="leyenda-pisos">
          {PISOS.map(({ codigo }) => (
            <button
              key={codigo}
              type="button"
              className={estilos.botonPiso}
              aria-pressed={piso === codigo}
              onClick={() => setPiso((actual) => (actual === codigo ? null : codigo))}
            >
              {codigo}
            </button>
          ))}
        </div>
        <p className={estilos.explicacion} aria-live="polite">
          {seleccionado
            ? `Comunidad ${seleccionado.codigo}, de ${seleccionado.rango}. Quien vive en este piso solo ve sus hilos, sus salas y a las personas de su misma edad.`
            : 'Ningún piso tiene escaleras hacia otro: la separación por edad la impone el sistema, no solo la pantalla.'}
        </p>
      </figcaption>
    </figure>
  );
}
