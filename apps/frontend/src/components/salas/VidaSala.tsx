'use client';

import { useMemo, useSyncExternalStore, type CSSProperties } from 'react';
import { geometriaEscenario } from './Escenario2D';
import type { EntradaChat, ParticipanteVivo } from './useSalaEnVivo';
import estilos from './VidaSala.module.css';

/** Mensajes recientes que pueden mostrarse como burbuja (el resto ya pasó de largo). */
const VENTANA_BURBUJAS = 12;
/** Largo máximo del texto en la burbuja: el mensaje completo está en el chat. */
const LARGO_BURBUJA = 70;

type Momento = 'manana' | 'tarde' | 'atardecer' | 'noche';

/** Momento del día según la hora local de quien mira. */
function momentoActual(): Momento {
  const hora = new Date().getHours();
  if (hora >= 6 && hora < 12) return 'manana';
  if (hora >= 12 && hora < 17) return 'tarde';
  if (hora >= 17 && hora < 19) return 'atardecer';
  return 'noche';
}

/** Se revisa cada minuto: así el ambiente cambia solo si la sala sigue abierta al pasar la hora. */
function suscribirMinuto(avisar: () => void) {
  const intervalo = setInterval(avisar, 60_000);
  return () => clearInterval(intervalo);
}

const enServidor = (): Momento => 'tarde';

/** Motas de ambiente: posición y ritmo fijos (sin azar en el render). */
const MOTAS = [
  { x: 12, y: 70, d: 0, t: 9 },
  { x: 28, y: 40, d: 2.4, t: 11 },
  { x: 47, y: 62, d: 1.1, t: 10 },
  { x: 63, y: 35, d: 3.6, t: 12 },
  { x: 78, y: 58, d: 0.7, t: 9.5 },
  { x: 90, y: 44, d: 2.9, t: 11.5 },
];

/**
 * Vida de la escena, encima del escenario y sin tocar lo que decide el servidor:
 *  - Burbujas: el último mensaje de cada persona aparece unos segundos sobre su avatar (y lo
 *    sigue al caminar). El mensaje completo sigue en el chat, que es el que lo anuncia.
 *  - Llegadas: «¡Llegó …!» breve arriba de la escena (el chat ya lo anuncia a lectores).
 *  - Ambiente: la luz cambia con la hora real (mañana, tarde, atardecer, noche) y unas pocas
 *    motas flotan despacio; de noche son luciérnagas. Con «reducir movimiento» no flotan.
 * Todo es decorativo (`aria-hidden`) y no captura clics: tocar el suelo sigue moviendo el avatar.
 */
export function VidaSala({
  ancho,
  alto,
  pared,
  participantes,
  chat,
  llegada,
}: {
  ancho: number;
  alto: number;
  pared: number;
  participantes: ParticipanteVivo[];
  chat: EntradaChat[];
  llegada: { alias: string; vez: number } | null;
}) {
  const momento = useSyncExternalStore(suscribirMinuto, momentoActual, enServidor);
  const geo = geometriaEscenario(ancho, alto, pared);

  // Último mensaje de cada autor entre los recientes.
  const ultimos = useMemo(() => {
    const porAutor = new Map<string, { id: string; texto: string }>();
    for (const entrada of chat.slice(-VENTANA_BURBUJAS)) {
      if (entrada.tipo === 'mensaje') porAutor.set(entrada.autor.id, entrada);
    }
    return porAutor;
  }, [chat]);

  return (
    <div className={estilos.vida} aria-hidden="true">
      <div className={estilos.ambiente} data-momento={momento}>
        {MOTAS.map((m, i) => (
          <span
            key={i}
            className={estilos.mota}
            style={
              {
                left: `${m.x}%`,
                top: `${m.y}%`,
                '--retraso': `${m.d}s`,
                '--duracion': `${m.t}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div
        className={estilos.capaBurbujas}
        style={{
          left: `${geo.suelo.izquierda}%`,
          top: `${geo.suelo.arriba}%`,
          width: `${geo.suelo.ancho}%`,
          height: `${geo.suelo.alto}%`,
        }}
      >
        {participantes.map((p) => {
          const mensaje = ultimos.get(p.id);
          if (!mensaje) return null;
          const texto =
            mensaje.texto.length > LARGO_BURBUJA
              ? `${mensaje.texto.slice(0, LARGO_BURBUJA - 1).trimEnd()}…`
              : mensaje.texto;
          return (
            <div
              key={p.id}
              className={estilos.celda}
              style={{
                width: `${100 / ancho}%`,
                height: `${100 / alto}%`,
                transform: `translate(${p.x * 100}%, ${p.y * 100}%)`,
              }}
            >
              {/* `key` por mensaje: cada mensaje nuevo vuelve a mostrar la burbuja. */}
              <p
                key={mensaje.id}
                className={estilos.burbuja}
                data-lado={p.x < 2 ? 'izquierda' : p.x > ancho - 3 ? 'derecha' : undefined}
              >
                {texto}
              </p>
            </div>
          );
        })}
      </div>

      {llegada && (
        <p key={llegada.vez} className={estilos.llegada}>
          ¡Llegó {llegada.alias}!
        </p>
      )}
    </div>
  );
}
