'use client';

import { ArrowLeft, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ACOMPANANTES, mensajesDeRuta } from '@/config/acompanantes';
import { PRESENTACION_GUIA, TEMAS_GUIA } from '@/config/guia';
import { Cocuyo } from './Cocuyo';
import { ContenidoTema } from './ContenidoTema';
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
 * Guía virtual (F25): un botón flotante que abre respuestas preparadas sobre cómo funciona la
 * plataforma. No tiene campo de texto: no es un chatbot ni simula a una persona profesional.
 */
export function GuiaVirtual() {
  const ruta = usePathname();
  const [abierta, setAbierta] = useState(false);
  const [tema, setTema] = useState<string | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  // Consejo pedido desde la guía; solo vale en la página donde se pidió.
  const [pedido, setPedido] = useState<{ ruta: string; indice: number } | null>(null);
  const [silencio, setSilencio] = useState(false);
  const cerrarPedido = useCallback(() => setPedido(null), []);
  const consejos = mensajesDeRuta(ruta);

  useEffect(() => {
    if (abierta) titulo.current?.focus();
  }, [abierta, tema]);

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

  const elegido = TEMAS_GUIA.find((t) => t.id === tema);

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
                <h2 id="guia-titulo" ref={titulo} tabIndex={-1} className={estilos.titulo}>
                  {elegido ? elegido.pregunta : 'Cocuyo, tu guía'}
                </h2>
                <p className={estilos.subtitulo}>Respuestas preparadas, sin diagnósticos</p>
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

            <div className={estilos.cuerpo}>
              {elegido ? (
                <>
                  <button type="button" className={estilos.volver} onClick={() => setTema(null)}>
                    <ArrowLeft aria-hidden="true" size={16} />
                    Otras preguntas
                  </button>
                  <ContenidoTema tema={elegido} alNavegar={() => setAbierta(false)} />
                </>
              ) : (
                <>
                  <p className={estilos.burbuja}>{PRESENTACION_GUIA}</p>
                  {consejos.length > 0 && (
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
                  )}
                  <ul className={estilos.preguntas} aria-label="Preguntas frecuentes">
                    {TEMAS_GUIA.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          className={estilos.pregunta}
                          onClick={() => setTema(t.id)}
                        >
                          {t.pregunta}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
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
          setTema(null);
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
