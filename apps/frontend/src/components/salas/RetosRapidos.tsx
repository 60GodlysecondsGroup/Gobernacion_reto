'use client';

import { RotateCcw, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Minijuego } from '@/components/juegos/Minijuego';
import { Boton } from '@/components/ui';
import { PAREJAS_RETO, PREGUNTAS_RAPIDAS } from '@/config/juegos';
import estilos from './Rincon.module.css';

type Carta = { clave: string; pareja: string; texto: string; tipo: 'concepto' | 'significado' };

const barajar = (): Carta[] => {
  const cartas: Carta[] = PAREJAS_RETO.flatMap((p) => [
    { clave: `${p.id}-c`, pareja: p.id, texto: p.concepto, tipo: 'concepto' as const },
    { clave: `${p.id}-s`, pareja: p.id, texto: p.significado, tipo: 'significado' as const },
  ]);
  for (let i = cartas.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cartas[i], cartas[j]] = [cartas[j]!, cartas[i]!];
  }
  return cartas;
};

/**
 * «Retos rápidos»: primero memoria y asociación (cada concepto con su significado) y después tres
 * preguntas cortas. Todo ocurre en el navegador: no se guarda ni se comparte ningún resultado.
 */
export function RetosRapidos({
  alSalir,
  alCompletar,
}: {
  alSalir: () => void;
  alCompletar: (resultado: { aciertos: number; total: number }) => void;
}) {
  const [etapa, setEtapa] = useState<'memoria' | 'pausa' | 'preguntas'>('memoria');
  const [cartas, setCartas] = useState(barajar);
  const [volteadas, setVolteadas] = useState<number[]>([]);
  const [encontradas, setEncontradas] = useState<string[]>([]);
  const [intentos, setIntentos] = useState(0);
  const [aviso, setAviso] = useState('Toca dos cartas para encontrar un concepto y su significado.');
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);
  const total = PAREJAS_RETO.length;

  useEffect(() => () => clearTimeout(temporizador.current), []);

  const voltear = (indice: number) => {
    const carta = cartas[indice]!;
    if (volteadas.length === 2 || volteadas.includes(indice) || encontradas.includes(carta.pareja))
      return;
    const nuevas = [...volteadas, indice];
    setVolteadas(nuevas);
    if (nuevas.length < 2) return;

    setIntentos((n) => n + 1);
    const [a, b] = nuevas.map((i) => cartas[i]!);
    if (a!.pareja === b!.pareja) {
      setAviso(`¡Pareja encontrada! ${PAREJAS_RETO.find((p) => p.id === a!.pareja)!.concepto}.`);
      temporizador.current = setTimeout(() => {
        const todas = [...encontradas, a!.pareja];
        setEncontradas(todas);
        setVolteadas([]);
        if (todas.length === total) setEtapa('pausa');
      }, 420);
    } else {
      setAviso('No son pareja. Recuerda dónde estaban e intenta de nuevo.');
      temporizador.current = setTimeout(() => setVolteadas([]), 950);
    }
  };

  const reiniciar = () => {
    clearTimeout(temporizador.current);
    setCartas(barajar());
    setVolteadas([]);
    setEncontradas([]);
    setIntentos(0);
    setAviso('Toca dos cartas para encontrar un concepto y su significado.');
    setEtapa('memoria');
  };

  if (etapa === 'preguntas') {
    return (
      <Minijuego
        juego={PREGUNTAS_RAPIDAS}
        alSalir={alSalir}
        alCompletar={alCompletar}
        textoSalir="Volver a la sala"
      />
    );
  }

  if (etapa === 'pausa') {
    return (
      <div className={estilos.pausaReto}>
        <span className={estilos.iconoPausa} aria-hidden="true">
          <Sparkles size={26} />
        </span>
        <h2 tabIndex={-1} ref={(el) => el?.focus({ preventScroll: true })}>
          ¡Parejas completas en {intentos} intentos!
        </h2>
        <p>Ahora, tres preguntas rápidas para cerrar el reto.</p>
        <div className={estilos.accionesReto}>
          <Boton onClick={() => setEtapa('preguntas')}>Seguir con las preguntas</Boton>
          <Boton variante="secundario" onClick={reiniciar}>
            <RotateCcw aria-hidden="true" size={16} />
            Jugar las parejas otra vez
          </Boton>
        </div>
      </div>
    );
  }

  return (
    <div className={estilos.memoria}>
      <div className={estilos.cabeceraMemoria}>
        <p>
          Parejas {encontradas.length} de {total} · {intentos} intentos
        </p>
        <div
          className={estilos.progresoMemoria}
          role="progressbar"
          aria-label="Parejas encontradas"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={encontradas.length}
        >
          <span style={{ transform: `scaleX(${encontradas.length / total})` }} />
        </div>
      </div>
      <ul className={estilos.cartas}>
        {cartas.map((carta, i) => {
          const hallada = encontradas.includes(carta.pareja);
          const visible = hallada || volteadas.includes(i);
          return (
            <li key={carta.clave}>
              <button
                type="button"
                className={estilos.carta}
                data-visible={visible || undefined}
                data-hallada={hallada || undefined}
                data-tipo={carta.tipo}
                aria-label={visible ? carta.texto : `Carta ${i + 1}, boca abajo`}
                aria-pressed={visible}
                disabled={hallada}
                onClick={() => voltear(i)}
              >
                <span className={estilos.caraOculta} aria-hidden="true">
                  ?
                </span>
                <span className={estilos.caraVisible} aria-hidden="true">
                  {carta.texto}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className={estilos.avisoMemoria} aria-live="polite">
        {aviso}
      </p>
    </div>
  );
}
