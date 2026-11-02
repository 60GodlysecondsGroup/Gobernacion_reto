'use client';

import { AnimatePresence, motion } from 'motion/react';
import { createElement, type ReactNode } from 'react';
import { Cocuyo } from '@/components/guia/Cocuyo';
import {
  edificioNecesidad,
  iconoNecesidad,
  tonoNecesidad,
  type FormaEdificio,
  type TonoVentana,
} from '@/config/necesidades';
import { CURVA_SALIDA, DESPLAZAMIENTO_ENTRADA, DURACION } from '@/lib/movimiento';
import estilos from './EscenaEdificio.module.css';

/**
 * El pueblo de Orientación: un edificio en pixel art propio (RF28) por cada tema, dibujado con
 * el mismo lenguaje que el valle de la portada (`ValleComunidades`): casas de tablones, tejados de
 * tejas, ventanas que se encienden, humo, nubes y Cocuyo volando hasta el letrero.
 *
 * Al cambiar de tema, el cielo y la pradera se funden hacia la luz del nuevo edificio (como el
 * cambio de estación del valle) y el edificio nuevo «se asienta» desde abajo. Es decorativo: el
 * enlace que lo envuelve (en `ExploradorTemas`) da el nombre del tema a los lectores de pantalla.
 */

// ── Geometría (unidades del viewBox) ─────────────────────────────────────────────────
const ANCHO = 160;
const ALTO = 110;
const CX = ANCHO / 2;
/** Línea del suelo sobre la que se apoyan todos los edificios. */
const B = 90;

/** Tejados en un tono más profundo del color del tema: los mismos de las casas del valle. */
const TEJADOS: Record<TonoVentana, { tejado: string; sombra: string; cumbrera: string }> = {
  ambar: { tejado: '#d9822b', sombra: '#a95f1c', cumbrera: '#eea54d' },
  lila: { tejado: '#8d72d6', sombra: '#6a51b3', cumbrera: '#ab95e8' },
  cielo: { tejado: '#3f8fcf', sombra: '#2b6ea6', cumbrera: '#6fb2e6' },
  menta: { tejado: '#2e9c7a', sombra: '#1f775c', cumbrera: '#55bb98' },
};

/** Letrero de cada edificio: centro (x, y) y diámetro, donde se dibuja el icono del tema. */
const LETREROS: Record<FormaEdificio, { x: number; y: number; d: number }> = {
  casa: { x: CX, y: B - 33, d: 12 },
  cafe: { x: CX, y: B - 39, d: 12 },
  refugio: { x: CX, y: B - 36, d: 12 },
  casasUnidas: { x: CX, y: B - 31, d: 12 },
  torre: { x: CX, y: B - 45, d: 12 },
  institucion: { x: CX, y: B - 37, d: 11 },
};

const NUBES = [
  { y: 8, retraso: 0, escala: 1 },
  { y: 22, retraso: -40, escala: 0.8 },
];

const pct = (valor: number, total: number) => `${(valor / total) * 100}%`;

// ── Piezas comunes ───────────────────────────────────────────────────────────────────
function Pared({
  x,
  y,
  w,
  h,
  material = 'madera',
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  material?: 'madera' | 'estuco';
}) {
  if (material === 'estuco') {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill="#f1e4cc" />
        <rect x={x} y={y} width={w} height="1" fill="#fff6e6" />
        <rect x={x + w - 3} y={y} width="3" height={h} fill="rgb(90 60 30 / 0.14)" />
      </g>
    );
  }
  const tablas = [];
  for (let d = 4; d < h; d += 4) tablas.push(d);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#c98b52" />
      {tablas.map((d) => (
        <rect key={d} x={x} y={y + h - d} width={w} height="1" fill="#ad7140" />
      ))}
      <rect x={x + w - 3} y={y} width="3" height={h} fill="rgb(90 45 15 / 0.22)" />
    </g>
  );
}

function Zocalo({ x, w }: { x: number; w: number }) {
  return (
    <g>
      <rect x={x} y={B - 3} width={w} height="3" fill="#8f857a" />
      <rect x={x} y={B - 3} width={w} height="1" fill="#a69c90" />
    </g>
  );
}

/** Ventana con marco de madera: el vidrio se enciende cuando el edificio aparece. */
function Ventana({ x, y, w = 8, h = 7 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#6b4630" />
      <rect x={x + 1} y={y + 1} width={w - 2} height={h - 2} className={estilos.vidrio} />
      <rect x={x + w / 2 - 0.5} y={y + 1} width="1" height={h - 2} fill="#6b4630" />
      <rect x={x + 1} y={y + Math.floor(h / 2)} width={w - 2} height="1" fill="#6b4630" />
    </g>
  );
}

function Jardinera({ x, w = 8 }: { x: number; w?: number }) {
  return (
    <g>
      <rect x={x - 1} y={B - 10} width={w + 2} height="2" fill="#8a5a3a" />
      <rect x={x} y={B - 11.5} width="2" height="1.5" fill="#f58fb8" />
      <rect x={x + 3} y={B - 11.5} width="2" height="1.5" fill="#fff1a8" />
      <rect x={x + 6} y={B - 11.5} width="2" height="1.5" fill="#f58fb8" />
    </g>
  );
}

/** Puerta del color del tema; al aparecer el edificio se entreabre y deja ver la luz de dentro. */
function Puerta({
  cx,
  color,
  w = 10,
  h = 15,
}: {
  cx: number;
  color: string;
  w?: number;
  h?: number;
}) {
  return (
    <g>
      <rect x={cx - w / 2} y={B - h} width={w} height={h} fill="#5a3a24" />
      <rect x={cx - w / 2 + 1} y={B - h + 1} width={w - 2} height={h - 1} fill="#ffe3a0" />
      <g className={estilos.puerta}>
        <rect x={cx - w / 2 + 1} y={B - h + 1} width={w - 2} height={h - 1} fill={color} />
        <rect
          x={cx - w / 2 + 1}
          y={B - h / 2}
          width={w - 2}
          height="1"
          fill="rgb(40 20 10 / 0.18)"
        />
        <rect x={cx + w / 2 - 3} y={B - h / 2 + 1} width="1" height="1" fill="#5a3a24" />
      </g>
      <rect x={cx - w / 2 - 1} y={B} width={w + 2} height="2" fill="#a49a8e" />
    </g>
  );
}

/** Tejado a dos aguas visto de frente, con hileras de tejas que se estrechan hacia la cumbrera. */
function Tejado({
  cx,
  y,
  mitad,
  alto,
  tono,
}: {
  cx: number;
  y: number;
  mitad: number;
  alto: number;
  tono: TonoVentana;
}) {
  const t = TEJADOS[tono];
  const ancho = (d: number) => mitad - (4 * d) / alto;
  const hileras = [];
  for (let d = 4; d < alto - 2; d += 4) hileras.push(d);
  return (
    <g>
      <polygon
        points={`${cx - mitad},${y} ${cx + mitad},${y} ${cx + mitad - 4},${y - alto} ${cx - mitad + 4},${y - alto}`}
        fill={t.tejado}
      />
      {hileras.map((d) => (
        <rect key={d} x={cx - ancho(d)} y={y - d} width={ancho(d) * 2} height="1" fill={t.sombra} />
      ))}
      <rect x={cx - mitad - 1} y={y - 1} width={mitad * 2 + 2} height="2" fill={t.sombra} />
      <rect
        x={cx - mitad + 4}
        y={y - alto - 1}
        width={(mitad - 4) * 2}
        height="2"
        fill={t.cumbrera}
      />
    </g>
  );
}

function Chimenea({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width="5" height="9" fill="#9a5a44" />
      <rect x={x} y={y + 4} width="5" height="1" fill="#7c4636" />
      <rect x={x - 1} y={y - 1} width="7" height="2" fill="#6e3f30" />
      <g className={estilos.humo} fill="rgb(236 238 245 / 0.85)">
        {[0, 1.1, 2.2].map((retraso) => (
          <circle
            key={retraso}
            cx={x + 2.5}
            cy={y - 3}
            r="2"
            style={{ animationDelay: `${retraso}s` }}
          />
        ))}
      </g>
    </g>
  );
}

/** Placa redonda (o cuadrada) donde se dibuja el icono del tema. */
function Placa({
  forma,
  tono,
  cuadrada = false,
}: {
  forma: FormaEdificio;
  tono: TonoVentana;
  cuadrada?: boolean;
}) {
  const { x, y, d } = LETREROS[forma];
  const t = TEJADOS[tono];
  return cuadrada ? (
    <g>
      <rect x={x - d / 2 - 1} y={y - d / 2 - 1} width={d + 2} height={d + 2} fill={t.sombra} />
      <rect x={x - d / 2} y={y - d / 2} width={d} height={d} className={estilos.placa} />
    </g>
  ) : (
    <circle cx={x} cy={y} r={d / 2} className={estilos.placa} stroke={t.sombra} strokeWidth="1" />
  );
}

function Arbol({ x, b = B }: { x: number; b?: number }) {
  return (
    <g>
      <ellipse cx={x + 1} cy={b} rx="9" ry="2.2" fill="rgb(30 40 20 / 0.18)" />
      <rect x={x - 2} y={b - 13} width="4" height="13" fill="#7a5235" />
      <rect x={x + 1} y={b - 13} width="1" height="13" fill="#5e3e27" />
      <g className={estilos.copa} style={{ transformOrigin: `${x}px ${b - 12}px` }}>
        <rect x={x - 10} y={b - 20} width="20" height="5" fill="#2f8a42" />
        <rect x={x - 9} y={b - 27} width="18" height="8" fill="#3e9c45" />
        <rect x={x - 6} y={b - 30} width="12" height="3" fill="#3e9c45" />
        <rect x={x - 6} y={b - 27} width="5" height="2" fill="#66c158" />
        <rect x={x + 3} y={b - 24} width="4" height="2" fill="#66c158" />
      </g>
    </g>
  );
}

function Arbusto({ x, b = B }: { x: number; b?: number }) {
  return (
    <g>
      <rect x={x - 6} y={b - 1} width="12" height="1" fill="rgb(30 40 20 / 0.2)" />
      <rect x={x - 6} y={b - 6} width="12" height="5" fill="#4fae4a" />
      <rect x={x - 4} y={b - 8} width="8" height="2" fill="#4fae4a" />
      <rect x={x - 3} y={b - 7} width="3" height="1" fill="#7fd05f" />
      <rect x={x + 2} y={b - 5} width="1" height="1" fill="#f58fb8" />
      <rect x={x - 3} y={b - 3} width="1" height="1" fill="#fff1a8" />
    </g>
  );
}

function Banca({ x }: { x: number }) {
  return (
    <g>
      <rect x={x} y={B - 5} width="14" height="2" fill="#a0723f" />
      <rect x={x} y={B - 9} width="14" height="2" fill="#b48a55" />
      <rect x={x + 1} y={B - 3} width="1.5" height="3" fill="#6b4630" />
      <rect x={x + 11.5} y={B - 3} width="1.5" height="3" fill="#6b4630" />
    </g>
  );
}

function Farol({ x }: { x: number }) {
  return (
    <g>
      <circle cx={x + 1} cy={B - 22} r="7" className={estilos.resplandor} />
      <rect x={x} y={B - 20} width="2" height="20" fill="#3d3a52" />
      <rect x={x - 1} y={B - 1} width="4" height="1" fill="#3d3a52" />
      <rect x={x - 2} y={B - 25} width="6" height="5" fill="#3d3a52" />
      <rect x={x - 1} y={B - 24} width="4" height="3" className={estilos.vidrio} />
      <rect x={x - 1} y={B - 26} width="4" height="1" fill="#3d3a52" />
    </g>
  );
}

// ── Edificios ────────────────────────────────────────────────────────────────────────
type PropsEdificio = { tono: TonoVentana; color: string };

/** Bienestar: una casa con huerto y jardín, como las del valle. */
function Casa({ tono, color }: PropsEdificio) {
  return (
    <g>
      <Arbol x={36} />
      <Arbusto x={124} />
      <Chimenea x={CX + 10} y={B - 52} />
      <Pared x={CX - 22} y={B - 26} w={44} h={26} />
      <Zocalo x={CX - 23} w={46} />
      <Tejado cx={CX} y={B - 24} mitad={27} alto={22} tono={tono} />
      <Placa forma="casa" tono={tono} />
      <Ventana x={CX - 18} y={B - 20} />
      <Ventana x={CX + 10} y={B - 20} />
      <Jardinera x={CX - 18} />
      <Jardinera x={CX + 10} />
      <Puerta cx={CX} color={color} />
      {[108, 114, 132, 138, 46, 52].map((x, k) => (
        <rect key={x} x={x} y={B - 2} width="2" height="2" fill={k % 2 ? '#fff1a8' : '#f58fb8'} />
      ))}
    </g>
  );
}

/** Quiero hablar con alguien: un café de barrio con toldo, banca y un bocadillo de conversación. */
function Cafe({ tono, color }: PropsEdificio) {
  const t = TEJADOS[tono];
  const franjas = [];
  for (let x = CX - 26; x < CX + 26; x += 6) franjas.push(x);
  return (
    <g>
      <Arbusto x={122} />
      <Banca x={30} />
      <Pared x={CX - 26} y={B - 50} w={52} h={50} material="estuco" />
      <rect x={CX - 28} y={B - 53} width="56" height="3" fill={t.sombra} />
      <rect x={CX - 28} y={B - 54} width="56" height="1" fill={t.cumbrera} />
      <Ventana x={CX - 20} y={B - 45} />
      <Ventana x={CX + 12} y={B - 45} />
      <Placa forma="cafe" tono={tono} cuadrada />
      {/* Toldo a franjas con borde ondulado */}
      <rect x={CX - 27} y={B - 29} width="54" height="6" fill="#fff8ec" />
      {franjas.map((x) => (
        <g key={x}>
          <rect x={x} y={B - 29} width="3" height="6" fill={t.tejado} />
          <rect x={x} y={B - 23} width="3" height="1.5" fill={t.tejado} />
          <rect x={x + 3} y={B - 23} width="3" height="1.5" fill="#fff8ec" />
        </g>
      ))}
      {/* Vitrina */}
      <rect x={CX - 23} y={B - 19} width="24" height="15" fill="#6b4630" />
      <rect x={CX - 22} y={B - 18} width="22" height="13" className={estilos.vidrio} />
      <rect x={CX - 11.5} y={B - 18} width="1" height="13" fill="#6b4630" />
      <rect x={CX - 20} y={B - 9} width="6" height="1" fill="#8a5a3a" />
      <rect x={CX - 7} y={B - 9} width="6" height="1" fill="#8a5a3a" />
      <Zocalo x={CX - 27} w={54} />
      <Puerta cx={CX + 14} color={color} />
      {/* Bocadillo de conversación */}
      <g className={estilos.bocadillo}>
        <rect x={CX + 18} y={B - 70} width="18" height="10" fill="#ffffff" />
        <rect x={CX + 19} y={B - 71} width="16" height="1" fill="#ffffff" />
        <rect x={CX + 19} y={B - 60} width="16" height="1" fill="#ffffff" />
        <rect x={CX + 21} y={B - 59} width="3" height="2" fill="#ffffff" />
        {[22, 26, 30].map((dx) => (
          <rect key={dx} x={CX + dx} y={B - 66} width="2" height="2" fill={t.sombra} />
        ))}
      </g>
    </g>
  );
}

/** Me preocupa una situación: un refugio con puerta en arco y un farol encendido. */
function Refugio({ tono, color }: PropsEdificio) {
  return (
    <g>
      <Arbol x={130} />
      <Farol x={40} />
      <Pared x={CX - 24} y={B - 30} w={48} h={30} material="estuco" />
      <Zocalo x={CX - 25} w={50} />
      <Tejado cx={CX} y={B - 28} mitad={30} alto={20} tono={tono} />
      <Placa forma="refugio" tono={tono} />
      <Ventana x={CX - 19} y={B - 22} h={9} />
      <Ventana x={CX + 11} y={B - 22} h={9} />
      {/* Puerta en arco */}
      <rect x={CX - 6} y={B - 17} width="12" height="17" fill="#5a3a24" />
      <rect x={CX - 4} y={B - 19} width="8" height="2" fill="#5a3a24" />
      <rect x={CX - 5} y={B - 16} width="10" height="16" fill="#ffe3a0" />
      <rect x={CX - 3} y={B - 18} width="6" height="2" fill="#ffe3a0" />
      <g className={estilos.puerta}>
        <rect x={CX - 5} y={B - 16} width="10" height="16" fill={color} />
        <rect x={CX - 3} y={B - 18} width="6" height="2" fill={color} />
        <rect x={CX + 2} y={B - 8} width="1" height="1" fill="#5a3a24" />
      </g>
      <rect x={CX - 7} y={B} width="14" height="2" fill="#a49a8e" />
    </g>
  );
}

/** Me preocupa un amigo: dos casas vecinas unidas por una pérgola con enredadera. */
function CasasUnidas({ tono, color }: PropsEdificio) {
  const casa = (cx: number, puerta: number) => (
    <g key={cx}>
      <Pared x={cx - 16} y={B - 22} w={32} h={22} />
      <Zocalo x={cx - 17} w={34} />
      <Tejado cx={cx} y={B - 20} mitad={20} alto={16} tono={tono} />
      <Ventana x={cx - (puerta > cx ? 12 : -4)} y={B - 17} />
      <Puerta cx={puerta} color={color} w={8} h={13} />
    </g>
  );
  return (
    <g>
      {casa(CX - 30, CX - 24)}
      {casa(CX + 30, CX + 24)}
      {/* Pérgola entre las dos casas */}
      <rect x={CX - 14} y={B - 24} width="28" height="2" fill="#a0723f" />
      <rect x={CX - 14} y={B - 22} width="2" height="22" fill="#8a5f33" />
      <rect x={CX + 12} y={B - 22} width="2" height="22" fill="#8a5f33" />
      {[-13, -8, -3, 5, 10].map((dx) => (
        <rect key={dx} x={CX + dx} y={B - 22} width="3" height="2" fill="#3e9c45" />
      ))}
      <rect x={CX - 13} y={B - 20} width="1" height="6" fill="#3e9c45" />
      <rect x={CX + 13} y={B - 19} width="1" height="8" fill="#3e9c45" />
      <rect x={CX - 6} y={B - 2} width="12" height="2" fill="#a49a8e" />
      <Placa forma="casasUnidas" tono={tono} cuadrada />
      <Arbusto x={16} />
      <Arbusto x={146} />
    </g>
  );
}

/** Líneas y canales de ayuda: una torre de comunicaciones que emite su señal. */
function Torre({ tono, color }: PropsEdificio) {
  const t = TEJADOS[tono];
  return (
    <g>
      <Arbol x={128} />
      <Arbusto x={34} />
      {/* Antena con señal */}
      <rect x={CX - 1} y={B - 78} width="2" height="16" fill="#4d4870" />
      <rect x={CX - 4} y={B - 70} width="8" height="1" fill="#4d4870" />
      <rect
        x={CX - 1.5}
        y={B - 80}
        width="3"
        height="3"
        className={estilos.baliza}
        fill={t.cumbrera}
      />
      <g
        className={estilos.ondas}
        fill="none"
        stroke={t.tejado}
        strokeWidth="1.4"
        shapeRendering="geometricPrecision"
      >
        {[6, 11].map((r, k) => (
          <g key={r} style={{ animationDelay: `${k * 0.45}s` }}>
            <path
              d={`M ${CX - r} ${B - 78.5 - r * 0.55} A ${r} ${r} 0 0 0 ${CX - r} ${B - 78.5 + r * 0.55}`}
            />
            <path
              d={`M ${CX + r} ${B - 78.5 - r * 0.55} A ${r} ${r} 0 0 1 ${CX + r} ${B - 78.5 + r * 0.55}`}
            />
          </g>
        ))}
      </g>
      {/* Torre */}
      <Pared x={CX - 9} y={B - 62} w={18} h={40} material="estuco" />
      <rect x={CX - 11} y={B - 64} width="22" height="3" fill={t.sombra} />
      <rect x={CX - 11} y={B - 65} width="22" height="1" fill={t.cumbrera} />
      <Placa forma="torre" tono={tono} cuadrada />
      <rect x={CX - 2} y={B - 36} width="4" height="7" fill="#6b4630" />
      <rect x={CX - 1} y={B - 35} width="2" height="5" className={estilos.vidrio} />
      {/* Edificio bajo */}
      <Pared x={CX - 24} y={B - 24} w={48} h={24} />
      <rect x={CX - 26} y={B - 26} width="52" height="3" fill={t.sombra} />
      <rect x={CX - 26} y={B - 27} width="52" height="1" fill={t.cumbrera} />
      <Zocalo x={CX - 25} w={50} />
      <Ventana x={CX - 19} y={B - 19} />
      <Ventana x={CX + 11} y={B - 19} />
      <Puerta cx={CX} color={color} />
    </g>
  );
}

/** Información institucional: un edificio de columnas con frontón, escalinata y bandera. */
function Institucion({ tono, color }: PropsEdificio) {
  const t = TEJADOS[tono];
  return (
    <g>
      <Arbol x={24} />
      <Arbol x={138} />
      {/* Bandera */}
      <rect x={CX - 0.5} y={B - 64} width="1" height="18" fill="#4d4870" />
      <g className={estilos.bandera} style={{ transformOrigin: `${CX}px ${B - 61}px` }}>
        <rect x={CX + 0.5} y={B - 64} width="11" height="6" fill={t.tejado} />
        <rect x={CX + 0.5} y={B - 62} width="11" height="2" fill={t.cumbrera} />
      </g>
      {/* Frontón */}
      <polygon
        points={`${CX - 32},${B - 30} ${CX + 32},${B - 30} ${CX},${B - 46}`}
        fill={t.tejado}
      />
      <polygon
        points={`${CX - 25},${B - 31} ${CX + 25},${B - 31} ${CX},${B - 43}`}
        fill="#f1e4cc"
      />
      <rect x={CX - 33} y={B - 31} width="66" height="2" fill={t.sombra} />
      <Placa forma="institucion" tono={tono} />
      {/* Cuerpo y columnas */}
      <Pared x={CX - 28} y={B - 29} w={56} h={25} material="estuco" />
      <rect x={CX - 28} y={B - 29} width="56" height="2" fill="#dccbb0" />
      {[-25, -11, 7, 21].map((dx) => (
        <g key={dx}>
          <rect x={CX + dx} y={B - 27} width="4" height="23" fill="#fbf4e6" />
          <rect x={CX + dx + 3} y={B - 27} width="1" height="23" fill="#dccbb0" />
          <rect x={CX + dx - 1} y={B - 27} width="6" height="2" fill="#e6d6ba" />
        </g>
      ))}
      <Ventana x={CX - 20} y={B - 21} w={8} h={9} />
      <Ventana x={CX + 12} y={B - 21} w={8} h={9} />
      <Puerta cx={CX} color={color} w={10} h={17} />
      {/* Escalinata */}
      <rect x={CX - 30} y={B - 4} width="60" height="2" fill="#c9bfb2" />
      <rect x={CX - 32} y={B - 2} width="64" height="2" fill="#b3a99c" />
    </g>
  );
}

const EDIFICIOS: Record<FormaEdificio, (props: PropsEdificio) => ReactNode> = {
  casa: Casa,
  cafe: Cafe,
  refugio: Refugio,
  casasUnidas: CasasUnidas,
  torre: Torre,
  institucion: Institucion,
};

/** Color de puerta (y de acento) de cada tono: el de las ventanas de la marca. */
const PUERTAS: Record<TonoVentana, string> = {
  cielo: '#8fd3ff',
  ambar: '#ffc857',
  menta: '#7de3c3',
  lila: '#c4bdff',
};

/** Escena completa: paisaje (fijo, cambia de luz) y el edificio del tema, que entra y sale. */
export function EscenaEdificio({ codigo }: { codigo: string }) {
  const forma = edificioNecesidad(codigo);
  const tono = tonoNecesidad(codigo);
  const Edificio = EDIFICIOS[forma];
  const letrero = LETREROS[forma];

  return (
    <div className={estilos.escena} data-tono={tono} aria-hidden="true">
      <div className={estilos.marco}>
        <svg
          className={estilos.lienzo}
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          shapeRendering="crispEdges"
          focusable="false"
        >
          <rect x="0" y="0" width={ANCHO} height="18" className={estilos.cieloAlto} />
          <rect x="0" y="18" width={ANCHO} height="16" className={estilos.cieloMedio} />
          <rect x="0" y="34" width={ANCHO} height="30" className={estilos.cieloBajo} />
          <g className={estilos.sol}>
            <circle cx="132" cy="18" r="12" className={estilos.halo} />
            <circle cx="132" cy="18" r="6" className={estilos.astro} />
          </g>
          {NUBES.map(({ y, retraso, escala }) => (
            <g key={y} transform={`translate(0 ${y}) scale(${escala})`}>
              <g className={estilos.nube} style={{ animationDelay: `${retraso}s` }}>
                <rect x="0" y="3" width="20" height="4" />
                <rect x="3" y="1" width="10" height="2" />
                <rect x="12" y="2" width="5" height="1" />
              </g>
            </g>
          ))}
          <polygon
            className={estilos.colina}
            points="0,64 0,56 16,56 16,54 34,54 34,52 56,52 56,54 74,54 74,57 96,57 96,55 116,55 116,52 138,52 138,54 160,54 160,64"
          />
          <rect x="0" y="62" width={ANCHO} height={ALTO - 62} className={estilos.cesped} />
          {[
            [12, 72],
            [30, 98],
            [58, 104],
            [104, 100],
            [128, 74],
            [146, 96],
            [20, 86],
            [140, 84],
          ].map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="3" height="1" className={estilos.mata} />
          ))}
          <polygon
            className={estilos.camino}
            points={`${CX - 6},${B + 2} ${CX + 6},${B + 2} ${CX + 18},${ALTO} ${CX - 18},${ALTO}`}
          />
        </svg>

        <AnimatePresence initial={false}>
          <motion.div
            key={codigo}
            className={estilos.capaEdificio}
            initial={{ opacity: 0, y: DESPLAZAMIENTO_ENTRADA, scale: 0.97 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { duration: DURACION.contexto, ease: CURVA_SALIDA },
            }}
            exit={{ opacity: 0, y: -6, transition: { duration: DURACION.rapida } }}
          >
            <svg
              className={estilos.lienzo}
              viewBox={`0 0 ${ANCHO} ${ALTO}`}
              shapeRendering="crispEdges"
              focusable="false"
            >
              <ellipse cx={CX} cy={B + 1} rx="40" ry="4" fill="rgb(30 40 20 / 0.16)" />
              <g className={estilos.cuerpo}>
                <Edificio tono={tono} color={PUERTAS[tono]} />
              </g>
            </svg>
            <span
              className={estilos.icono}
              style={{
                left: pct(letrero.x, ANCHO),
                top: pct(letrero.y, ALTO),
                width: pct(letrero.d * 0.78, ANCHO),
              }}
            >
              {createElement(iconoNecesidad(codigo), { strokeWidth: 2.4 })}
            </span>
          </motion.div>
        </AnimatePresence>

        {/* Cocuyo vuela hasta el letrero del edificio elegido. */}
        <span
          className={estilos.cocuyo}
          style={{ left: pct(letrero.x + 16, ANCHO), top: pct(letrero.y - 9, ALTO) }}
        >
          <span key={codigo} className={estilos.cocuyoVuelo}>
            <Cocuyo tamano={20} />
          </span>
        </span>
      </div>
    </div>
  );
}
