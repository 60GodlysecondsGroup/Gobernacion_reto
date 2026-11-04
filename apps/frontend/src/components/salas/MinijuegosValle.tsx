'use client';

import { ArrowLeft, BookOpen, Droplets, RotateCcw, Sprout } from 'lucide-react';
import { LayoutGroup, motion } from 'motion/react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Cocuyo } from '@/components/guia/Cocuyo';
import { Boton } from '@/components/ui';
import { RESORTE_INDICADOR } from '@/lib/movimiento';
import estilos from './MinijuegosValle.module.css';

type Props = {
  alSalir: () => void;
  alCompletar: (resultado: { aciertos: number; total: number }) => void;
};

type IdJuego = 'luciernagas' | 'libros' | 'huerto';

const JUEGOS: { id: IdJuego; titulo: string; descripcion: string; icono: ReactNode }[] = [
  {
    id: 'luciernagas',
    titulo: 'Atrapa luciérnagas',
    descripcion: 'Ayuda a Cocuyo a reunir a sus amigas antes de que amanezca.',
    icono: <Cocuyo tamano={34} />,
  },
  {
    id: 'libros',
    titulo: 'Ordena la biblioteca',
    descripcion: 'Pon los libros del más bajo al más alto, cambiándolos de dos en dos.',
    icono: <BookOpen size={30} strokeWidth={2.25} />,
  },
  {
    id: 'huerto',
    titulo: 'Riega el huerto',
    descripcion: 'Las plantas se secan con el sol: riégalas para que lleguen al final.',
    icono: <Sprout size={30} strokeWidth={2.25} />,
  },
];

/** Número al azar en [min, max). Solo en efectos y manejadores: el juego se monta al abrirlo. */
const azar = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * Minijuegos del valle: juegos cortos dentro de la sala, sin puntos ni premios (los resultados
 * no se guardan ni se comparten). Se eligen en un menú y cada uno se puede repetir o cambiar.
 */
export function MinijuegosValle({ alSalir, alCompletar }: Props) {
  const [juego, setJuego] = useState<IdJuego | null>(null);
  const [ronda, setRonda] = useState(0);

  if (!juego) {
    return (
      <div className={estilos.menu}>
        <p className={estilos.lema}>
          Juegos cortos para hacer una pausa. No hay puntos ni premios.
        </p>
        <ul className={estilos.tarjetas}>
          {JUEGOS.map((j) => (
            <li key={j.id}>
              <button type="button" className={estilos.tarjeta} onClick={() => setJuego(j.id)}>
                <span className={estilos.iconoJuego} data-juego={j.id} aria-hidden="true">
                  {j.icono}
                </span>
                <strong>{j.titulo}</strong>
                <span>{j.descripcion}</span>
              </button>
            </li>
          ))}
        </ul>
        <Boton variante="secundario" onClick={alSalir}>
          Volver a la sala
        </Boton>
      </div>
    );
  }

  const fin = (resultado: { aciertos: number; total: number }) => alCompletar(resultado);
  const comunes = {
    key: `${juego}-${ronda}`,
    alTerminar: fin,
    acciones: (
      <Acciones
        alRepetir={() => setRonda((n) => n + 1)}
        alCambiar={() => setJuego(null)}
        alSalir={alSalir}
      />
    ),
  };

  return (
    <div className={estilos.juego}>
      <button type="button" className={estilos.volver} onClick={() => setJuego(null)}>
        <ArrowLeft aria-hidden="true" size={16} />
        Otros juegos
      </button>
      {juego === 'luciernagas' && <Luciernagas {...comunes} />}
      {juego === 'libros' && <Libros {...comunes} />}
      {juego === 'huerto' && <Huerto {...comunes} />}
    </div>
  );
}

/**
 * Aviso del resultado: estable entre renders y una sola vez por partida (el resultado lo usan
 * los bots de la sala para reaccionar; no se guarda).
 */
function useAvisoFinal(alTerminar: PropsJuego['alTerminar']) {
  const ultimo = useRef(alTerminar);
  const hecho = useRef(false);
  useEffect(() => {
    ultimo.current = alTerminar;
  });
  return useCallback((resultado: { aciertos: number; total: number }) => {
    if (hecho.current) return;
    hecho.current = true;
    ultimo.current(resultado);
  }, []);
}

type PropsJuego = {
  alTerminar: (resultado: { aciertos: number; total: number }) => void;
  acciones: ReactNode;
};

function Acciones({
  alRepetir,
  alCambiar,
  alSalir,
}: {
  alRepetir: () => void;
  alCambiar: () => void;
  alSalir: () => void;
}) {
  return (
    <div className={estilos.acciones}>
      <Boton onClick={alRepetir}>
        <RotateCcw aria-hidden="true" size={16} />
        Jugar otra vez
      </Boton>
      <Boton variante="secundario" onClick={alCambiar}>
        Otro juego
      </Boton>
      <Boton variante="secundario" onClick={alSalir}>
        Volver a la sala
      </Boton>
    </div>
  );
}

function Final({
  titulo,
  children,
  acciones,
}: {
  titulo: string;
  children: ReactNode;
  acciones: ReactNode;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  return (
    <div className={estilos.final}>
      <h3 ref={ref} tabIndex={-1}>
        {titulo}
      </h3>
      <p>{children}</p>
      {acciones}
    </div>
  );
}

// ── Atrapa luciérnagas ──────────────────────────────────────────────────────────────────
const DURACION_LUCIERNAGAS = 25;

type Luciernaga = { id: number; x: number; y: number; t: number };

function Luciernagas({ alTerminar, acciones }: PropsJuego) {
  const avisar = useAvisoFinal(alTerminar);
  const [fase, setFase] = useState<'inicio' | 'jugando' | 'fin'>('inicio');
  const [quedan, setQuedan] = useState(DURACION_LUCIERNAGAS);
  const [luces, setLuces] = useState<Luciernaga[]>([]);
  const [atrapadas, setAtrapadas] = useState(0);
  const [alegre, setAlegre] = useState(0);
  const siguiente = useRef(0);

  useEffect(() => {
    if (fase !== 'jugando') return;
    const reloj = setInterval(() => setQuedan((s) => s - 1), 1000);
    const aparecer = setInterval(() => {
      setLuces((actuales) => {
        const vivas = actuales.filter((l) => performance.now() - l.t < 2800);
        if (vivas.length >= 6) return vivas;
        siguiente.current += 1;
        return [
          ...vivas,
          { id: siguiente.current, x: azar(6, 90), y: azar(10, 78), t: performance.now() },
        ];
      });
    }, 620);
    return () => {
      clearInterval(reloj);
      clearInterval(aparecer);
    };
  }, [fase]);

  useEffect(() => {
    if (fase === 'jugando' && quedan <= 0) {
      const t = setTimeout(() => {
        setFase('fin');
        setLuces([]);
        avisar({ aciertos: atrapadas, total: Math.max(atrapadas, 1) });
      }, 0);
      return () => clearTimeout(t);
    }
  }, [quedan, fase, atrapadas, avisar]);

  const atrapar = (id: number) => {
    setLuces((actuales) => actuales.filter((l) => l.id !== id));
    setAtrapadas((n) => n + 1);
    setAlegre((n) => n + 1);
  };

  if (fase === 'fin') {
    return (
      <Final titulo="¡Amaneció en el valle!" acciones={acciones}>
        Cocuyo reunió a {atrapadas} {atrapadas === 1 ? 'luciérnaga' : 'luciérnagas'} contigo.
      </Final>
    );
  }

  return (
    <div className={estilos.zona}>
      <div className={estilos.marcador} aria-live="polite">
        <span>Luciérnagas: {atrapadas}</span>
        <span>Tiempo: {Math.max(quedan, 0)} s</span>
      </div>
      <div className={estilos.noche}>
        {fase === 'inicio' && (
          <div className={estilos.inicio}>
            <p>Toca las luciérnagas antes de que se apaguen.</p>
            <Boton onClick={() => setFase('jugando')}>Empezar</Boton>
          </div>
        )}
        {luces.map((l) => (
          <button
            key={l.id}
            type="button"
            className={estilos.luciernaga}
            style={{ left: `${l.x}%`, top: `${l.y}%` } as CSSProperties}
            aria-label="Atrapar luciérnaga"
            onClick={() => atrapar(l.id)}
          />
        ))}
        <span key={alegre} className={estilos.cocuyoJuego} aria-hidden="true">
          <Cocuyo tamano={44} expresion={alegre ? 'feliz' : undefined} />
        </span>
      </div>
    </div>
  );
}

// ── Ordena la biblioteca ────────────────────────────────────────────────────────────────
const COLORES_LIBROS = ['#e5534b', '#f2a623', '#17a97e', '#2f9be0', '#7c6cf2', '#c455c8'];

function barajarLibros() {
  const orden = [1, 2, 3, 4, 5, 6];
  do {
    for (let i = orden.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [orden[i], orden[j]] = [orden[j]!, orden[i]!];
    }
  } while (orden.every((n, i) => n === i + 1));
  return orden;
}

function Libros({ alTerminar, acciones }: PropsJuego) {
  const avisar = useAvisoFinal(alTerminar);
  const [libros, setLibros] = useState(barajarLibros);
  const [elegido, setElegido] = useState<number | null>(null);
  const [cambios, setCambios] = useState(0);
  const ordenado = libros.every((n, i) => n === i + 1);

  useEffect(() => {
    if (!ordenado) return;
    const t = setTimeout(() => avisar({ aciertos: 1, total: 1 }), 0);
    return () => clearTimeout(t);
  }, [ordenado, avisar]);

  const tocar = (indice: number) => {
    if (ordenado) return;
    if (elegido === null) {
      setElegido(indice);
      return;
    }
    if (elegido !== indice) {
      setLibros((actuales) => {
        const nuevos = [...actuales];
        [nuevos[elegido], nuevos[indice]] = [nuevos[indice]!, nuevos[elegido]!];
        return nuevos;
      });
      setCambios((n) => n + 1);
    }
    setElegido(null);
  };

  return (
    <div className={estilos.zona}>
      <div className={estilos.marcador} aria-live="polite">
        <span>
          {ordenado
            ? '¡Biblioteca en orden!'
            : elegido === null
              ? 'Toca un libro y luego otro para cambiarlos.'
              : 'Ahora toca el libro con el que lo cambias.'}
        </span>
        <span>Cambios: {cambios}</span>
      </div>
      <LayoutGroup>
        <ol className={estilos.estante} data-listo={ordenado || undefined}>
          {libros.map((altura, i) => (
            <motion.li key={altura} layout transition={RESORTE_INDICADOR}>
              <button
                type="button"
                className={estilos.libro}
                data-elegido={elegido === i || undefined}
                style={
                  {
                    '--alto': `${40 + altura * 10}%`,
                    '--color': COLORES_LIBROS[altura - 1],
                  } as CSSProperties
                }
                aria-pressed={elegido === i}
                aria-label={`Libro de altura ${altura}, en la posición ${i + 1}`}
                onClick={() => tocar(i)}
              >
                <span aria-hidden="true">{altura}</span>
              </button>
            </motion.li>
          ))}
        </ol>
      </LayoutGroup>
      {ordenado && (
        <Final titulo="¡Estantería lista!" acciones={acciones}>
          Ordenaste los libros en {cambios} {cambios === 1 ? 'cambio' : 'cambios'}.
        </Final>
      )}
    </div>
  );
}

// ── Riega el huerto ─────────────────────────────────────────────────────────────────────
const DURACION_HUERTO = 30;
const PLANTAS = 9;

function Huerto({ alTerminar, acciones }: PropsJuego) {
  const avisar = useAvisoFinal(alTerminar);
  const [fase, setFase] = useState<'inicio' | 'jugando' | 'fin'>('inicio');
  const [quedan, setQuedan] = useState(DURACION_HUERTO);
  const [agua, setAgua] = useState<number[]>(() => Array.from({ length: PLANTAS }, () => 2));
  const [regada, setRegada] = useState<{ i: number; vez: number } | null>(null);
  const vivas = agua.filter((a) => a > 0).length;

  useEffect(() => {
    if (fase !== 'jugando') return;
    const reloj = setInterval(() => setQuedan((s) => s - 1), 1000);
    const sol = setInterval(() => {
      setAgua((actual) => {
        const candidatas = actual.map((a, i) => (a > 0 ? i : -1)).filter((i) => i >= 0);
        if (!candidatas.length) return actual;
        const i = candidatas[Math.floor(Math.random() * candidatas.length)]!;
        const nuevo = [...actual];
        nuevo[i] = nuevo[i]! - 1;
        return nuevo;
      });
    }, 1100);
    return () => {
      clearInterval(reloj);
      clearInterval(sol);
    };
  }, [fase]);

  useEffect(() => {
    if (fase === 'jugando' && (quedan <= 0 || vivas === 0)) {
      const t = setTimeout(() => {
        setFase('fin');
        avisar({ aciertos: vivas, total: PLANTAS });
      }, 0);
      return () => clearTimeout(t);
    }
  }, [quedan, vivas, fase, avisar]);

  const regar = (i: number) => {
    if (fase !== 'jugando' || agua[i] === 0) return;
    setAgua((actual) => actual.map((a, j) => (j === i ? Math.min(a + 1, 3) : a)));
    setRegada((r) => ({ i, vez: (r?.vez ?? 0) + 1 }));
  };

  if (fase === 'fin') {
    return (
      <Final
        titulo={vivas === PLANTAS ? '¡Huerto en flor!' : '¡Buen trabajo en el huerto!'}
        acciones={acciones}
      >
        {vivas} de {PLANTAS} plantas llegaron al final del día.
      </Final>
    );
  }

  return (
    <div className={estilos.zona}>
      <div className={estilos.marcador} aria-live="polite">
        <span>Plantas vivas: {vivas}</span>
        <span>Tiempo: {Math.max(quedan, 0)} s</span>
      </div>
      <div className={estilos.huerto}>
        {fase === 'inicio' && (
          <div className={estilos.inicio}>
            <p>Toca una planta para regarla. Si se queda sin agua, se marchita.</p>
            <Boton onClick={() => setFase('jugando')}>Empezar</Boton>
          </div>
        )}
        <ul className={estilos.parcelas}>
          {agua.map((a, i) => (
            <li key={i}>
              <button
                type="button"
                className={estilos.planta}
                data-agua={a}
                disabled={fase !== 'jugando' || a === 0}
                aria-label={
                  a === 0 ? `Planta ${i + 1}, marchita` : `Regar la planta ${i + 1}, agua ${a} de 3`
                }
                onClick={() => regar(i)}
              >
                {regada?.i === i && (
                  <span key={regada.vez} className={estilos.gota} aria-hidden="true">
                    <Droplets size={16} />
                  </span>
                )}
                <Sprout aria-hidden="true" size={30} strokeWidth={2.4} />
                <span className={estilos.nivel} aria-hidden="true">
                  <span style={{ transform: `scaleX(${a / 3})` }} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
