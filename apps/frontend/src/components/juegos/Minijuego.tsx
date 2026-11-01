'use client';

import { ArrowRight, Check, CircleAlert, RotateCcw, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Chigui } from '@/components/guia/Chigui';
import { Boton } from '@/components/ui';
import { CLIMA_INICIAL, type Juego } from '@/config/juegos';
import estilos from './Juegos.module.css';

const limitar = (valor: number) => Math.max(0, Math.min(100, valor));

const resultadoClima = (clima: number) =>
  clima >= 80
    ? 'La comunidad quedó acogedora y segura. ¡Así dan ganas de volver!'
    : clima >= 50
      ? 'La comunidad va bien. Algunas decisiones podrían cuidarla todavía más.'
      : 'La comunidad quedó tensa. Prueba otras decisiones y mira cómo cambia.';

/**
 * Motor de los minijuegos: un paso a la vez, retroalimentación inmediata con la explicación,
 * indicador de progreso y resumen final. No guarda puntajes ni envía nada: todo vive en la página.
 */
export function Minijuego({
  juego,
  alSalir,
  alCompletar,
  textoSalir = 'Elegir otro juego',
}: {
  juego: Juego;
  alSalir: () => void;
  /** Avisa al terminar (por ejemplo, para que el personaje de la sala reaccione). */
  alCompletar?: (resultado: { aciertos: number; total: number }) => void;
  textoSalir?: string;
}) {
  const [paso, setPaso] = useState(0);
  const [elegida, setElegida] = useState<number | null>(null);
  const [aciertos, setAciertos] = useState(0);
  const [clima, setClima] = useState(CLIMA_INICIAL);
  const [terminado, setTerminado] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);

  const actual = juego.pasos[paso]!;
  const total = juego.pasos.length;
  const opcion = elegida !== null ? actual.opciones[elegida] : null;
  const progreso = ((paso + (elegida !== null ? 1 : 0)) / total) * 100;

  // Cada pregunta nueva (y el resultado) recibe el foco del lector de pantalla. Si quedó fuera de
  // la vista —en móvil el botón «Siguiente» suele estar abajo— se desplaza solo lo necesario.
  useEffect(() => {
    const el = titulo.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    // Dentro de un panel (las actividades de una sala) solo se desplaza el panel.
    if (el.closest('dialog')) {
      el.scrollIntoView({ block: 'nearest' });
      return;
    }
    const encabezado =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--alto-encabezado')) *
        16 || 80;
    const { top } = el.getBoundingClientRect();
    if (top < encabezado || top > window.innerHeight * 0.6) {
      const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({
        top: window.scrollY + top - encabezado - 24,
        behavior: reducido ? 'auto' : 'smooth',
      });
    }
  }, [paso, terminado]);

  const elegir = (indice: number) => {
    if (elegida !== null) return;
    const o = actual.opciones[indice]!;
    setElegida(indice);
    if (o.correcta) setAciertos((n) => n + 1);
    if (juego.conMedidor) setClima((c) => limitar(c + (o.impacto ?? 0)));
  };

  const siguiente = () => {
    if (paso + 1 >= total) {
      setTerminado(true);
      alCompletar?.({ aciertos, total });
    }
    else {
      setPaso(paso + 1);
      setElegida(null);
    }
  };

  const reiniciar = () => {
    setPaso(0);
    setElegida(null);
    setAciertos(0);
    setClima(CLIMA_INICIAL);
    setTerminado(false);
  };

  if (terminado) {
    const excelente = aciertos === total;
    return (
      <section className={estilos.final} aria-labelledby="final-juego">
        {excelente && <Celebracion />}
        <div className={estilos.personajeFinal} aria-hidden="true">
          <Chigui tamano={72} />
        </div>
        <h2 id="final-juego" ref={titulo} tabIndex={-1} className={estilos.tituloFinal}>
          {excelente ? '¡Excelente!' : '¡Juego completado!'}
        </h2>
        <p className={estilos.puntaje}>
          Elegiste la opción recomendada en <strong>{aciertos}</strong> de {total} situaciones.
        </p>
        {juego.conMedidor && (
          <>
            <Medidor clima={clima} />
            <p className={estilos.textoFinal}>{resultadoClima(clima)}</p>
          </>
        )}
        <p className={estilos.privado}>Tu resultado no se guarda ni se comparte.</p>
        <div className={estilos.botonesFinal}>
          <Boton onClick={reiniciar}>
            <RotateCcw aria-hidden="true" size={18} />
            Volver a jugar
          </Boton>
          <Boton variante="secundario" onClick={alSalir}>
            {textoSalir}
          </Boton>
        </div>
      </section>
    );
  }

  return (
    <section className={estilos.partida} aria-labelledby="enunciado-juego">
      <div className={estilos.cabeceraPartida}>
        <p className={estilos.contador}>
          Situación {paso + 1} de {total}
        </p>
        <div
          className={estilos.progreso}
          role="progressbar"
          aria-label="Progreso del juego"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={paso + (elegida !== null ? 1 : 0)}
        >
          <span style={{ transform: `scaleX(${progreso / 100})` }} />
        </div>
        {juego.conMedidor && <Medidor clima={clima} compacto />}
      </div>

      <div key={paso} className={estilos.tarjetaPaso}>
        <h2 id="enunciado-juego" ref={titulo} tabIndex={-1} className={estilos.enunciado}>
          {actual.enunciado}
        </h2>
        <ul className={estilos.opciones}>
          {actual.opciones.map((o, i) => {
            const estado =
              elegida === null
                ? undefined
                : o.correcta
                  ? 'recomendada'
                  : i === elegida
                    ? 'elegida'
                    : 'otra';
            return (
              <li key={o.texto}>
                <button
                  type="button"
                  className={estilos.opcion}
                  data-estado={estado}
                  aria-pressed={elegida === i}
                  disabled={elegida !== null && elegida !== i && !o.correcta}
                  onClick={() => elegir(i)}
                >
                  <span className={estilos.marca} aria-hidden="true">
                    {estado === 'recomendada' ? (
                      <Check size={16} strokeWidth={3} />
                    ) : estado === 'elegida' ? (
                      <CircleAlert size={16} />
                    ) : (
                      String.fromCharCode(65 + i)
                    )}
                  </span>
                  {o.texto}
                </button>
              </li>
            );
          })}
        </ul>

        <div aria-live="polite">
          {opcion && (
            <div
              className={estilos.retro}
              data-tono={opcion.correcta ? 'bien' : 'revisar'}
              role="status"
            >
              <p className={estilos.tituloRetro}>
                {opcion.correcta ? (
                  <>
                    <Sparkles aria-hidden="true" size={18} />
                    ¡Buena decisión!
                  </>
                ) : (
                  <>
                    <CircleAlert aria-hidden="true" size={18} />
                    Hay una opción mejor
                  </>
                )}
                {juego.conMedidor && opcion.impacto !== undefined && opcion.impacto !== 0 && (
                  <span className={estilos.impacto}>
                    Clima {opcion.impacto > 0 ? `+${opcion.impacto}` : opcion.impacto}
                  </span>
                )}
              </p>
              <p>{opcion.explicacion}</p>
              <Boton onClick={siguiente} tamano="sm">
                {paso + 1 >= total ? 'Ver resultado' : 'Siguiente situación'}
                <ArrowRight aria-hidden="true" size={16} />
              </Boton>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** «Clima de la comunidad»: una barra que se llena según las decisiones. */
function Medidor({ clima, compacto = false }: { clima: number; compacto?: boolean }) {
  return (
    <div className={estilos.medidor} data-compacto={compacto || undefined}>
      <span className={estilos.etiquetaMedidor}>Clima de la comunidad</span>
      <div
        className={estilos.barraMedidor}
        role="meter"
        aria-label="Clima de la comunidad"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clima}
      >
        <span style={{ transform: `scaleX(${clima / 100})` }} />
      </div>
      <span className={estilos.valorMedidor}>{clima}%</span>
    </div>
  );
}

/** Pequeña celebración al completar todo bien: piezas que caen una vez (solo transform/opacity). */
function Celebracion() {
  return (
    <div className={estilos.celebracion} aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} style={{ ['--i' as string]: i }} />
      ))}
    </div>
  );
}
