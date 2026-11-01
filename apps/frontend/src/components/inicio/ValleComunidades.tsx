'use client';

import { Flower2, Leaf, RotateCcw, Snowflake, Sun, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Cocuyo } from '@/components/guia/Cocuyo';
import {
  COMUNIDADES,
  TEMPORADAS,
  type CodigoComunidad,
  type Comunidad,
  type Temporada,
} from '@/config/comunidades';
import estilos from './ValleComunidades.module.css';

/**
 * Ilustración original en pixel art (RF28), inspirada en los juegos de granja: un valle con cuatro
 * casas de campo iguales, una junto a otra sobre el mismo camino. Cada casa es una comunidad y
 * tiene su propia estación del año; nadie está «encima» de nadie. Las cercas entre los patios
 * recuerdan que cada quien entra solo por la puerta de su edad (segmentación, 8.1).
 *
 * Al elegir una casa (con el cursor en escritorio, con un toque en pantallas táctiles), su
 * estación se extiende por todo el valle empezando por las casas vecinas.
 */

// ── Geometría (unidades del viewBox) ─────────────────────────────────────────────────
const ANCHO = 256;
const ALTO = 160;
const ZONA = ANCHO / COMUNIDADES.length;
const BASE_CASA = 104;
const centro = (indice: number) => ZONA * indice + ZONA / 2;

/** Tejado de cada casa en un tono más profundo del color de su comunidad. */
const TEJADOS: Record<CodigoComunidad, { tejado: string; sombra: string; cumbrera: string }> = {
  A: { tejado: '#d9822b', sombra: '#a95f1c', cumbrera: '#eea54d' },
  B: { tejado: '#8d72d6', sombra: '#6a51b3', cumbrera: '#ab95e8' },
  C: { tejado: '#3f8fcf', sombra: '#2b6ea6', cumbrera: '#6fb2e6' },
  D: { tejado: '#2e9c7a', sombra: '#1f775c', cumbrera: '#55bb98' },
};

const ICONOS: Record<Temporada, LucideIcon> = {
  invierno: Snowflake,
  primavera: Flower2,
  verano: Sun,
  otono: Leaf,
};

// Bosque lejano (desplazamiento dentro de la zona y altura), matas de hierba y puntos donde cada
// estación deja su huella (flores, hierba alta, hojarasca o nieve). Igual en las cuatro zonas.
const BOSQUE = [
  [5, 0],
  [14, 1],
  [23, -1],
  [32, 1],
  [41, 0],
  [50, -1],
  [59, 1],
] as const;
const MATAS = [
  [-30, 100],
  [18, 108],
  [-12, 119],
  [26, 120],
  [-27, 157],
  [8, 157],
  [20, 158],
] as const;
const HUELLAS = [
  [-29, 122],
  [-24, 128],
  [-30, 135],
  [-23, 141],
  [21, 124],
  [26, 130],
  [22, 137],
  [28, 142],
  [-30, 108],
  [14, 107],
  [-14, 157],
  [16, 156],
] as const;
const FLORES = ['#f58fb8', '#fff1a8', '#ffffff'];
const HOJARASCA = ['#e2582f', '#f2a93b', '#b9481f'];

// Colinas escalonadas al fondo (alto del perfil cada 8 unidades).
const PERFIL_COLINAS = [
  56, 54, 52, 52, 53, 55, 57, 58, 57, 55, 53, 51, 50, 50, 51, 53, 55, 56, 55, 53, 52, 52, 53, 55,
  57, 58, 58, 57, 55, 54, 54, 55, 56,
];
const COLINAS = [
  `0,70`,
  ...PERFIL_COLINAS.slice(0, -1).flatMap((alto, k) => [`${k * 8},${alto}`, `${k * 8 + 8},${alto}`]),
  `${ANCHO},70`,
].join(' ');

const NUBES = [
  { y: 10, retraso: 0, escala: 1 },
  { y: 26, retraso: -32, escala: 0.8 },
  { y: 17, retraso: -64, escala: 0.9 },
];

// Partículas de cada zona: nieve, pétalos, hojas o luciérnagas según su estación.
const PARTICULAS = [
  { dx: 4, retraso: 0, duracion: 9 },
  { dx: 10, retraso: 3.4, duracion: 11 },
  { dx: 16, retraso: 1.7, duracion: 10 },
  { dx: 21, retraso: 5.2, duracion: 12 },
];

/** Relleno u opacidad que toman su valor de la estación del grupo (variables CSS por `data-t`). */
const pinta = (variable: string): CSSProperties => ({ fill: `var(--${variable})` });
const capa = (variable: string): CSSProperties => ({ opacity: `var(--${variable})` });

type EstadoZona = { temporada: Temporada; distancia: number };

/**
 * Degradado horizontal que recorre el valle: cada casa aporta dos paradas con el color de su
 * estación y el tramo entre dos casas mezcla una estación con la siguiente.
 */
function Degradado({
  id,
  color,
  opacidad,
  zonas,
}: {
  id: string;
  color: string;
  opacidad?: string;
  zonas: EstadoZona[];
}) {
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={ANCHO} y2="0">
      {zonas.flatMap(({ temporada, distancia }, i) =>
        [ZONA * i + 14, ZONA * (i + 1) - 14].map((x) => (
          <stop
            key={x}
            offset={x / ANCHO}
            data-t={temporada}
            className={estilos.parada}
            style={{
              stopColor: color,
              stopOpacity: opacidad,
              ['--distancia' as string]: String(distancia),
            }}
          />
        )),
      )}
    </linearGradient>
  );
}

function ArbolLejano({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y - 1} width="1" height="2" fill="#6b4a2f" />
      <rect x={x - 3} y={y - 6} width="7" height="5" style={pinta('bosque')} />
      <rect x={x - 2} y={y - 8} width="5" height="2" style={pinta('bosque')} />
      <rect x={x - 3} y={y - 2} width="7" height="1" fill="rgb(20 30 30 / 0.18)" />
      <rect x={x - 2} y={y - 8} width="5" height="1" fill="#f5f9fd" style={capa('nieve-op')} />
    </g>
  );
}

/** Árbol del patio: en invierno pierde la copa y quedan las ramas con nieve. */
function Arbol({ x, b }: { x: number; b: number }) {
  return (
    <g>
      <ellipse cx={x + 1} cy={b} rx="10" ry="2.5" fill="rgb(30 40 20 / 0.18)" />
      <rect x={x - 2} y={b - 15} width="4" height="15" fill="#7a5235" />
      <rect x={x + 1} y={b - 15} width="1" height="15" fill="#5e3e27" />
      <g fill="#6b4a2f">
        <rect x={x - 1} y={b - 27} width="2" height="12" />
        <rect x={x - 7} y={b - 21} width="6" height="1.5" />
        <rect x={x + 1} y={b - 23} width="6" height="1.5" />
        <rect x={x - 8} y={b - 25} width="1.5" height="4" />
        <rect x={x + 6} y={b - 27} width="1.5" height="4" />
      </g>
      <g fill="#f5f9fd" style={capa('nieve-op')}>
        <rect x={x - 7} y={b - 22} width="6" height="1" />
        <rect x={x + 1} y={b - 24} width="6" height="1" />
        <rect x={x - 8} y={b - 26} width="1.5" height="1" />
        <rect x={x + 6} y={b - 28} width="1.5" height="1" />
        <rect x={x - 1} y={b - 28} width="2" height="1" />
      </g>
      <g
        className={estilos.rama}
        style={{ ...capa('copa-op'), transformOrigin: `${x}px ${b - 14}px` }}
      >
        <rect x={x - 12} y={b - 22} width="24" height="5" style={pinta('copa-sombra')} />
        <rect x={x - 11} y={b - 30} width="22" height="9" style={pinta('copa')} />
        <rect x={x - 8} y={b - 33} width="16" height="3" style={pinta('copa')} />
        <rect x={x - 5} y={b - 35} width="10" height="2" style={pinta('copa')} />
        <rect x={x - 7} y={b - 31} width="6" height="2" style={pinta('copa-luz')} />
        <rect x={x - 4} y={b - 34} width="5" height="1" style={pinta('copa-luz')} />
        <rect x={x + 3} y={b - 29} width="4" height="2" style={pinta('copa-luz')} />
        <rect x={x - 9} y={b - 26} width="2" height="2" style={pinta('copa-detalle')} />
        <rect x={x + 5} y={b - 25} width="2" height="2" style={pinta('copa-detalle')} />
        <rect x={x - 2} y={b - 28} width="2" height="2" style={pinta('copa-detalle')} />
        <rect x={x + 7} y={b - 31} width="2" height="1" style={pinta('copa-detalle')} />
      </g>
    </g>
  );
}

function Arbusto({ x, b }: { x: number; b: number }) {
  return (
    <g>
      <rect x={x - 6} y={b - 1} width="12" height="1" fill="rgb(30 40 20 / 0.2)" />
      <rect x={x - 6} y={b - 6} width="12" height="5" style={pinta('arbusto')} />
      <rect x={x - 4} y={b - 8} width="8" height="2" style={pinta('arbusto')} />
      <rect x={x - 3} y={b - 7} width="3" height="1" style={pinta('arbusto-luz')} />
      <rect x={x + 2} y={b - 5} width="1" height="1" style={pinta('flor-1')} />
      <rect x={x - 3} y={b - 3} width="1" height="1" style={pinta('flor-2')} />
    </g>
  );
}

/** La casa: igual para las cuatro comunidades; solo cambian su color y su letra. */
function Casa({
  cx,
  b,
  comunidad,
  activa,
}: {
  cx: number;
  b: number;
  comunidad: Comunidad;
  activa: boolean;
}) {
  const tejado = TEJADOS[comunidad.codigo];
  // Hileras de tejas: el tejado se estrecha hacia la cumbrera.
  const mitad = (y: number) => 21 - (4 * (b - 20 - y)) / 17;
  return (
    <g>
      <ellipse cx={cx + 2} cy={b + 1} rx="24" ry="3.5" fill="rgb(30 40 20 / 0.2)" />
      <ellipse cx={cx} cy={b + 3} rx="28" ry="6" className={estilos.brillo} />
      <g className={estilos.cuerpoCasa}>
        {/* Pared de tablones sobre un zócalo de piedra */}
        <rect x={cx - 17} y={b - 22} width="34" height="22" fill="#c98b52" />
        {[19, 15, 11, 7].map((d) => (
          <rect key={d} x={cx - 17} y={b - d} width="34" height="1" fill="#ad7140" />
        ))}
        <rect x={cx + 14} y={b - 22} width="3" height="22" fill="rgb(90 45 15 / 0.22)" />
        <rect x={cx - 18} y={b - 3} width="36" height="3" fill="#8f857a" />
        <rect x={cx - 18} y={b - 3} width="36" height="1" fill="#a69c90" />

        {/* Tejado y chimenea */}
        <polygon
          points={`${cx - 21},${b - 20} ${cx + 21},${b - 20} ${cx + 17},${b - 37} ${cx - 17},${b - 37}`}
          fill={tejado.tejado}
        />
        {[24, 28, 32].map((d) => (
          <rect
            key={d}
            x={cx - mitad(b - d)}
            y={b - d}
            width={mitad(b - d) * 2}
            height="1"
            fill={tejado.sombra}
          />
        ))}
        <rect x={cx - 22} y={b - 21} width="44" height="2" fill={tejado.sombra} />
        <rect x={cx - 17} y={b - 38} width="34" height="2" fill={tejado.cumbrera} />
        <rect x={cx + 8} y={b - 44} width="5" height="9" fill="#9a5a44" />
        <rect x={cx + 8} y={b - 40} width="5" height="1" fill="#7c4636" />
        <rect x={cx + 7} y={b - 45} width="7" height="2" fill="#6e3f30" />
        <g fill="#f5f9fd" style={capa('nieve-op')}>
          <polygon
            points={`${cx - 18},${b - 33} ${cx + 18},${b - 33} ${cx + 17},${b - 38} ${cx - 17},${b - 38}`}
          />
          <rect x={cx - 13} y={b - 33} width="3" height="2" />
          <rect x={cx + 1} y={b - 33} width="4" height="1.5" />
          <rect x={cx + 11} y={b - 33} width="2" height="2" />
          <rect x={cx - 22} y={b - 21.5} width="44" height="1.2" />
          <rect x={cx + 7} y={b - 46} width="7" height="1.5" />
        </g>

        {/* Medallón con la letra de la comunidad */}
        <circle
          cx={cx}
          cy={b - 28}
          r="5.5"
          className={estilos.medallon}
          stroke={tejado.sombra}
          strokeWidth="1"
        />
        <text
          x={cx}
          y={b - 27.6}
          className={estilos.letra}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {comunidad.codigo}
        </text>

        {/* Ventanas con jardinera */}
        {[cx - 14, cx + 6].map((x) => (
          <g key={x}>
            <rect x={x} y={b - 18} width="8" height="7" fill="#6b4630" />
            <rect x={x + 1} y={b - 17} width="6" height="5" className={estilos.vidrio} />
            <rect x={x + 3.5} y={b - 17} width="1" height="5" fill="#6b4630" />
            <rect x={x + 1} y={b - 15} width="6" height="1" fill="#6b4630" />
            <rect x={x - 1} y={b - 10} width="10" height="2" fill="#8a5a3a" />
            <rect x={x} y={b - 11.5} width="2" height="1.5" style={pinta('flor-1')} />
            <rect x={x + 3} y={b - 11.5} width="2" height="1.5" style={pinta('flor-2')} />
            <rect x={x + 6} y={b - 11.5} width="2" height="1.5" style={pinta('flor-1')} />
          </g>
        ))}

        {/* Puerta: se abre y deja ver la luz de dentro cuando la casa está elegida */}
        <rect x={cx - 5} y={b - 15} width="10" height="15" fill="#5a3a24" />
        <rect x={cx - 4} y={b - 14} width="8" height="14" fill="#ffe3a0" />
        <g className={estilos.puerta}>
          <rect x={cx - 4} y={b - 14} width="8" height="14" fill={comunidad.color} />
          <rect x={cx - 4} y={b - 8} width="8" height="1" fill="rgb(40 20 10 / 0.18)" />
          <rect x={cx + 2} y={b - 7} width="1" height="1" fill="#5a3a24" />
        </g>
        <rect x={cx - 6} y={b} width="12" height="2" fill="#a49a8e" />
      </g>
      {activa && (
        <g className={estilos.humo} fill="rgb(236 238 245 / 0.85)">
          {[0, 1.1, 2.2].map((retraso) => (
            <circle
              key={retraso}
              cx={cx + 10.5}
              cy={b - 48}
              r="2"
              style={{ animationDelay: `${retraso}s` }}
            />
          ))}
        </g>
      )}
    </g>
  );
}

/** Lo propio de cada estación: flores, hierba alta y girasol, hojarasca o nieve acumulada. */
function HuellasTemporada({ cx, b }: { cx: number; b: number }) {
  return (
    <>
      <g style={capa('flores-op')}>
        {HUELLAS.map(([dx, y], k) => (
          <rect
            key={k}
            x={cx + dx}
            y={y}
            width="1.5"
            height="1.5"
            fill={FLORES[k % FLORES.length]}
          />
        ))}
      </g>
      <g style={capa('verano-op')}>
        <g fill="#2f7d3e">
          {HUELLAS.map(([dx, y], k) => (
            <g key={k}>
              <rect x={cx + dx} y={y - 2} width="1" height="3" />
              <rect x={cx + dx + 1.5} y={y - 1} width="1" height="2" />
            </g>
          ))}
        </g>
        <rect x={cx - 19} y={b - 12} width="1" height="12" fill="#3f8f3a" />
        <rect x={cx - 21} y={b - 7} width="2" height="1" fill="#3f8f3a" />
        <rect x={cx - 21} y={b - 16} width="5" height="4" fill="#ffcc33" />
        <rect x={cx - 20} y={b - 15} width="3" height="2" fill="#8a5222" />
      </g>
      <g style={capa('hojarasca-op')}>
        {HUELLAS.map(([dx, y], k) => (
          <rect
            key={k}
            x={cx + dx}
            y={y}
            width="2"
            height="1"
            fill={HOJARASCA[k % HOJARASCA.length]}
          />
        ))}
        <rect x={cx - 31} y={b + 2} width="7" height="2" fill="#e0782c" />
        <rect x={cx - 29} y={b + 1} width="3" height="1" fill="#f2a93b" />
      </g>
      <g fill="#f6f9fc" style={capa('nieve-op')}>
        <rect x={cx - 19} y={b - 1} width="6" height="2" />
        <rect x={cx + 12} y={b - 1} width="7" height="2" />
        {HUELLAS.map(([dx, y], k) => (
          <rect key={k} x={cx + dx - 1} y={y} width="4" height="1.5" />
        ))}
      </g>
    </>
  );
}

/** Huerto frente a la casa: brotes, tomates, calabazas o montículos de nieve. */
function Huerto({ cx }: { cx: number }) {
  return (
    <g>
      {[122, 129, 136].map((y) => (
        <g key={y}>
          <rect x={cx - 18} y={y} width="36" height="4" style={pinta('tierra')} />
          <rect x={cx - 18} y={y + 3} width="36" height="1" fill="rgb(40 25 10 / 0.14)" />
          {[0, 1, 2, 3, 4].map((j) => (
            <g key={j}>
              <rect x={cx - 15 + j * 7} y={y - 1} width="3" height="3" style={pinta('cultivo')} />
              <rect
                x={cx - 14 + j * 7}
                y={y - 2}
                width="1"
                height="1"
                style={pinta('cultivo-detalle')}
              />
            </g>
          ))}
        </g>
      ))}
    </g>
  );
}

/** Cerca del patio; entre dos patios, una cerca baja separa una casa de la siguiente. */
function Cerca({ cx, conVecina }: { cx: number; conVecina: boolean }) {
  const postes = [-29, -18, -7, 4, 15, 26];
  const postesLaterales = [121, 129, 137];
  return (
    <g>
      <rect x={cx - ZONA / 2} y="148" width={ZONA} height="1.5" fill="#a0723f" />
      <rect x={cx - ZONA / 2} y="151.5" width={ZONA} height="1.5" fill="#a0723f" />
      {postes.map((dx) => (
        <g key={dx}>
          <rect x={cx + dx} y="145" width="2" height="9" fill="#8a5f33" />
          <rect x={cx + dx} y="145" width="2" height="1" fill="#b48a55" />
        </g>
      ))}
      {conVecina && (
        <g>
          <rect x={cx + 31.5} y="121" width="1" height="26" fill="#a0723f" />
          {postesLaterales.map((y) => (
            <rect key={y} x={cx + 31} y={y} width="2" height="6" fill="#8a5f33" />
          ))}
        </g>
      )}
      <g fill="#ffffff" style={capa('nieve-op')}>
        <rect x={cx - ZONA / 2} y="147.4" width={ZONA} height="0.8" />
        {postes.map((dx) => (
          <rect key={dx} x={cx + dx - 0.5} y="144" width="3" height="1.5" />
        ))}
        {conVecina &&
          postesLaterales.map((y) => (
            <rect key={y} x={cx + 30.5} y={y - 1} width="3" height="1.5" />
          ))}
      </g>
    </g>
  );
}

/** Todo lo que pertenece a una casa: su bosque, su árbol, la casa, su huerto y su cerca. */
function Zona({
  indice,
  comunidad,
  estado,
  activa,
}: {
  indice: number;
  comunidad: Comunidad;
  estado: EstadoZona;
  activa: boolean;
}) {
  const cx = centro(indice);
  return (
    <g
      className={estilos.zona}
      data-t={estado.temporada}
      data-activa={activa || undefined}
      style={{
        ['--distancia' as string]: String(estado.distancia),
        ['--color-casa' as string]: comunidad.color,
      }}
    >
      {BOSQUE.map(([dx, dy]) => (
        <ArbolLejano key={dx} x={cx - ZONA / 2 + dx} y={67 + dy} />
      ))}
      {MATAS.map(([dx, y]) => (
        <rect
          key={`${dx}-${y}`}
          x={cx + dx}
          y={y}
          width="2"
          height="1"
          style={pinta('cesped-sombra')}
        />
      ))}
      <Arbol x={cx + 24} b={100} />
      <Arbusto x={cx - 26} b={106} />
      <rect x={cx - 4} y={BASE_CASA + 2} width="8" height="8" fill="url(#valle-camino)" />
      <Casa cx={cx} b={BASE_CASA} comunidad={comunidad} activa={activa} />
      <HuellasTemporada cx={cx} b={BASE_CASA} />
      <Huerto cx={cx} />
      <Cerca cx={cx} conVecina={indice < COMUNIDADES.length - 1} />
    </g>
  );
}

export function ValleComunidades() {
  const [seleccion, setSeleccion] = useState<CodigoComunidad | null>(null);
  const escena = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const intencion = useRef<number | undefined>(undefined);

  // El ambiente solo se anima mientras el valle está en pantalla.
  useEffect(() => {
    const nodo = escena.current;
    if (!nodo || !('IntersectionObserver' in window)) return;
    const observador = new IntersectionObserver(([entrada]) =>
      setVisible(!!entrada?.isIntersecting),
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  useEffect(() => () => window.clearTimeout(intencion.current), []);

  const elegida = COMUNIDADES.find((c) => c.codigo === seleccion) ?? null;
  const indiceElegida = elegida ? COMUNIDADES.indexOf(elegida) : -1;

  // Sin casa elegida, cada zona conserva su estación; al elegir una, su estación llega primero a
  // las casas vecinas y después a las más lejanas.
  const zonas: EstadoZona[] = COMUNIDADES.map((c, i) => ({
    temporada: elegida?.temporada ?? c.temporada,
    distancia: elegida ? Math.abs(i - indiceElegida) : 0,
  }));

  const elegir = (codigo: CodigoComunidad | null) => {
    window.clearTimeout(intencion.current);
    setSeleccion(codigo);
  };

  // Con ratón o lápiz basta con pasar por encima, tras una pausa breve para no cambiar de estación
  // al cruzar la escena camino de otra parte. En pantallas táctiles manda el toque (onClick).
  const alPasar = (codigo: CodigoComunidad) => (evento: PointerEvent) => {
    if (evento.pointerType === 'touch') return;
    window.clearTimeout(intencion.current);
    intencion.current = window.setTimeout(() => setSeleccion(codigo), 120);
  };
  const alSalir = () => window.clearTimeout(intencion.current);

  const cocuyo = elegida
    ? { x: (centro(indiceElegida) - 22) / ANCHO, y: (BASE_CASA - 32) / ALTO }
    : { x: 0.5, y: 46 / ALTO };

  return (
    <figure className={estilos.figura}>
      <div
        ref={escena}
        className={estilos.escena}
        data-t={elegida?.temporada ?? 'mixta'}
        data-pausa={!visible || undefined}
      >
        <svg
          className={estilos.lienzo}
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          shapeRendering="crispEdges"
          role="img"
          aria-labelledby="valle-titulo"
        >
          <title id="valle-titulo">
            {`Un valle con cuatro casas de campo iguales, una junto a otra sobre el mismo camino. Cada casa es una comunidad y tiene su propia estación del año: ${COMUNIDADES.map(
              (c) => `${c.codigo}, ${TEMPORADAS[c.temporada].nombre.toLowerCase()}`,
            ).join('; ')}.`}
          </title>
          <defs>
            <Degradado id="valle-cielo-alto" color="var(--cielo-alto)" zonas={zonas} />
            <Degradado
              id="valle-cielo-medio"
              color="color-mix(in srgb, var(--cielo-alto) 50%, var(--cielo-bajo))"
              zonas={zonas}
            />
            <Degradado id="valle-cielo-bajo" color="var(--cielo-bajo)" zonas={zonas} />
            <Degradado id="valle-colina" color="var(--colina)" zonas={zonas} />
            <Degradado id="valle-cesped" color="var(--cesped)" zonas={zonas} />
            <Degradado id="valle-camino" color="var(--camino)" zonas={zonas} />
            <Degradado id="valle-luz" color="var(--luz)" opacidad="var(--luz-op)" zonas={zonas} />
            <radialGradient id="valle-halo">
              <stop
                offset="0%"
                className={estilos.parada}
                style={{ stopColor: 'var(--sol)', stopOpacity: 0.7 }}
              />
              <stop
                offset="100%"
                className={estilos.parada}
                style={{ stopColor: 'var(--sol)', stopOpacity: 0 }}
              />
            </radialGradient>
          </defs>

          {/* Cielo en franjas, sol en el centro del valle y nubes que pasan despacio */}
          <rect x="0" y="0" width={ANCHO} height="24" fill="url(#valle-cielo-alto)" />
          <rect x="0" y="24" width={ANCHO} height="18" fill="url(#valle-cielo-medio)" />
          <rect x="0" y="42" width={ANCHO} height="28" fill="url(#valle-cielo-bajo)" />
          <g className={estilos.sol}>
            <circle cx={ANCHO / 2} cy="20" r="16" fill="url(#valle-halo)" />
            <circle cx={ANCHO / 2} cy="20" r="7" style={pinta('sol')} />
            <rect x={ANCHO / 2 - 4} y="16" width="4" height="2" fill="#ffffff" opacity="0.6" />
          </g>
          {NUBES.map(({ y, retraso, escala }) => (
            <g key={y} transform={`translate(0 ${y}) scale(${escala})`}>
              <g
                className={estilos.nube}
                style={{ ...pinta('nube'), animationDelay: `${retraso}s` }}
              >
                <rect x="0" y="3" width="20" height="4" />
                <rect x="3" y="1" width="10" height="2" />
                <rect x="12" y="2" width="5" height="1" />
                <rect x="2" y="7" width="16" height="1" opacity="0.6" />
              </g>
            </g>
          ))}

          {/* Colinas, pradera y el camino que comparten las cuatro casas */}
          <polygon points={COLINAS} fill="url(#valle-colina)" />
          <rect x="0" y="64" width={ANCHO} height={ALTO - 64} fill="url(#valle-cesped)" />
          <rect x="0" y="110" width={ANCHO} height="8" fill="url(#valle-camino)" />
          <rect x="0" y="110" width={ANCHO} height="1" fill="rgb(90 60 30 / 0.16)" />
          <rect x="0" y="117" width={ANCHO} height="1" fill="rgb(90 60 30 / 0.16)" />
          {[18, 47, 83, 121, 150, 189, 214, 243].map((x, k) => (
            <rect
              key={x}
              x={x}
              y={112 + (k % 3) * 2}
              width="1"
              height="1"
              fill="rgb(90 60 30 / 0.22)"
            />
          ))}

          {zonas.map((estado, i) => (
            <Zona
              key={COMUNIDADES[i].codigo}
              indice={i}
              comunidad={COMUNIDADES[i]}
              estado={estado}
              activa={seleccion === COMUNIDADES[i].codigo}
            />
          ))}

          {/* Luz ambiental de cada estación */}
          <rect
            className={estilos.luz}
            x="0"
            y="0"
            width={ANCHO}
            height={ALTO}
            fill="url(#valle-luz)"
          />

          {/* Zonas sensibles: el cursor (o el toque) sobre una casa la elige */}
          {COMUNIDADES.map((c, i) => (
            <rect
              key={c.codigo}
              className={estilos.zonaSensible}
              x={centro(i) - 29}
              y="54"
              width="58"
              height="96"
              fill="transparent"
              onPointerEnter={alPasar(c.codigo)}
              onPointerLeave={alSalir}
              onClick={() => elegir(c.codigo)}
            />
          ))}
        </svg>

        <span className={estilos.particulas} aria-hidden="true">
          {zonas.flatMap(({ temporada, distancia }, i) =>
            PARTICULAS.map((p, k) => (
              <i
                key={`${i}-${k}`}
                data-t={temporada}
                style={{
                  left: `${i * 25 + p.dx}%`,
                  animationDelay: `${p.retraso + i * 0.8}s`,
                  animationDuration: `${p.duracion}s`,
                  ['--distancia' as string]: String(distancia),
                }}
              />
            )),
          )}
        </span>

        {elegida && (
          <span
            key={elegida.codigo}
            className={estilos.etiqueta}
            data-ancla={
              indiceElegida === 0
                ? 'inicio'
                : indiceElegida === COMUNIDADES.length - 1
                  ? 'fin'
                  : undefined
            }
            style={{
              left: `${(centro(indiceElegida) / ANCHO) * 100}%`,
              top: `${(56 / ALTO) * 100}%`,
              ['--color-casa' as string]: elegida.color,
            }}
            aria-hidden="true"
          >
            Casa {elegida.codigo} · {elegida.rango}
          </span>
        )}
        <span
          className={estilos.cocuyo}
          style={{ left: `${cocuyo.x * 100}%`, top: `${cocuyo.y * 100}%` }}
          aria-hidden="true"
        >
          <span
            key={seleccion ?? 'valle'}
            className={estilos.cocuyoVuelo}
            data-llega={!!elegida || undefined}
          >
            <Cocuyo tamano={22} />
          </span>
        </span>
      </div>

      <figcaption className={estilos.leyenda}>
        <div className={estilos.cabeceraLeyenda}>
          <p className={estilos.ayudaLeyenda} id="leyenda-casas">
            Cuatro comunidades, cuatro casas iguales.{' '}
            <span className={estilos.ayudaPuntero}>Pasa el cursor por una casa</span>
            <span className={estilos.ayudaTactil}>Toca una casa</span> para ver su estación.
          </p>
          <button
            type="button"
            className={estilos.reiniciar}
            data-visible={!!elegida || undefined}
            onClick={() => elegir(null)}
          >
            <RotateCcw aria-hidden="true" size={13} />
            Ver las cuatro
          </button>
        </div>
        <div className={estilos.botones} role="group" aria-labelledby="leyenda-casas">
          {COMUNIDADES.map(({ codigo, rango, color, temporada }) => {
            const Icono = ICONOS[temporada];
            return (
              <button
                key={codigo}
                type="button"
                className={estilos.botonCasa}
                aria-pressed={seleccion === codigo}
                style={{ ['--color-casa' as string]: color }}
                onPointerEnter={alPasar(codigo)}
                onPointerLeave={alSalir}
                onClick={() => elegir(codigo)}
              >
                <span className={estilos.letraBoton}>
                  <span className="visualmente-oculto">Casa </span>
                  {codigo}
                  <span className="visualmente-oculto">, {rango},</span>
                </span>
                <span className={estilos.temporadaBoton}>
                  <Icono aria-hidden="true" size={13} />
                  {TEMPORADAS[temporada].nombre}
                </span>
              </button>
            );
          })}
        </div>
        <p className={estilos.explicacion} aria-live="polite">
          {elegida
            ? `Comunidad ${elegida.codigo}, de ${elegida.rango}. En su casa siempre es ${TEMPORADAS[elegida.temporada].nombre.toLowerCase()}: quien vive aquí solo ve sus hilos, sus salas y a las personas de su misma edad.`
            : 'Las cuatro casas comparten el valle y ninguna está por encima de otra. Cada quien entra solo por la puerta de su edad: la separación la impone el sistema, no solo la pantalla.'}
        </p>
      </figcaption>
    </figure>
  );
}
