'use client';

import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { TemaGuia } from '@/config/guia';
import { ContenidoTema } from './ContenidoTema';
import estilos from './PreguntasFrecuentes.module.css';

/**
 * Preguntas frecuentes en acordeón accesible: cada pregunta es un botón con `aria-expanded`
 * asociado a su respuesta. Se pueden abrir varias. Un enlace con `#id` abre esa pregunta.
 */
export function PreguntasFrecuentes({ temas }: { temas: TemaGuia[] }) {
  const [abiertas, setAbiertas] = useState<string[]>([]);
  const reducir = useReducedMotion();

  // Si se llega con un ancla (/guia#salas), se abre esa pregunta.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const abrirAncla = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!temas.some((tema) => tema.id === id)) return;
      // Se abre después de montar para no desajustar la hidratación.
      t = setTimeout(() => {
        setAbiertas((a) => (a.includes(id) ? a : [...a, id]));
        document.getElementById(id)?.scrollIntoView({ block: 'start' });
      }, 0);
    };
    abrirAncla();
    window.addEventListener('hashchange', abrirAncla);
    return () => {
      clearTimeout(t);
      window.removeEventListener('hashchange', abrirAncla);
    };
  }, [temas]);

  const alternar = (id: string) =>
    setAbiertas((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  return (
    <ul className={estilos.lista}>
      {temas.map((tema) => {
        const abierta = abiertas.includes(tema.id);
        return (
          <li key={tema.id} id={tema.id} className={estilos.item} data-abierta={abierta || undefined}>
            <h3 className={estilos.encabezado}>
              <button
                type="button"
                id={`p-${tema.id}`}
                className={estilos.pregunta}
                aria-expanded={abierta}
                aria-controls={`r-${tema.id}`}
                onClick={() => alternar(tema.id)}
              >
                <span>{tema.pregunta}</span>
                <motion.span
                  className={estilos.indicador}
                  aria-hidden="true"
                  animate={{ rotate: abierta ? 180 : 0 }}
                  transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 28 }}
                >
                  <ChevronDown size={18} />
                </motion.span>
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {abierta && (
                <motion.div
                  key="respuesta"
                  id={`r-${tema.id}`}
                  role="region"
                  aria-labelledby={`p-${tema.id}`}
                  className={estilos.respuesta}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={
                    reducir ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 34, opacity: { duration: 0.2 } }
                  }
                >
                  <div className={estilos.cuerpo}>
                    <ContenidoTema tema={tema} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
