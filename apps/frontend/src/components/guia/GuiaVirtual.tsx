'use client';

import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ACOMPANANTES, mensajesDeRuta } from '@/config/acompanantes';
import { ChatCocuyo, useConversacionCocuyo } from './ChatCocuyo';
import { Cocuyo } from './Cocuyo';
import estilos from './Guia.module.css';
import {
  consejosSilenciados,
  MensajeContextual,
  PersonajeAcompanante,
  silenciarConsejos,
} from './MensajeContextual';

/** Rutas donde la guía flotante estorbaría (el escenario de las salas y el panel de trabajo). */
const OCULTA_EN = [/^\/salas\/[^/]+/, /^\/panel/, /^\/gestion/, /^\/guia$/];

/**
 * Guía virtual (F25): un botón flotante que abre el chat de Cocuyo. La persona escribe su pregunta
 * o usa las preguntas frecuentes como accesos rápidos; Cocuyo solo responde sobre cómo funciona la
 * plataforma (catálogo en config/guia.ts, control de alcance en el backend). No simula a una
 * persona profesional. La conversación dura mientras la página esté abierta.
 */
export function GuiaVirtual() {
  const ruta = usePathname();
  const [abierta, setAbierta] = useState(false);
  const conversacion = useConversacionCocuyo();
  const boton = useRef<HTMLButtonElement>(null);
  // Consejo pedido desde la guía; solo vale en la página donde se pidió.
  const [pedido, setPedido] = useState<{ ruta: string; indice: number } | null>(null);
  const [silencio, setSilencio] = useState(false);
  const cerrarPedido = useCallback(() => setPedido(null), []);
  const consejos = mensajesDeRuta(ruta);

  useEffect(() => {
    if (!abierta) return;
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        setAbierta(false);
        boton.current?.focus();
      }
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [abierta]);

  if (OCULTA_EN.some((patron) => patron.test(ruta))) return null;
  const pedidoAqui = pedido?.ruta === ruta ? pedido.indice : null;

  return (
    <div className={estilos.flotante}>
      <MensajeContextual
        key={ruta}
        bloqueado={abierta}
        pedido={pedidoAqui}
        alCerrarPedido={cerrarPedido}
      />
      <AnimatePresence>
        {abierta && (
          <motion.section
            id="guia-virtual"
            role="dialog"
            aria-modal="false"
            aria-labelledby="guia-titulo"
            className={estilos.ventana}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <header className={estilos.cabecera}>
              <Cocuyo tamano={36} />
              <div>
                <h2 id="guia-titulo" className={estilos.titulo}>
                  Cocuyo, tu guía
                </h2>
                <p className={estilos.subtitulo}>Guía automática · sin diagnósticos</p>
              </div>
              <button
                type="button"
                className={estilos.cerrar}
                onClick={() => {
                  setAbierta(false);
                  boton.current?.focus();
                }}
              >
                <X aria-hidden="true" size={20} />
                <span className="visualmente-oculto">Cerrar la guía</span>
              </button>
            </header>

            <ChatCocuyo
              conversacion={conversacion}
              enfocarAlAbrir
              alNavegar={() => setAbierta(false)}
              intro={
                consejos.length > 0 && (
                  <section className={estilos.consejos} aria-labelledby="guia-consejos">
                    <h3 id="guia-consejos" className={estilos.tituloConsejos}>
                      Consejos de esta página
                    </h3>
                    <ul className={estilos.listaConsejos}>
                      {consejos.map((consejo, i) => (
                        <li key={consejo.texto}>
                          <button
                            type="button"
                            className={estilos.consejo}
                            onClick={() => {
                              setAbierta(false);
                              setPedido({ ruta, indice: i });
                            }}
                          >
                            <PersonajeAcompanante id={consejo.de} tamano={24} />
                            <span>
                              <strong>{ACOMPANANTES[consejo.de].nombre}:</strong> {consejo.texto}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <label className={estilos.interruptor}>
                      <input
                        type="checkbox"
                        checked={!silencio}
                        onChange={(evento) => {
                          silenciarConsejos(!evento.target.checked);
                          setSilencio(!evento.target.checked);
                        }}
                      />
                      Mostrar consejos automáticos al navegar
                    </label>
                  </section>
                )
              }
            />
          </motion.section>
        )}
      </AnimatePresence>

      <button
        ref={boton}
        type="button"
        className={estilos.lanzador}
        aria-expanded={abierta}
        aria-controls="guia-virtual"
        onClick={() => {
          setSilencio(consejosSilenciados());
          setAbierta((a) => !a);
        }}
      >
        <Cocuyo tamano={30} encendido={!abierta} />
        <span className={estilos.textoLanzador}>{abierta ? 'Cerrar guía' : '¿Cómo funciona?'}</span>
      </button>
    </div>
  );
}
