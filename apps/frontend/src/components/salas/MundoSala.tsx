'use client';

import { Check, X } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PersonajeAcompanante } from '@/components/guia/MensajeContextual';
import { Minijuego } from '@/components/juegos/Minijuego';
import { ModalFicha } from '@/components/orientacion/ModalFicha';
import { ACOMPANANTES, type IdAcompanante } from '@/config/acompanantes';
import { JUEGOS, type Juego } from '@/config/juegos';
import {
  MENSAJES_BOTS,
  MENSAJES_SALA,
  OBJETOS_SALA,
  mundoDeSala,
  type IdObjetoSala,
} from '@/config/salas-mundo';
import type { Obstaculo } from '@/lib/api/salas';
import { geometriaEscenario } from './Escenario2D';
import estilos from './MundoSala.module.css';
import { ObjetoArte } from './ObjetoArte';
import { RetosRapidos } from './RetosRapidos';
import { ConectarIdeas, EstadoAnimo, OrdenarIdeas } from './TareasRapidas';

type Celda = { x: number; y: number };
type EstadoBot = Celda & { izquierda: boolean; caminando: boolean };
type Globo = { bot: number; texto: string; tono: 'normal' | 'logro' };

const PASO_MS = 520;
const DURACION_GLOBO_MS = 9000;

const clave = (c: Celda) => `${c.x},${c.y}`;

/** Camino más corto entre dos casillas libres (búsqueda en anchura sobre la cuadrícula). */
function ruta(desde: Celda, hasta: Celda, ancho: number, alto: number, ocupadas: Set<string>) {
  const previo = new Map<string, Celda | null>([[clave(desde), null]]);
  const cola: Celda[] = [desde];
  while (cola.length) {
    const actual = cola.shift()!;
    if (actual.x === hasta.x && actual.y === hasta.y) break;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const n = { x: actual.x + dx, y: actual.y + dy };
      if (n.x < 0 || n.y < 0 || n.x >= ancho || n.y >= alto) continue;
      if (ocupadas.has(clave(n)) || previo.has(clave(n))) continue;
      previo.set(clave(n), actual);
      cola.push(n);
    }
  }
  if (!previo.has(clave(hasta))) return [];
  const camino: Celda[] = [];
  for (let c: Celda | null = hasta; c && clave(c) !== clave(desde); c = previo.get(clave(c)) ?? null)
    camino.unshift(c);
  return camino;
}

/** La casilla libre más cercana a un punto de referencia. */
function libreCercana(objetivo: Celda, libres: Celda[]) {
  return libres.reduce((mejor, c) =>
    Math.abs(c.x - objetivo.x) + Math.abs(c.y - objetivo.y) <
    Math.abs(mejor.x - objetivo.x) + Math.abs(mejor.y - objetivo.y)
      ? c
      : mejor,
  );
}

function elegirAlAzar<T>(lista: T[], cuantos: number): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  }
  return copia.slice(0, cuantos);
}

/**
 * El mundo de la sala, encima del escenario: objetos interactivos en la pared y dos bots que
 * caminan por el suelo. Los bots son personajes del frontend con mensajes predefinidos: no son
 * participantes, no ocupan casillas para el servidor y no conversan. Las actividades son locales.
 */
export function MundoSala({
  sala,
  ancho,
  alto,
  obstaculos,
  pared,
  personas,
}: {
  sala: string;
  ancho: number;
  alto: number;
  obstaculos: Obstaculo[];
  pared: number;
  /** Casillas con personas: los bots no se paran encima ni las atraviesan. */
  personas: Celda[];
}) {
  const mundo = mundoDeSala(sala);
  const geo = geometriaEscenario(ancho, alto, pared);
  const reducir = useReducedMotion();
  const personajes: IdAcompanante[] = useMemo(
    () => [mundo.personaje, mundo.personaje === 'cocuyo' ? 'chigui' : 'cocuyo'],
    [mundo.personaje],
  );

  // ── Recorridos de los bots: puntos de paso sobre casillas libres ──
  const ocupadas = useMemo(() => new Set(obstaculos.map(clave)), [obstaculos]);
  const recorridos = useMemo(() => {
    const libres: Celda[] = [];
    for (let y = 0; y < alto; y++)
      for (let x = 0; x < ancho; x++) if (!ocupadas.has(clave({ x, y }))) libres.push({ x, y });
    if (!libres.length) return [[], []] as Celda[][];
    const a = (x: number, y: number) => libreCercana({ x: Math.round(x), y: Math.round(y) }, libres);
    return [
      [a(2, alto - 1), a(ancho * 0.35, 1), a(ancho * 0.5, alto - 1), a(2, 1)],
      [a(ancho - 2, 1), a(ancho * 0.65, alto - 2), a(ancho - 1, alto - 1), a(ancho * 0.75, 1)],
    ];
  }, [ancho, alto, ocupadas]);

  // Cada bot empieza en su primer punto de paso que no tenga a una persona encima.
  const [bots, setBots] = useState<EstadoBot[]>(() => {
    const iniciales = new Set(personas.map(clave));
    return recorridos.map((r) => ({
      ...(r.find((c) => !iniciales.has(clave(c))) ?? r[0] ?? { x: 0, y: 0 }),
      izquierda: false,
      caminando: false,
    }));
  });
  const [globo, setGlobo] = useState<Globo | null>(null);
  const [saltos, setSaltos] = useState([0, 0]);
  const capa = useRef<HTMLDivElement>(null);
  const conPersonas = useRef(new Set<string>());
  useEffect(() => {
    conPersonas.current = new Set(personas.map(clave));
  }, [personas]);
  const pausa = useRef(false);
  const hablando = useRef<number | null>(null);
  const turnoMensaje = useRef([0, 0]);
  const temporizadoresGlobo = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Sin caminar mientras el escenario no se ve o la pestaña está oculta.
  useEffect(() => {
    const nodo = capa.current;
    if (!nodo) return;
    let fuera = false;
    const actualizar = () => (pausa.current = fuera || document.hidden);
    const observador = new IntersectionObserver(([e]) => {
      fuera = !e?.isIntersecting;
      actualizar();
    });
    observador.observe(nodo);
    document.addEventListener('visibilitychange', actualizar);
    return () => {
      observador.disconnect();
      document.removeEventListener('visibilitychange', actualizar);
    };
  }, []);

  // Caminatas cortas entre puntos de paso, con pausas. Con «reducir movimiento» se quedan quietos.
  useEffect(() => {
    if (reducir) return;
    const pendientes = new Set<ReturnType<typeof setTimeout>>();
    const programar = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        pendientes.delete(id);
        fn();
      }, ms);
      pendientes.add(id);
    };
    recorridos.forEach((puntos, b) => {
      if (puntos.length < 2) return;
      // Mismo punto de partida que el estado inicial.
      let destino = Math.max(0, puntos.findIndex((c) => !conPersonas.current.has(clave(c))));
      let pos = puntos[destino]!;
      const tramo = () => {
        if (pausa.current || hablando.current === b) return programar(tramo, 1200);
        destino = (destino + 1) % puntos.length;
        const bloqueadas = new Set([...ocupadas, ...conPersonas.current]);
        bloqueadas.delete(clave(pos));
        const camino = ruta(pos, puntos[destino]!, ancho, alto, bloqueadas);
        let i = 0;
        const paso = () => {
          if (pausa.current || hablando.current === b) {
            setBots((prev) => prev.map((e, k) => (k === b ? { ...e, caminando: false } : e)));
            return programar(paso, 900);
          }
          const siguiente = camino[i];
          // Si una persona está en el camino, el bot espera y luego busca otra ruta.
          if (siguiente && conPersonas.current.has(clave(siguiente))) {
            setBots((prev) => prev.map((e, k) => (k === b ? { ...e, caminando: false } : e)));
            return programar(tramo, 1400);
          }
          i++;
          if (!siguiente) {
            setBots((prev) => prev.map((e, k) => (k === b ? { ...e, caminando: false } : e)));
            return programar(tramo, 2600 + b * 1400 + (destino % 2) * 1800);
          }
          const izquierda = siguiente.x < pos.x;
          const derecha = siguiente.x > pos.x;
          pos = siguiente;
          setBots((prev) =>
            prev.map((e, k) =>
              k === b
                ? { ...siguiente, izquierda: izquierda || (!derecha && e.izquierda), caminando: true }
                : e,
            ),
          );
          programar(paso, PASO_MS);
        };
        paso();
      };
      programar(tramo, 2200 + b * 1600);
    });
    return () => pendientes.forEach(clearTimeout);
  }, [reducir, recorridos, ancho, alto, ocupadas]);

  // ── Globos de diálogo ──
  const limpiarGlobo = () => {
    temporizadoresGlobo.current.forEach(clearTimeout);
    temporizadoresGlobo.current = [];
  };

  const decir = useCallback((bot: number, texto: string, tono: Globo['tono'] = 'normal') => {
    limpiarGlobo();
    hablando.current = bot;
    setGlobo({ bot, texto, tono });
    setSaltos((s) => s.map((n, k) => (k === bot ? n + 1 : n)));
    temporizadoresGlobo.current.push(
      setTimeout(() => {
        hablando.current = null;
        setGlobo(null);
      }, DURACION_GLOBO_MS),
    );
  }, []);

  const cerrarGlobo = () => {
    limpiarGlobo();
    hablando.current = null;
    setGlobo(null);
  };

  // Saludo una sola vez al entrar.
  useEffect(() => {
    const t = setTimeout(() => decir(0, MENSAJES_BOTS.saludo), 1500);
    return () => {
      clearTimeout(t);
      limpiarGlobo();
    };
  }, [decir]);

  const mensajesDe = (bot: number) =>
    bot === 0
      ? [MENSAJES_BOTS.saludo, MENSAJES_BOTS.explorar, mundo.frase]
      : [MENSAJES_BOTS.privacidad, ...MENSAJES_SALA.consejos.slice(0, 3)];

  const hablarCon = (bot: number) => {
    const lista = mensajesDe(bot);
    // No repite el mensaje que acaba de decir.
    let i = turnoMensaje.current[bot]! % lista.length;
    if (globo?.bot === bot && globo.texto === lista[i]) i = (i + 1) % lista.length;
    turnoMensaje.current[bot] = i + 1;
    decir(bot, lista[i]!);
  };

  // ── Objetos y actividades ──
  const [activo, setActivo] = useState<IdObjetoSala | null>(null);
  const [juego, setJuego] = useState<Juego | null>(null);
  const [completados, setCompletados] = useState<IdObjetoSala[]>([]);
  const [tocado, setTocado] = useState<{ id: IdObjetoSala; vez: number } | null>(null);
  const resultado = useRef<{ aciertos: number; total: number } | null>(null);
  const objeto = OBJETOS_SALA.find((o) => o.id === activo);

  const abrir = (id: IdObjetoSala) => {
    const o = OBJETOS_SALA.find((x) => x.id === id)!;
    // Versiones cortas (5 a 10 segundos) de los juegos de decisiones.
    if (o.tarea === 'que-harias') {
      const base = JUEGOS.find((j) => j.id === 'que-harias')!;
      setJuego({ ...base, pasos: elegirAlAzar(base.pasos, 1) });
    } else if (o.tarea === 'detecta') {
      const base = JUEGOS.find((j) => j.id === 'detecta-el-riesgo')!;
      setJuego({ ...base, pasos: elegirAlAzar(base.pasos, 3) });
    } else setJuego(null);
    resultado.current = null;
    setTocado((t) => ({ id, vez: (t?.vez ?? 0) + 1 }));
    setActivo(id);
  };

  const completar = (r: { aciertos: number; total: number }) => {
    resultado.current = r;
    if (activo) setCompletados((l) => (l.includes(activo) ? l : [...l, activo]));
  };

  const cerrar = () => {
    setActivo(null);
    if (!resultado.current) return;
    resultado.current = null;
    decir(0, MENSAJES_BOTS.logro, 'logro');
    temporizadoresGlobo.current.push(setTimeout(() => decir(1, MENSAJES_BOTS.otro), 5200));
  };

  const contenido = (() => {
    if (!objeto) return null;
    const comunes = { alSalir: cerrar, alCompletar: completar };
    switch (objeto.tarea) {
      case 'conectar':
        return <ConectarIdeas key={tocado?.vez} {...comunes} />;
      case 'ordenar':
        return <OrdenarIdeas key={tocado?.vez} {...comunes} />;
      case 'animo':
        return <EstadoAnimo key={tocado?.vez} {...comunes} />;
      case 'retos':
        return <RetosRapidos key={tocado?.vez} {...comunes} />;
      default:
        return juego ? (
          <Minijuego
            key={tocado?.vez}
            juego={juego}
            alSalir={cerrar}
            alCompletar={completar}
            textoSalir="Volver a la sala"
          />
        ) : null;
    }
  })();

  const lado = (x: number) => (x < ancho / 3 ? 'izq' : x > (ancho * 2) / 3 ? 'der' : 'centro');

  return (
    <>
      {/* Pared: objetos interactivos */}
      <div
        className={estilos.capaPared}
        style={{
          left: `${geo.pared.izquierda}%`,
          width: `${geo.suelo.ancho}%`,
          height: `${geo.pared.alto}%`,
        }}
      >
        <ul className={estilos.objetos} aria-label="Objetos interactivos de la sala">
          {OBJETOS_SALA.map((o, i) => {
            const hecho = completados.includes(o.id);
            return (
              <li
                key={o.id}
                className={estilos.ranura}
                style={{ left: `${((i + 0.5) / OBJETOS_SALA.length) * 100}%` }}
              >
                <button
                  type="button"
                  className={estilos.objeto}
                  data-tocado={tocado?.id === o.id ? tocado.vez % 2 : undefined}
                  aria-label={`${o.objeto}: ${o.titulo}${hecho ? ' (completada)' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    abrir(o.id);
                  }}
                >
                  <ObjetoArte id={o.id} />
                  <span className={hecho ? estilos.hecho : estilos.indicador} aria-hidden="true">
                    {hecho && <Check size={9} strokeWidth={4} />}
                  </span>
                  <span className={estilos.etiqueta} aria-hidden="true">
                    {o.titulo}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Suelo: bots que caminan */}
      <div
        ref={capa}
        className={estilos.capaSuelo}
        style={{
          left: `${geo.suelo.izquierda}%`,
          top: `${geo.suelo.arriba}%`,
          width: `${geo.suelo.ancho}%`,
          height: `${geo.suelo.alto}%`,
        }}
      >
        {bots.map((b, i) => {
          const datos = ACOMPANANTES[personajes[i]!];
          const habla = globo?.bot === i;
          return (
            <div
              key={i}
              className={estilos.bot}
              data-caminando={b.caminando || undefined}
              style={{
                width: `${100 / ancho}%`,
                height: `${100 / alto}%`,
                transform: `translate(${b.x * 100}%, ${b.y * 100}%)`,
                ['--retraso' as string]: `${400 + i * 350}ms`,
              }}
            >
              {habla && globo && (
                <div
                  className={estilos.globo}
                  data-lado={lado(b.x)}
                  data-abajo={b.y < 1 || undefined}
                  data-tono={globo.tono}
                >
                  <p className={estilos.quien}>
                    <strong>{datos.nombre}</strong> · Bot de la sala, mensaje automático
                  </p>
                  <p role="status" className={estilos.textoGlobo}>
                    {globo.texto}
                  </p>
                  <button
                    type="button"
                    className={estilos.cerrarGlobo}
                    aria-label={`Cerrar el mensaje de ${datos.nombre}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      cerrarGlobo();
                    }}
                  >
                    <X aria-hidden="true" size={14} />
                  </button>
                </div>
              )}
              <button
                type="button"
                className={estilos.cuerpoBot}
                data-izquierda={b.izquierda || undefined}
                aria-label={`${datos.nombre}, bot de la sala: escuchar un mensaje`}
                onClick={(e) => {
                  e.stopPropagation();
                  hablarCon(i);
                }}
              >
                <span key={saltos[i]} className={estilos.salto}>
                  <span className={estilos.sprite}>
                    <PersonajeAcompanante id={personajes[i]!} tamano={32} />
                  </span>
                </span>
                <span className={estilos.placa} aria-hidden="true">
                  {datos.nombre}
                  <em>bot</em>
                </span>
              </button>
            </div>
          );
        })}
      </div>

      <ModalFicha
        abierto={activo !== null}
        alCerrar={cerrar}
        icono={activo ? <span className={estilos.iconoModal}><ObjetoArte id={activo} /></span> : null}
        antetitulo={objeto ? `${objeto.objeto} · ${sala}` : ''}
        titulo={objeto?.titulo ?? ''}
      >
        {objeto && <p className={estilos.instruccion}>{objeto.instruccion}</p>}
        {contenido}
      </ModalFicha>
    </>
  );
}
