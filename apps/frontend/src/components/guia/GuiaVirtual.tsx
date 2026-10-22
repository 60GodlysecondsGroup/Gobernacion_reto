'use client';

import { ArrowLeft, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { PRESENTACION_GUIA, TEMAS_GUIA } from '@/config/guia';
import { Cocuyo } from './Cocuyo';
import { ContenidoTema } from './ContenidoTema';
import estilos from './Guia.module.css';

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

  const elegido = TEMAS_GUIA.find((t) => t.id === tema);

  return (
    <div className={estilos.flotante}>
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
          setAbierta((a) => !a);
        }}
      >
        <Cocuyo tamano={30} encendido={!abierta} />
        <span className={estilos.textoLanzador}>{abierta ? 'Cerrar guía' : '¿Cómo funciona?'}</span>
      </button>
    </div>
  );
}
