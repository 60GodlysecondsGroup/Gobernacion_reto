'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ACOMPANANTES,
  DURACION_GLOBO_MS,
  ESPERA_PRIMER_MENSAJE_MS,
  mensajesDeRuta,
  PAUSA_ENTRE_MENSAJES_MS,
  type IdAcompanante,
} from '@/config/acompanantes';
import { Chigui } from './Chigui';
import { Cocuyo } from './Cocuyo';
import estilos from './MensajeContextual.module.css';

const CLAVE_SILENCIO = 'cp-consejos-silenciados';
const CLAVE_ULTIMO = 'cp-ultimo-consejo';
const CLAVE_VISTAS = 'cp-consejos-vistos';

// El almacenamiento del navegador puede no estar disponible (modo privado, bloqueos): nunca falla.
const leer = (almacen: 'local' | 'sesion', clave: string) => {
  try {
    return (almacen === 'local' ? localStorage : sessionStorage).getItem(clave);
  } catch {
    return null;
  }
};
const guardar = (almacen: 'local' | 'sesion', clave: string, valor: string | null) => {
  try {
    const destino = almacen === 'local' ? localStorage : sessionStorage;
    if (valor === null) destino.removeItem(clave);
    else destino.setItem(clave, valor);
  } catch {
    /* sin almacenamiento: solo dura mientras la página esté abierta */
  }
};

export const consejosSilenciados = () => leer('local', CLAVE_SILENCIO) === '1';
export const silenciarConsejos = (silenciar: boolean) =>
  guardar('local', CLAVE_SILENCIO, silenciar ? '1' : null);

export function PersonajeAcompanante({ id, tamano }: { id: IdAcompanante; tamano: number }) {
  return id === 'cocuyo' ? <Cocuyo tamano={tamano} /> : <Chigui tamano={tamano} />;
}

/**
 * Globo con un consejo predefinido de la página actual. Aparece solo, como mucho una vez por
 * página y visita, nunca al cargar y con una pausa larga entre globos. Se cierra con su botón o
 * con Escape, se oculta solo si nadie lo usa y puede silenciarse. No roba el foco.
 * Se vuelve a abrir desde la guía («Consejos de esta página»). El componente se monta con
 * `key={ruta}`: al cambiar de página empieza de cero.
 */
export function MensajeContextual({
  bloqueado,
  pedido,
  alCerrarPedido,
}: {
  /** Mientras la guía está abierta no aparece ningún globo. */
  bloqueado: boolean;
  /** Consejo que la persona pidió ver desde la guía (se muestra al instante). */
  pedido: number | null;
  alCerrarPedido: () => void;
}) {
  const ruta = usePathname();
  const mensajes = mensajesDeRuta(ruta);
  const [automatico, setAutomatico] = useState<number | null>(null);
  const [saliendo, setSaliendo] = useState(false);
  const enUso = useRef(false);
  const indice = pedido ?? automatico;

  const ocultar = useCallback(() => {
    setSaliendo(true);
    setTimeout(() => {
      setAutomatico(null);
      setSaliendo(false);
      alCerrarPedido();
    }, 200);
  }, [alCerrarPedido]);

  // Aparición automática, con todas las condiciones para no interrumpir.
  useEffect(() => {
    if (mensajes.length === 0 || consejosSilenciados()) return;
    const vistas = (leer('sesion', CLAVE_VISTAS) ?? '').split('|').filter(Boolean);
    if (vistas.includes(ruta)) return;
    const ultimo = Number(leer('sesion', CLAVE_ULTIMO) ?? 0);
    const espera = Math.max(
      ESPERA_PRIMER_MENSAJE_MS,
      ultimo + PAUSA_ENTRE_MENSAJES_MS - Date.now(),
    );
    const temporizador = setTimeout(() => {
      if (document.visibilityState !== 'visible') return;
      guardar('sesion', CLAVE_VISTAS, [...vistas, ruta].slice(-30).join('|'));
      guardar('sesion', CLAVE_ULTIMO, String(Date.now()));
      setAutomatico(vistas.length % mensajes.length);
    }, espera);
    return () => clearTimeout(temporizador);
  }, [ruta, mensajes.length]);

  // Se oculta solo tras un rato, salvo que la persona lo esté usando.
  useEffect(() => {
    if (indice === null) return;
    const temporizador = setTimeout(() => {
      if (!enUso.current) ocultar();
    }, DURACION_GLOBO_MS);
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') ocultar();
    };
    window.addEventListener('keydown', alPulsar);
    return () => {
      clearTimeout(temporizador);
      window.removeEventListener('keydown', alPulsar);
    };
  }, [indice, ocultar]);

  if (indice === null || bloqueado || !mensajes[indice]) return null;
  const mensaje = mensajes[indice]!;
  const personaje = ACOMPANANTES[mensaje.de];

  return (
    <aside
      className={estilos.globo}
      data-saliendo={saliendo || undefined}
      aria-label={`Consejo de ${personaje.nombre}`}
      onMouseEnter={() => (enUso.current = true)}
      onMouseLeave={() => (enUso.current = false)}
      onFocus={() => (enUso.current = true)}
      onBlur={() => (enUso.current = false)}
    >
      <div className={estilos.personaje} data-personaje={mensaje.de} aria-hidden="true">
        <PersonajeAcompanante id={mensaje.de} tamano={40} />
      </div>
      <div className={estilos.contenido}>
        <p className={estilos.quien}>
          <strong>{personaje.nombre}</strong>
          <span>Asistente virtual · mensaje automático</span>
        </p>
        <p className={estilos.texto} role="status">
          {mensaje.texto}
        </p>
        <div className={estilos.acciones}>
          {mensaje.accion && (
            <Link href={mensaje.accion.href} className={estilos.accion} onClick={ocultar}>
              {mensaje.accion.texto}
            </Link>
          )}
          {mensajes.length > 1 && (
            <button
              type="button"
              className={estilos.secundaria}
              onClick={() => {
                setAutomatico((indice + 1) % mensajes.length);
                alCerrarPedido();
              }}
            >
              Otro consejo
            </button>
          )}
          <button
            type="button"
            className={estilos.secundaria}
            onClick={() => {
              silenciarConsejos(true);
              ocultar();
            }}
          >
            No mostrar más
          </button>
        </div>
      </div>
      <button type="button" className={estilos.cerrar} onClick={ocultar}>
        <X aria-hidden="true" size={16} />
        <span className="visualmente-oculto">Cerrar consejo</span>
      </button>
    </aside>
  );
}
