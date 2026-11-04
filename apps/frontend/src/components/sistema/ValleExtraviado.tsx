'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { Cocuyo } from '@/components/guia/Cocuyo';
import estilos from './ValleExtraviado.module.css';

/** Colores de las cuatro ventanas de la marca: una casa por comunidad. */
const CASAS = [
  { x: 64, color: '#2f9be0' },
  { x: 132, color: '#f2a623' },
  { x: 268, color: '#17a97e' },
  { x: 336, color: '#7c6cf2' },
];

/**
 * Escena decorativa del 404: el valle con sus cuatro casas y, entre ellas, un «404» cuyo cero es
 * la luna sobre las colinas. Cocuyo vuela cerca, perdido también. Las capas se separan un poco
 * siguiendo al cursor (solo ratón): el puntero escribe dos variables CSS en un `requestAnimationFrame`,
 * sin renders de React. Todo es `aria-hidden`: el título y el texto de la página dicen lo que pasó.
 */
export function ValleExtraviado() {
  const escena = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodo = escena.current;
    if (!nodo) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let marco = 0;
    const mover = (e: PointerEvent) => {
      cancelAnimationFrame(marco);
      marco = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;
        nodo.style.setProperty('--px', x.toFixed(3));
        nodo.style.setProperty('--py', y.toFixed(3));
      });
    };
    window.addEventListener('pointermove', mover, { passive: true });
    return () => {
      cancelAnimationFrame(marco);
      window.removeEventListener('pointermove', mover);
    };
  }, []);

  return (
    <div ref={escena} className={estilos.escena} aria-hidden="true">
      <svg className={estilos.lienzo} viewBox="0 0 400 200" preserveAspectRatio="xMidYMax meet">
        {/* Capa lejana: colinas que se dibujan con su trazo y luego se rellenan. */}
        <g className={`${estilos.capa} ${estilos.lejos}`}>
          <path
            className={estilos.colina}
            d="M0 150 C60 112 120 118 180 140 S300 110 400 134 V200 H0 Z"
            fill="var(--morado-100)"
            stroke="var(--morado-300)"
          />
        </g>

        {/* Capa media: el «404». El cero es la luna, con su halo. */}
        <g className={`${estilos.capa} ${estilos.medio}`}>
          <text
            className={`${estilos.digito} ${estilos.digitoA}`}
            x="128"
            y="128"
            textAnchor="middle"
          >
            4
          </text>
          <g className={estilos.luna}>
            <circle cx="200" cy="96" r="46" className={estilos.haloLuna} />
            <circle
              cx="200"
              cy="96"
              r="30"
              fill="none"
              stroke="url(#cp-404-degradado)"
              strokeWidth="14"
              className={estilos.aroLuna}
            />
          </g>
          <text
            className={`${estilos.digito} ${estilos.digitoB}`}
            x="272"
            y="128"
            textAnchor="middle"
          >
            4
          </text>
          <defs>
            <linearGradient id="cp-404-degradado" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#7350ea" />
              <stop offset="1" stopColor="#33198a" />
            </linearGradient>
          </defs>
        </g>

        {/* Capa cercana: la colina del frente y las cuatro casas, que llegan una a una. */}
        <g className={`${estilos.capa} ${estilos.cerca}`}>
          <path
            className={estilos.colina}
            d="M0 170 C80 150 150 156 200 166 S320 150 400 160 V200 H0 Z"
            fill="var(--morado-50)"
            stroke="var(--morado-300)"
          />
          {CASAS.map((casa, i) => (
            <g
              key={casa.x}
              className={estilos.casa}
              style={{ '--i': i } as CSSProperties}
              transform={`translate(${casa.x} ${i % 2 ? 146 : 150})`}
            >
              <path d="M-12 0 L0 -11 L12 0 V14 H-12 Z" fill="#fff" stroke="var(--morado-300)" />
              <rect
                x="-4"
                y="3"
                width="8"
                height="7"
                rx="1.5"
                fill={casa.color}
                className={estilos.ventana}
              />
            </g>
          ))}
        </g>
      </svg>

      <span className={estilos.cocuyo}>
        <Cocuyo tamano={34} />
      </span>
    </div>
  );
}
