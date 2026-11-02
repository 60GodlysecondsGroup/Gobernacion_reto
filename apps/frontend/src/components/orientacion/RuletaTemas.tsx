'use client';

import { ArrowRight } from 'lucide-react';
import {
  createElement,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { iconoNecesidad, nombreCortoNecesidad, tonoNecesidad } from '@/config/necesidades';
import type { Necesidad } from '@/lib/api/orientacion';
import {
  MAXIMO_CON_ETIQUETA,
  desplazamientoSector,
  indiceSegunTecla,
  posicionEnRuleta,
  tamanoBoton,
  trazadoSector,
} from '@/lib/ruleta';
import ventanas from '@/styles/ventanas.module.css';
import estilos from './RuletaTemas.module.css';

const cuentaServicios = (n: number) => (n === 1 ? '1 servicio' : `${n} servicios`);

/**
 * Ruleta de temas de Orientación: un disco con un sector por tema que gira hasta dejar el tema
 * elegido frente al puntero, que señala su edificio (arriba en el móvil, a la derecha en
 * escritorio). Diseño propio, inspirado en los selectores circulares de los videojuegos.
 *
 * Accesibilidad: es un grupo de opciones (`radiogroup`) con foco itinerante. Las flechas giran y
 * eligen, Inicio y Fin van a los extremos, e Intro o Espacio entran al tema elegido. Elegir no
 * navega: solo entrar (o tocar otra vez el tema elegido) abre el contenido.
 */
export function RuletaTemas({
  necesidades,
  indice,
  giro,
  alElegir,
  alEntrar,
  idAyuda,
}: {
  necesidades: Necesidad[];
  indice: number;
  /** Giro acumulado del disco en grados (ver `giroHacia`). */
  giro: number;
  alElegir: (indice: number) => void;
  alEntrar: () => void;
  idAyuda?: string;
}) {
  const total = necesidades.length;
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  // Tema bajo el cursor: se muestra en el centro sin elegirlo, como vista previa.
  const [vista, setVista] = useState<number | null>(null);
  const conEtiqueta = total <= MAXIMO_CON_ETIQUETA;

  const pulsar = (i: number) => {
    // Al girar, otro sector queda bajo el cursor quieto: la vista previa espera a que se mueva.
    setVista(null);
    if (i === indice) alEntrar();
    else alElegir(i);
  };

  const alTeclear = (evento: KeyboardEvent<HTMLButtonElement>) => {
    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault();
      alEntrar();
      return;
    }
    const destino = indiceSegunTecla(evento.key, indice, total);
    if (destino === null) return;
    evento.preventDefault();
    alElegir(destino);
    botones.current[destino]?.focus({ preventScroll: true });
  };

  // Con ratón o lápiz, mover el cursor por encima muestra el nombre en el centro; el toque elige directamente.
  const alPasar = (i: number) => (evento: PointerEvent) => {
    if (evento.pointerType !== 'touch') setVista(i);
  };
  const alSalir = () => setVista(null);

  const centro = necesidades[vista ?? indice] ?? necesidades[indice];

  return (
    <div
      className={estilos.ruleta}
      style={
        {
          '--giro': `${giro}deg`,
          '--lado': `${tamanoBoton(total)}%`,
        } as CSSProperties
      }
    >
      <div className={estilos.disco}>
        <svg className={estilos.sectores} viewBox="-100 -100 200 200" aria-hidden="true">
          <defs>
            <linearGradient id="ruleta-elegido" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--morado-500)" />
              <stop offset="55%" stopColor="var(--morado-600)" />
              <stop offset="100%" stopColor="#4a4fe0" />
            </linearGradient>
          </defs>
          <circle r="99.4" className={estilos.aro} />
          {necesidades.map((necesidad, i) => {
            const elegido = i === indice;
            const salto = desplazamientoSector(i, total);
            return (
              <path
                key={necesidad.codigo}
                d={trazadoSector(i, total)}
                className={estilos.sector}
                data-elegido={elegido || undefined}
                data-vista={(vista === i && !elegido) || undefined}
                style={elegido ? { transform: `translate(${salto.x}px, ${salto.y}px)` } : undefined}
                onClick={() => pulsar(i)}
                onPointerMove={alPasar(i)}
                onPointerLeave={alSalir}
              />
            );
          })}
        </svg>

        <div
          role="radiogroup"
          aria-label="Temas de orientación"
          aria-describedby={idAyuda}
          className={estilos.opciones}
        >
          {necesidades.map((necesidad, i) => {
            const Icono = iconoNecesidad(necesidad.codigo);
            const { x, y } = posicionEnRuleta(i, total);
            const elegido = i === indice;
            return (
              <button
                key={necesidad.codigo}
                ref={(nodo) => {
                  botones.current[i] = nodo;
                }}
                type="button"
                role="radio"
                aria-checked={elegido}
                aria-label={`${necesidad.nombre}, ${cuentaServicios(necesidad.servicios)}`}
                tabIndex={elegido ? 0 : -1}
                className={estilos.opcion}
                style={{ left: `${x}%`, top: `${y}%` }}
                onClick={() => pulsar(i)}
                onKeyDown={alTeclear}
                onPointerMove={alPasar(i)}
                onPointerLeave={alSalir}
              >
                <span className={estilos.contenido}>
                  <span
                    className={`${ventanas.ficha} ${ventanas[tonoNecesidad(necesidad.codigo)]} ${estilos.ficha}`}
                  >
                    <Icono size={18} strokeWidth={2} aria-hidden="true" />
                  </span>
                  {conEtiqueta && (
                    <span className={estilos.etiqueta} aria-hidden="true">
                      {nombreCortoNecesidad(necesidad.codigo, necesidad.nombre)}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Centro: el tema elegido (o el que está bajo el cursor). Tocarlo también entra. */}
      <div
        className={estilos.centro}
        data-vista={(vista !== null && vista !== indice) || undefined}
        aria-hidden="true"
        onClick={alEntrar}
      >
        <span key={centro.codigo} className={estilos.textoCentro}>
          <span className={`${ventanas.ficha} ${ventanas[tonoNecesidad(centro.codigo)]}`}>
            {createElement(iconoNecesidad(centro.codigo), { size: 20, strokeWidth: 1.9 })}
          </span>
          <span className={estilos.nombreCentro}>{centro.nombre}</span>
          <span className={estilos.cuentaCentro}>
            {vista !== null && vista !== indice ? (
              cuentaServicios(centro.servicios)
            ) : (
              <>
                Entrar
                <ArrowRight size={14} />
              </>
            )}
          </span>
        </span>
      </div>

      <span className={estilos.puntero} aria-hidden="true" />
    </div>
  );
}
