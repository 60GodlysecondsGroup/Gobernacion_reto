'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso, EstadoError, EstadoVacio } from '@/components/ui';
import { AVISO_LIMITES } from '@/config/textos';
import { mensajeDeError } from '@/lib/api/cliente';
import { obtenerNecesidades, type Necesidad } from '@/lib/api/orientacion';
import comun from '../comun.module.css';
import { CargandoExplorador } from './CargandoExplorador';
import { ExploradorTemas } from './ExploradorTemas';
import estilos from './Orientacion.module.css';

/** La ruleta empieza a girar, como pronto, cuando el título ya casi terminó de revelarse. */
const INICIO_EXPLORADOR = 0.55;

/**
 * Navegador de orientación (F04). Las necesidades son categorías para buscar información:
 * aquí no hay preguntas, puntajes ni mensajes sobre el estado de nadie. Se eligen con la ruleta
 * de temas y se entra por el edificio de cada uno (`ExploradorTemas`).
 */
export function NavegadorOrientacion() {
  const [necesidades, setNecesidades] = useState<Necesidad[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [retraso, setRetraso] = useState(0);
  const montaje = useRef(0);

  useEffect(() => {
    montaje.current = performance.now();
  }, []);

  useEffect(() => {
    let vigente = true;
    obtenerNecesidades()
      .then((r) => {
        if (!vigente) return;
        const transcurrido = (performance.now() - montaje.current) / 1000;
        setRetraso(Math.max(0, INICIO_EXPLORADOR - transcurrido));
        setNecesidades(r.necesidades);
      })
      .catch((e: unknown) => vigente && setError(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, [intento]);

  return (
    // `paginaOrientacion`: esta página tiene su propia coreografía (sin la cascada genérica).
    <div className={`${comun.paginaAncha} ${estilos.paginaOrientacion}`}>
      <EncabezadoPagina antetitulo="Orientación" titulo="¿Qué información buscas?">
        Elige un tema para ver servicios y canales de instituciones, siempre con su fuente y la
        fecha en que se verificaron.
      </EncabezadoPagina>

      {error && (
        <EstadoError
          alReintentar={() => {
            setError(null);
            setIntento((n) => n + 1);
          }}
        >
          {error}
        </EstadoError>
      )}
      {/* Esqueleto con la forma del explorador: aparece solo si la carga tarda más de 1,5 s (así no destella)
          y se desvanece desenfocándose cuando llegan los temas, que ocupan su mismo sitio. */}
      <AnimatePresence mode="popLayout">
        {!necesidades && !error ? (
          <motion.div
            key="cargando"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 1.5, duration: 0.3 } }}
            exit={{ opacity: 0, scale: 0.985, filter: 'blur(4px)', transition: { duration: 0.22 } }}
          >
            <CargandoExplorador />
          </motion.div>
        ) : necesidades && necesidades.length > 0 ? (
          <motion.div key="explorador">
            <ExploradorTemas necesidades={necesidades} retraso={retraso} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {necesidades && necesidades.length === 0 && (
        <EstadoVacio titulo="Aún no hay temas disponibles">
          Mientras tanto, «Necesito ayuda» muestra los canales institucionales disponibles.
        </EstadoVacio>
      )}

      {/* Secundario: llega después del contenido principal, ligado al scroll. */}
      <div className={estilos.avisoLimites}>
        <Aviso tono="info" titulo="Qué hace y qué no hace esta plataforma">
          {AVISO_LIMITES}
        </Aviso>
      </div>
    </div>
  );
}
