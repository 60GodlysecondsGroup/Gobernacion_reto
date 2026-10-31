'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Cocuyo } from '@/components/guia/Cocuyo';
import estilos from './EdificioLlanero.module.css';

/**
 * Ilustración original en pixel art isométrico (RF28): el edificio de la metáfora
 * «Hotel → Comunidades» (sección 28.1) en una plaza de Villavicencio al anochecer, con chicalá,
 * ceiba, palmas de moriche y faroles. Al fondo, un edificio institucional de columnas evoca el
 * centro de la ciudad sin reproducir ninguna fachada real. Cada piso es una comunidad y las losas
 * entre pisos no tienen escaleras: nadie pasa de un piso a otro (segmentación, 8.1).
 */
const PISOS = [
  { codigo: 'D', rango: '18 a 22 años', nivel: 3, color: '#7de3c3', balcon: 'metal' },
  { codigo: 'C', rango: '16 a 17 años', nivel: 2, color: '#8fd3ff', balcon: 'madera' },
  { codigo: 'B', rango: '13 a 15 años', nivel: 1, color: '#c4bdff', balcon: 'metal' },
  { codigo: 'A', rango: '10 a 12 años', nivel: 0, color: '#ffc857', balcon: 'madera' },
] as const;

type CodigoPiso = (typeof PISOS)[number]['codigo'];

// ── Geometría isométrica (2:1) ───────────────────────────────────────────────────────
const ESQUINA = { x: 100, y: 128 }; // esquina frontal, a ras de suelo
const ANCHO_IZQ = 36;
const ANCHO_DER = 44;
const ALTO_PISO = 15;
const ALTO = ALTO_PISO * 4;

type Cara = 'izq' | 'der';
/** Punto sobre una fachada: `u` avanza por la cara desde la esquina y `v` sube. */
const punto = (cara: Cara, u: number, v: number) =>
  `${ESQUINA.x + (cara === 'der' ? u : -u)},${ESQUINA.y - u / 2 - v}`;
const cuadro = (cara: Cara, u1: number, u2: number, v1: number, v2: number) =>
  [punto(cara, u1, v1), punto(cara, u2, v1), punto(cara, u2, v2), punto(cara, u1, v2)].join(' ');

// Ventanas encendidas por piso: [derecha ×3, izquierda ×2]. Algunas parpadean muy suave.
const LUCES: Record<CodigoPiso, boolean[]> = {
  D: [true, false, true, true, false],
  C: [false, true, true, true, true],
  B: [true, true, false, false, true],
  A: [true, false, true, true, true],
};
const PARPADEAN = new Set(['D-0', 'C-3', 'B-1', 'A-2']);

const ESTRELLAS = [
  [14, 10], [36, 20], [58, 8], [84, 16], [122, 6], [150, 14], [176, 9], [190, 24], [30, 34], [168, 36],
];

// Hojas de chicalá que caen de vez en cuando (capa HTML, solo con la escena visible).
const HOJAS = [
  { x: 17, retraso: 0, duracion: 11 },
  { x: 24, retraso: 4.5, duracion: 13 },
  { x: 12, retraso: 8, duracion: 12 },
  { x: 86, retraso: 2.5, duracion: 14 },
];

/** Chicalá: árbol de flores amarillas, típico de las calles de Villavicencio. */
function Chicala({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x - 1} y={y - 18} width="3" height="18" fill="#6b4a2f" />
      <rect x={x - 4} y={y - 14} width="4" height="1" fill="#6b4a2f" />
      <rect x={x + 2} y={y - 16} width="4" height="1" fill="#6b4a2f" />
      <ellipse cx={x} cy={y} rx="9" ry="3" fill="rgb(20 30 20 / 0.35)" />
      <g className={estilos.rama} style={{ transformOrigin: `${x}px ${y - 16}px` }}>
        <rect x={x - 13} y={y - 30} width="26" height="10" fill="#d99a1e" />
        <rect x={x - 10} y={y - 34} width="20" height="6" fill="#e9b52a" />
        <rect x={x - 15} y={y - 26} width="6" height="5" fill="#e9b52a" />
        <rect x={x + 8} y={y - 28} width="7" height="6" fill="#f2c94c" />
        <rect x={x - 6} y={y - 36} width="10" height="4" fill="#f7d566" />
        <rect x={x - 8} y={y - 30} width="4" height="3" fill="#fbe38a" />
        <rect x={x + 3} y={y - 32} width="3" height="2" fill="#fbe38a" />
        <rect x={x - 2} y={y - 24} width="5" height="3" fill="#c5861a" />
        <rect x={x - 12} y={y - 22} width="5" height="2" fill="#c5861a" />
      </g>
    </g>
  );
}

/** Ceiba: tronco ancho con raíces de tabla y copa amplia y plana. */
function Ceiba({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx="16" ry="4" fill="rgb(20 30 20 / 0.35)" />
      <rect x={x - 3} y={y - 26} width="6" height="26" fill="#8c8170" />
      <rect x={x - 6} y={y - 5} width="12" height="5" fill="#7a705f" />
      <rect x={x - 8} y={y - 2} width="16" height="2" fill="#6c6252" />
      <rect x={x - 1} y={y - 22} width="1" height="16" fill="#a39886" />
      <g className={estilos.rama} style={{ transformOrigin: `${x}px ${y - 24}px`, animationDelay: '-2s' }}>
        <rect x={x - 24} y={y - 34} width="48" height="7" fill="#24553d" />
        <rect x={x - 19} y={y - 39} width="38" height="6" fill="#2f6b4b" />
        <rect x={x - 12} y={y - 42} width="22" height="4" fill="#3b7f59" />
        <rect x={x - 22} y={y - 36} width="10" height="2" fill="#3b7f59" />
        <rect x={x + 6} y={y - 38} width="12" height="2" fill="#4a9268" />
        <rect x={x - 26} y={y - 29} width="8" height="3" fill="#1d4632" />
        <rect x={x + 16} y={y - 30} width="9" height="3" fill="#1d4632" />
      </g>
    </g>
  );
}

/** Palma de moriche: tronco alto y hojas en abanico. */
function Moriche({ x, y, alto, retraso = 0 }: { x: number; y: number; alto: number; retraso?: number }) {
  const copa = y - alto;
  return (
    <g>
      <rect x={x} y={copa} width="2" height={alto} fill="#5d4a3a" />
      {Array.from({ length: Math.floor(alto / 4) }, (_, i) => (
        <rect key={i} x={x} y={copa + 2 + i * 4} width="2" height="1" fill="#4a3a2e" />
      ))}
      <g
        className={estilos.rama}
        style={{ transformOrigin: `${x + 1}px ${copa}px`, animationDelay: `${retraso}s` }}
        fill="#2d6b45"
      >
        <rect x={x - 7} y={copa - 2} width="16" height="2" />
        <rect x={x - 5} y={copa - 4} width="12" height="2" fill="#3a8455" />
        <rect x={x - 2} y={copa - 7} width="6" height="3" fill="#4a9a63" />
        <rect x={x - 10} y={copa} width="5" height="2" />
        <rect x={x + 7} y={copa} width="5" height="2" />
        <rect x={x - 12} y={copa + 2} width="3" height="2" fill="#24553d" />
        <rect x={x + 11} y={copa + 2} width="3" height="2" fill="#24553d" />
        <rect x={x - 1} y={copa - 9} width="2" height="2" fill="#5fae74" />
      </g>
    </g>
  );
}

/** Farol de la plaza con un halo de luz cálida. */
function Farol({ x, y, retraso }: { x: number; y: number; retraso: number }) {
  return (
    <g>
      <circle
        cx={x + 1}
        cy={y - 15}
        r="9"
        fill="url(#halo)"
        className={estilos.halo}
        style={{ animationDelay: `${retraso}s` }}
      />
      <rect x={x} y={y - 13} width="2" height="13" fill="#2b2547" />
      <rect x={x - 1} y={y - 1} width="4" height="1" fill="#2b2547" />
      <rect x={x - 1} y={y - 17} width="4" height="4" fill="#ffd37a" />
      <rect x={x - 2} y={y - 18} width="6" height="1" fill="#2b2547" />
      <rect x={x} y={y - 19} width="2" height="1" fill="#2b2547" />
    </g>
  );
}

/** Edificio institucional al fondo: columnas y frontón, sin reproducir una fachada concreta. */
function Institucional() {
  return (
    <g>
      <rect x="6" y="70" width="58" height="22" fill="#d9d2ea" />
      <polygon points="4,70 35,58 66,70" fill="#e8e3f3" />
      <polygon points="12,69 35,61 58,69" fill="#c9c0e0" />
      <rect x="4" y="69" width="62" height="2" fill="#bdb3d6" />
      {[10, 18, 26, 40, 48, 56].map((cx) => (
        <rect key={cx} x={cx} y="72" width="3" height="20" fill="#f1edf8" />
      ))}
      <rect x="31" y="76" width="8" height="16" fill="#5b4f8a" />
      <rect x="32" y="77" width="6" height="7" fill="#ffd37a" opacity="0.8" />
      <rect x="6" y="91" width="58" height="2" fill="#a99ec6" />
      {/* Asta con bandera morada de la plataforma (no es una bandera oficial) */}
      <rect x="35" y="44" width="1" height="15" fill="#8d85a8" />
      <rect x="36" y="44" width="8" height="5" fill="#7350ea" className={estilos.bandera} />
    </g>
  );
}

export function EdificioLlanero() {
  const [piso, setPiso] = useState<CodigoPiso | null>(null);
  const reducir = useReducedMotion();
  const seleccionado = PISOS.find((p) => p.codigo === piso);
  const escena = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  // El ambiente solo se anima mientras el edificio está en pantalla.
  useEffect(() => {
    const nodo = escena.current;
    if (!nodo || !('IntersectionObserver' in window)) return;
    const observador = new IntersectionObserver(([entrada]) =>
      setVisible(!!entrada?.isIntersecting),
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  // Cocuyo vuela hasta el piso elegido (a la altura de su fachada derecha); sin piso, sobre el techo.
  const yCocuyo = seleccionado
    ? ESQUINA.y - ANCHO_DER / 2 - (seleccionado.nivel * ALTO_PISO + ALTO_PISO / 2) - 6
    : ESQUINA.y - ANCHO_DER / 2 - ALTO - 18;
  const alturaCocuyo = (yCocuyo / 150) * 100;
  const yEtiqueta = seleccionado
    ? ((ESQUINA.y - ANCHO_DER / 2 - (seleccionado.nivel + 1) * ALTO_PISO) / 150) * 100
    : 0;

  const ventanas = (codigo: CodigoPiso, nivel: number, activo: boolean): ReactNode[] => {
    const base = nivel * ALTO_PISO;
    const huecos: [Cara, number][] = [
      ['der', 6],
      ['der', 19],
      ['der', 32],
      ['izq', 9],
      ['izq', 23],
    ];
    return huecos.map(([cara, u], i) => {
      const encendida = LUCES[codigo][i] || activo;
      return (
        <motion.polygon
          key={`${cara}-${u}`}
          points={cuadro(cara, u, u + 6, base + 5, base + 12)}
          fill={encendida ? (cara === 'der' ? '#ffcf6b' : '#ffdc8a') : '#2a2758'}
          className={encendida && PARPADEAN.has(`${codigo}-${i}`) ? estilos.parpadeo : undefined}
          // El estado inicial es igual en servidor y cliente (sin desajustes de hidratación).
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reducir ? { duration: 0 } : { delay: 0.3 + (3 - nivel) * 0.16 + i * 0.05, duration: 0.4 }}
        />
      );
    });
  };

  return (
    <figure className={estilos.figura}>
      <div
        ref={escena}
        className={estilos.escena}
        data-pausa={!visible || undefined}
        data-piso={piso ?? undefined}
      >
        <svg
          className={estilos.lienzo}
          viewBox="0 0 200 150"
          shapeRendering="crispEdges"
          role="img"
          aria-labelledby="edificio-titulo"
        >
          <title id="edificio-titulo">
            Edificio de cuatro pisos en una plaza de Villavicencio al anochecer, rodeado de un
            chicalá florecido, una ceiba, palmas de moriche y faroles. Cada piso es una comunidad
            de un rango de edad, separada de las demás.
          </title>
          <defs>
            <radialGradient id="halo">
              <stop offset="0%" stopColor="#ffd37a" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#ffd37a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="horizonte" cx="50%" cy="100%" r="70%">
              <stop offset="0%" stopColor="#f2a24b" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#f2a24b" stopOpacity="0" />
            </radialGradient>
            {/* Ladrillo: la trama se inclina con cada fachada isométrica */}
            <pattern id="ladrilloDer" width="6" height="4" patternUnits="userSpaceOnUse" patternTransform="skewY(-26.565)">
              <rect width="6" height="0.6" y="3.4" fill="rgb(70 25 10 / 0.28)" />
              <rect width="0.6" height="2" x="0" y="0" fill="rgb(70 25 10 / 0.22)" />
              <rect width="0.6" height="2" x="3" y="2" fill="rgb(70 25 10 / 0.22)" />
            </pattern>
            <pattern id="ladrilloIzq" width="6" height="4" patternUnits="userSpaceOnUse" patternTransform="skewY(26.565)">
              <rect width="6" height="0.6" y="3.4" fill="rgb(70 25 10 / 0.22)" />
              <rect width="0.6" height="2" x="0" y="0" fill="rgb(70 25 10 / 0.18)" />
              <rect width="0.6" height="2" x="3" y="2" fill="rgb(70 25 10 / 0.18)" />
            </pattern>
          </defs>

          {/* Cielo del atardecer llanero */}
          {['#1e1b4f', '#26215e', '#30296c', '#3c3179', '#4a3884', '#5c3f8c', '#7a4a8e', '#9b578a', '#bd6a7f'].map(
            (color, i) => (
              <rect key={color} x="0" y={i * 11} width="200" height="11" fill={color} />
            ),
          )}
          <rect x="0" y="60" width="200" height="40" fill="url(#horizonte)" />
          {ESTRELLAS.map(([x, y], i) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="1"
              height="1"
              fill="#e8e6ff"
              className={i % 3 === 0 ? estilos.estrella : undefined}
              style={{ animationDelay: `${i * 0.7}s` }}
            />
          ))}

          {/* Fondo: edificio institucional y palmas lejanas */}
          <Institucional />
          <Moriche x={74} y={92} alto={22} retraso={-1} />
          <Moriche x={186} y={96} alto={30} retraso={-3} />

          {/* Suelo: prado y plaza adoquinada en rombo */}
          <rect x="0" y="92" width="200" height="58" fill="#1f5b40" />
          <rect x="0" y="92" width="200" height="2" fill="#2f7a57" />
          <polygon points="100,98 186,141 100,184 14,141" fill="#c9b79a" />
          <polygon points="100,98 186,141 100,184 14,141" fill="none" stroke="#b09d80" strokeWidth="1" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <g key={i} stroke="#b8a586" strokeWidth="0.5" opacity="0.7">
              <line x1={100 - 86 + i * 12.3} y1={141 - i * 6.15} x2={100 + i * 12.3} y2={184 - i * 6.15} />
              <line x1={100 + 86 - i * 12.3} y1={141 - i * 6.15} x2={100 - i * 12.3} y2={184 - i * 6.15} />
            </g>
          ))}

          {/* Sombra del edificio sobre la plaza */}
          <polygon
            points={`${ESQUINA.x + ANCHO_DER},${ESQUINA.y - ANCHO_DER / 2} ${ESQUINA.x},${ESQUINA.y} ${ESQUINA.x + 22},${ESQUINA.y + 11} ${ESQUINA.x + ANCHO_DER + 22},${ESQUINA.y - ANCHO_DER / 2 + 11}`}
            fill="rgb(30 20 50 / 0.25)"
          />

          <Ceiba x={170} y={118} />

          {/* ── Edificio ── */}
          {/* Fachada izquierda (iluminada por el atardecer) y derecha (en sombra) */}
          <polygon points={cuadro('izq', 0, ANCHO_IZQ, 0, ALTO)} fill="#cf8457" />
          <polygon points={cuadro('izq', 0, ANCHO_IZQ, 0, ALTO)} fill="url(#ladrilloIzq)" />
          <polygon points={cuadro('der', 0, ANCHO_DER, 0, ALTO)} fill="#a95e3e" />
          <polygon points={cuadro('der', 0, ANCHO_DER, 0, ALTO)} fill="url(#ladrilloDer)" />
          {/* Arista de la esquina */}
          <polygon points={cuadro('der', 0, 1, 0, ALTO)} fill="#e09b6b" />
          {/* Zócalo de piedra */}
          <polygon points={cuadro('izq', 0, ANCHO_IZQ, 0, 3)} fill="#7d6f63" />
          <polygon points={cuadro('der', 0, ANCHO_DER, 0, 3)} fill="#655a50" />

          {/* Pisos: losas, marcos con el color de cada comunidad, ventanas y balcones */}
          {PISOS.map(({ codigo, nivel, color, balcon }) => {
            const activo = piso === codigo;
            const atenuado = piso !== null && !activo;
            const base = nivel * ALTO_PISO;
            const madera = balcon === 'madera';
            return (
              <g key={codigo} className={estilos.piso} opacity={atenuado ? 0.45 : 1}>
                {nivel > 0 && (
                  <>
                    <polygon points={cuadro('izq', 0, ANCHO_IZQ, base - 0.5, base + 1)} fill="#6e3d2a" />
                    <polygon points={cuadro('der', 0, ANCHO_DER, base - 0.5, base + 1)} fill="#5a3121" />
                  </>
                )}
                {activo && (
                  <>
                    <polygon points={cuadro('izq', 0, ANCHO_IZQ, base, base + ALTO_PISO)} className={estilos.resplandor} />
                    <polygon points={cuadro('der', 0, ANCHO_DER, base, base + ALTO_PISO)} className={estilos.resplandor} />
                  </>
                )}
                {/* Franja de color de la comunidad junto a la esquina */}
                <polygon points={cuadro('izq', 1, 3, base + 2, base + ALTO_PISO - 2)} fill={color} />
                {/* Marcos de ventana */}
                {[
                  ['der', 6], ['der', 19], ['der', 32], ['izq', 9], ['izq', 23],
                ].map(([cara, u]) => (
                  <polygon
                    key={`m-${cara}-${u}`}
                    points={cuadro(cara as Cara, (u as number) - 1, (u as number) + 7, base + 4, base + 13)}
                    fill={activo ? color : '#3a2a3e'}
                  />
                ))}
                {ventanas(codigo, nivel, activo)}
                {/* Balcón en la fachada derecha (madera o metal según el piso) */}
                {nivel > 0 && (
                  <>
                    <polygon points={cuadro('der', 4, 40, base + 3, base + 4.5)} fill={madera ? '#8a5f38' : '#4c4f72'} />
                    <polygon points={cuadro('der', 4, 40, base + 7, base + 7.8)} fill={madera ? '#b07c48' : '#7d82ad'} />
                    {Array.from({ length: 10 }, (_, k) => (
                      <polygon
                        key={k}
                        points={cuadro('der', 5 + k * 3.8, 5.6 + k * 3.8, base + 4.5, base + 7)}
                        fill={madera ? '#9a6b3d' : '#6a6f98'}
                      />
                    ))}
                  </>
                )}
                {/* Letra del piso */}
                <text
                  x={ESQUINA.x - 7}
                  y={ESQUINA.y - 3.5 - base - 4}
                  className={estilos.letra}
                  fill={activo ? '#fff3c4' : '#fff'}
                  stroke="#3a1f18"
                  strokeWidth="0.6"
                  paintOrder="stroke"
                >
                  {codigo}
                </text>
              </g>
            );
          })}

          {/* Entrada: puerta, marquesina morada y escalones */}
          <polygon points={cuadro('der', 16, 30, 0, 11)} fill="#4a2f22" />
          <polygon points={cuadro('der', 17, 22.5, 0, 10)} fill="#6b4630" />
          <polygon points={cuadro('der', 23.5, 29, 0, 10)} fill="#6b4630" />
          <polygon points={cuadro('der', 18, 21.5, 5, 9)} fill="#ffd37a" opacity="0.85" />
          <polygon points={cuadro('der', 24.5, 28, 5, 9)} fill="#ffd37a" opacity="0.85" />
          <polygon points={cuadro('der', 14, 32, 11, 13)} fill="#5b35d5" />
          <polygon points={cuadro('der', 14, 32, 13, 13.8)} fill="#7350ea" />
          <polygon
            points={`${punto('der', 16, 0)} ${punto('der', 30, 0)} ${ESQUINA.x + 34},${ESQUINA.y - 15 + 3} ${ESQUINA.x + 20},${ESQUINA.y - 8 + 3}`}
            fill="#a8998a"
          />
          {/* Mural en la planta baja izquierda */}
          <polygon points={cuadro('izq', 6, 30, 3.5, 10.5)} fill="#3d2d6b" />
          <polygon points={cuadro('izq', 8, 14, 5, 9)} fill="#ffc857" />
          <polygon points={cuadro('izq', 16, 22, 5, 9)} fill="#7de3c3" />
          <polygon points={cuadro('izq', 24, 28, 5, 9)} fill="#c4bdff" />

          {/* Techo: terraza con jardín, tanque y antena */}
          <polygon
            points={`${punto('izq', ANCHO_IZQ, ALTO)} ${punto('izq', 0, ALTO)} ${punto('der', ANCHO_DER, ALTO)} ${ESQUINA.x + ANCHO_DER - ANCHO_IZQ},${ESQUINA.y - ANCHO_DER / 2 - ANCHO_IZQ / 2 - ALTO}`}
            fill="#6e4232"
          />
          <polygon points={cuadro('izq', 0, ANCHO_IZQ, ALTO, ALTO + 2.5)} fill="#e09b6b" />
          <polygon points={cuadro('der', 0, ANCHO_DER, ALTO, ALTO + 2.5)} fill="#c27a52" />
          <rect x="112" y="47" width="10" height="9" fill="#9aa3c7" />
          <rect x="112" y="45" width="10" height="3" fill="#b9c0de" />
          <rect x="114" y="56" width="1" height="3" fill="#5c6284" />
          <rect x="119" y="56" width="1" height="3" fill="#5c6284" />
          <rect x="94" y="54" width="9" height="4" fill="#3b7f59" />
          <rect x="95" y="51" width="3" height="3" fill="#57a565" />
          <rect x="99" y="52" width="3" height="2" fill="#e05a7a" />
          <rect x="130" y="40" width="1" height="13" fill="#3a3352" />
          <rect x="128" y="41" width="5" height="1" fill="#3a3352" />
          <rect x="130" y="39" width="1" height="1" fill="#ff6b6b" className={estilos.parpadeo} />

          {/* Primer plano: chicalá, palma, faroles y matas de heliconia */}
          <Moriche x={152} y={140} alto={34} retraso={-2} />
          <Farol x={70} y={130} retraso={0} />
          <Farol x={134} y={136} retraso={-1.5} />
          <Chicala x={22} y={134} />
          <g>
            <rect x="52" y="138" width="8" height="4" fill="#2f7a57" />
            <rect x="53" y="135" width="2" height="3" fill="#e2582f" />
            <rect x="57" y="134" width="2" height="4" fill="#f2a93b" />
            <rect x="164" y="132" width="9" height="4" fill="#2f7a57" />
            <rect x="166" y="129" width="2" height="3" fill="#e2582f" />
          </g>
        </svg>

        <span className={estilos.hojas} aria-hidden="true">
          {HOJAS.map((h, i) => (
            <i
              key={i}
              style={{
                left: `${(h.x / 200) * 100}%`,
                animationDelay: `${h.retraso}s`,
                animationDuration: `${h.duracion}s`,
              }}
            />
          ))}
        </span>

        {seleccionado && (
          <span
            key={seleccionado.codigo}
            className={estilos.etiquetaPiso}
            style={{
              top: `${yEtiqueta}%`,
              ['--color-piso' as string]: seleccionado.color,
            }}
            aria-hidden="true"
          >
            Piso {seleccionado.codigo} · {seleccionado.rango}
          </span>
        )}
        <span
          className={estilos.cocuyo}
          style={{ transform: `translate(-50%, ${alturaCocuyo}%)` }}
          aria-hidden="true"
        >
          <span className={estilos.cocuyoVuelo}>
            <Cocuyo tamano={22} />
          </span>
        </span>
      </div>

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
