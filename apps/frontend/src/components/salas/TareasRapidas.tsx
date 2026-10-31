'use client';

import { ArrowDown, ArrowUp, Check, LifeBuoy, RotateCcw, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Boton } from '@/components/ui';
import { CONECTAR_IDEAS, NIVELES_ANIMO, ORDENAR_IDEAS } from '@/config/juegos';
import estilos from './Tareas.module.css';

type Props = {
  alSalir: () => void;
  alCompletar: (resultado: { aciertos: number; total: number }) => void;
};

/** Baraja sin `Math.random` en el render inicial del servidor: estas tareas solo se montan al abrirlas. */
function barajar<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  }
  return copia;
}

function Progreso({ valor, total, etiqueta }: { valor: number; total: number; etiqueta: string }) {
  return (
    <div className={estilos.cabecera}>
      <p>
        {etiqueta} {valor} de {total}
      </p>
      <div
        className={estilos.progreso}
        role="progressbar"
        aria-label={etiqueta}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={valor}
      >
        <span style={{ transform: `scaleX(${valor / total})` }} />
      </div>
    </div>
  );
}

function Exito({
  titulo,
  children,
  alRepetir,
  alSalir,
}: {
  titulo: string;
  children?: ReactNode;
  alRepetir: () => void;
  alSalir: () => void;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  return (
    <div className={estilos.exito}>
      <span className={estilos.destello} aria-hidden="true">
        <Sparkles size={26} />
      </span>
      <h2 ref={ref} tabIndex={-1}>
        {titulo}
      </h2>
      {children}
      <p className={estilos.nota}>Es una actividad local: tu resultado no se guarda ni se comparte.</p>
      <div className={estilos.acciones}>
        <Boton onClick={alRepetir}>
          <RotateCcw aria-hidden="true" size={16} />
          Volver a jugar
        </Boton>
        <Boton variante="secundario" onClick={alSalir}>
          Volver a la sala
        </Boton>
      </div>
    </div>
  );
}

// ── Conectar ideas ────────────────────────────────────────────────────────────────────
export function ConectarIdeas({ alSalir, alCompletar }: Props) {
  const [ronda, setRonda] = useState(0);
  return <ConectarRonda key={ronda} alSalir={alSalir} alCompletar={alCompletar} alRepetir={() => setRonda((n) => n + 1)} />;
}

function ConectarRonda({ alSalir, alCompletar, alRepetir }: Props & { alRepetir: () => void }) {
  const [ideas] = useState(() => barajar(CONECTAR_IDEAS));
  const [elegido, setElegido] = useState<string | null>(null);
  const [unidos, setUnidos] = useState<string[]>([]);
  const [errores, setErrores] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState('Toca un concepto y luego la idea que le corresponde.');
  const total = CONECTAR_IDEAS.length;

  const elegirIdea = (id: string) => {
    if (!elegido) {
      setAviso('Primero elige un concepto de la izquierda.');
      return;
    }
    if (id === elegido) {
      const nuevos = [...unidos, id];
      setUnidos(nuevos);
      setElegido(null);
      setError(null);
      setAviso(`¡Conectado! ${CONECTAR_IDEAS.find((c) => c.id === id)!.concepto}.`);
      if (nuevos.length === total) alCompletar({ aciertos: total - Math.min(errores, total), total });
    } else {
      setErrores((n) => n + 1);
      setError(id);
      setAviso('Esa idea no corresponde. Prueba con otra.');
    }
  };

  if (unidos.length === total) {
    return (
      <Exito titulo="¡Ideas conectadas!" alRepetir={alRepetir} alSalir={alSalir}>
        <p>{errores === 0 ? 'Sin un solo error.' : `Lo lograste con ${errores} intento(s) de más.`}</p>
      </Exito>
    );
  }

  return (
    <div className={estilos.tarea}>
      <Progreso valor={unidos.length} total={total} etiqueta="Conexiones" />
      <div className={estilos.columnas}>
        <ul className={estilos.lista} aria-label="Conceptos">
          {CONECTAR_IDEAS.map((c) => {
            const unido = unidos.includes(c.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={estilos.ficha}
                  data-estado={unido ? 'unido' : elegido === c.id ? 'elegido' : undefined}
                  aria-pressed={elegido === c.id}
                  disabled={unido}
                  onClick={() => {
                    setElegido(c.id);
                    setError(null);
                    setAviso(`Elegiste «${c.concepto}». Ahora toca su idea.`);
                  }}
                >
                  {unido && <Check aria-hidden="true" size={16} />}
                  {c.concepto}
                </button>
              </li>
            );
          })}
        </ul>
        <ul className={estilos.lista} aria-label="Ideas">
          {ideas.map((c) => {
            const unido = unidos.includes(c.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={estilos.ficha}
                  data-estado={unido ? 'unido' : error === c.id ? 'error' : undefined}
                  disabled={unido}
                  onClick={() => elegirIdea(c.id)}
                >
                  {unido && <Check aria-hidden="true" size={16} />}
                  {c.idea}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <p className={estilos.aviso} aria-live="polite">
        {aviso}
      </p>
    </div>
  );
}

// ── Ordenar ideas ─────────────────────────────────────────────────────────────────────
export function OrdenarIdeas({ alSalir, alCompletar }: Props) {
  const [ronda, setRonda] = useState(0);
  return <OrdenarRonda key={ronda} alSalir={alSalir} alCompletar={alCompletar} alRepetir={() => setRonda((n) => n + 1)} />;
}

function OrdenarRonda({ alSalir, alCompletar, alRepetir }: Props & { alRepetir: () => void }) {
  const correcto = ORDENAR_IDEAS.pasos;
  const [orden, setOrden] = useState(() => {
    let o = barajar(correcto);
    while (o.every((p, i) => p === correcto[i])) o = barajar(correcto);
    return o;
  });
  const [revisado, setRevisado] = useState(false);
  const [intentos, setIntentos] = useState(0);
  const [aviso, setAviso] = useState('Usa las flechas para mover cada paso.');
  const enSuSitio = orden.filter((p, i) => p === correcto[i]).length;
  const listo = revisado && enSuSitio === correcto.length;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const mover = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= orden.length) return;
    const nuevo = [...orden];
    [nuevo[i], nuevo[j]] = [nuevo[j]!, nuevo[i]!];
    setOrden(nuevo);
    setRevisado(false);
    setAviso(`«${orden[i]}» quedó en la posición ${j + 1}.`);
    // El foco sigue al paso movido.
    requestAnimationFrame(() => refs.current[j * 2 + (delta < 0 ? 0 : 1)]?.focus());
  };

  const comprobar = () => {
    setRevisado(true);
    setIntentos((n) => n + 1);
    if (enSuSitio === correcto.length) {
      alCompletar({ aciertos: intentos === 0 ? correcto.length : correcto.length - 1, total: correcto.length });
    } else {
      setAviso(`${enSuSitio} de ${correcto.length} pasos están en su lugar. Ajusta los demás.`);
    }
  };

  if (listo) {
    return (
      <Exito titulo="¡Orden perfecto!" alRepetir={alRepetir} alSalir={alSalir}>
        <p>Antes de publicar, revisar tus datos y el tono te cuida a ti y a tu comunidad.</p>
      </Exito>
    );
  }

  return (
    <div className={estilos.tarea}>
      <Progreso valor={revisado ? enSuSitio : 0} total={correcto.length} etiqueta="Pasos en su lugar" />
      <p className={estilos.enunciado}>{ORDENAR_IDEAS.enunciado}</p>
      <ol className={estilos.orden}>
        {orden.map((paso, i) => (
          <li
            key={paso}
            className={estilos.pasoOrden}
            data-estado={revisado ? (paso === correcto[i] ? 'bien' : 'mal') : undefined}
          >
            <span className={estilos.numero} aria-hidden="true">
              {i + 1}
            </span>
            <span className={estilos.textoPaso}>{paso}</span>
            <span className={estilos.flechas}>
              <button
                ref={(el) => {
                  refs.current[i * 2] = el;
                }}
                type="button"
                aria-label={`Subir «${paso}»`}
                disabled={i === 0}
                onClick={() => mover(i, -1)}
              >
                <ArrowUp aria-hidden="true" size={16} />
              </button>
              <button
                ref={(el) => {
                  refs.current[i * 2 + 1] = el;
                }}
                type="button"
                aria-label={`Bajar «${paso}»`}
                disabled={i === orden.length - 1}
                onClick={() => mover(i, 1)}
              >
                <ArrowDown aria-hidden="true" size={16} />
              </button>
            </span>
          </li>
        ))}
      </ol>
      <div className={estilos.acciones}>
        <Boton onClick={comprobar}>Comprobar</Boton>
      </div>
      <p className={estilos.aviso} aria-live="polite">
        {aviso}
      </p>
    </div>
  );
}

// ── Estado de ánimo ───────────────────────────────────────────────────────────────────
export function EstadoAnimo({ alSalir, alCompletar }: Props) {
  const [nivel, setNivel] = useState(2);
  const [listo, setListo] = useState(false);
  const actual = NIVELES_ANIMO[nivel]!;

  if (listo) {
    return (
      <Exito
        titulo={`Hoy te sientes: ${actual.etiqueta.toLowerCase()}`}
        alRepetir={() => {
          setListo(false);
          setNivel(2);
        }}
        alSalir={alSalir}
      >
        <p>{actual.respuesta}</p>
        {actual.ayuda && (
          <Link href="/ayuda" className={estilos.enlaceAyuda}>
            <LifeBuoy aria-hidden="true" size={18} />
            Ver canales de ayuda
          </Link>
        )}
      </Exito>
    );
  }

  return (
    <div className={estilos.tarea}>
      <Progreso valor={1} total={2} etiqueta="Paso" />
      <label htmlFor="animo" className={estilos.enunciado}>
        ¿Cómo te sientes hoy? Mueve el control.
      </label>
      <div className={estilos.animo} style={{ ['--nivel' as string]: nivel }}>
        <Cara nivel={nivel} />
        <p className={estilos.etiquetaAnimo} aria-hidden="true">
          {actual.etiqueta}
        </p>
      </div>
      <input
        id="animo"
        className={estilos.deslizador}
        type="range"
        min={0}
        max={NIVELES_ANIMO.length - 1}
        step={1}
        value={nivel}
        aria-valuetext={actual.etiqueta}
        onChange={(e) => setNivel(Number(e.target.value))}
      />
      <div className={estilos.extremos} aria-hidden="true">
        <span>Muy mal</span>
        <span>Muy bien</span>
      </div>
      <div className={estilos.acciones}>
        <Boton
          onClick={() => {
            setListo(true);
            alCompletar({ aciertos: 1, total: 1 });
          }}
        >
          Listo
        </Boton>
      </div>
    </div>
  );
}

/** Carita pixel art: la boca cambia con el nivel. */
function Cara({ nivel }: { nivel: number }) {
  const boca = [
    // 0 muy mal … 4 muy bien (filas de la boca en una cuadrícula de 16×16)
    [[5, 11], [6, 10], [7, 10], [8, 10], [9, 10], [10, 11]],
    [[5, 11], [6, 11], [7, 10], [8, 10], [9, 11], [10, 11]],
    [[5, 11], [6, 11], [7, 11], [8, 11], [9, 11], [10, 11]],
    [[5, 10], [6, 11], [7, 11], [8, 11], [9, 11], [10, 10]],
    [[4, 9], [5, 10], [6, 11], [7, 11], [8, 11], [9, 11], [10, 10], [11, 9]],
  ][nivel]!;
  const colores = ['#9c8fd6', '#a99be0', '#c4bdff', '#ffd27a', '#ffc857'];
  return (
    <svg viewBox="0 0 16 16" className={estilos.cara} shapeRendering="crispEdges" aria-hidden="true">
      <rect x="3" y="2" width="10" height="12" fill={colores[nivel]} />
      <rect x="2" y="3" width="12" height="10" fill={colores[nivel]} />
      <rect x="5" y="6" width="2" height="2" fill="#1a0f45" />
      <rect x="9" y="6" width="2" height="2" fill="#1a0f45" />
      {nivel >= 3 && (
        <>
          <rect x="3" y="9" width="2" height="1" fill="#f08a8a" opacity="0.7" />
          <rect x="11" y="9" width="2" height="1" fill="#f08a8a" opacity="0.7" />
        </>
      )}
      {boca.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#1a0f45" />
      ))}
    </svg>
  );
}
