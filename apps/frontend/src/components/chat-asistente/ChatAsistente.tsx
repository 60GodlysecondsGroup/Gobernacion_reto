'use client';

import {
  ArrowDown,
  ArrowUp,
  Bot,
  CircleAlert,
  PencilLine,
  RotateCcw,
  RefreshCw,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { memo, useCallback, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { CURVA_SALIDA, DURACION } from '@/lib/movimiento';
import { BotonCopiar } from './BotonCopiar';
import { Compositor, type ControlCompositor } from './Compositor';
import { Markdown } from './Markdown';
import { textoPlano } from './formato';
import { useConversacion, type Turno } from './useConversacion';
import { useDesplazamiento } from './useDesplazamiento';
import estilos from './ChatAsistente.module.css';

export type PropsChatAsistente<R> = {
  /** Nombre visible del asistente en la cabecera. */
  nombre: string;
  descripcion: string;
  /** Texto del indicador de conexión de la cabecera; sin él solo se avisa cuando no hay red. */
  textoEnLinea?: string;
  bienvenida: { titulo: string; texto: string };
  sugerencias: readonly string[];
  /** Si las sugerencias muestran la flecha de envío. */
  sugerenciasConFlecha?: boolean;
  campo: { id: string; etiqueta: string; placeholder: string };
  textoGenerando: string;
  tituloError: string;
  /** Aviso fijo bajo el campo (privacidad, alcance). */
  nota: ReactNode;
  preguntar: (texto: string) => Promise<R>;
  textoDe: (respuesta: R) => string;
  /** Contenido propio de cada asistente bajo el texto (accesos, métricas, gráficos). */
  extras?: (respuesta: R, idTurno: string) => ReactNode;
};

const ENTRADA = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DURACION.media, ease: CURVA_SALIDA },
} as const;

function suscribirConexion(aviso: () => void) {
  window.addEventListener('online', aviso);
  window.addEventListener('offline', aviso);
  return () => {
    window.removeEventListener('online', aviso);
    window.removeEventListener('offline', aviso);
  };
}

function useEnLinea() {
  return useSyncExternalStore(
    suscribirConexion,
    () => navigator.onLine,
    () => true,
  );
}

function Escribiendo({ texto }: { texto: string }) {
  return (
    <motion.div
      className={estilos.escribiendo}
      role="status"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURACION.rapida, delay: 0.08 }}
    >
      <span className={estilos.puntos} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>{texto}</span>
    </motion.div>
  );
}

type PropsTurno<R> = {
  turno: Turno<R>;
  textoGenerando: string;
  tituloError: string;
  textoDe: (respuesta: R) => string;
  extras?: (respuesta: R, idTurno: string) => ReactNode;
  alReintentar: (turno: Turno<R>) => void;
  alEditar: (turno: Turno<R>) => void;
  puedeReintentar: boolean;
};

/**
 * Un intercambio pregunta–respuesta. Memorizado: escribir en el campo o recibir otra respuesta no
 * vuelve a pintar (ni a analizar) los turnos anteriores.
 */
const TurnoConversacion = memo(function TurnoConversacion<R>({
  turno,
  textoGenerando,
  tituloError,
  textoDe,
  extras,
  alReintentar,
  alEditar,
  puedeReintentar,
}: PropsTurno<R>) {
  return (
    <motion.article className={estilos.turno} data-turno={turno.id} {...ENTRADA}>
      <p className={estilos.pregunta}>
        <span className="visualmente-oculto">Tu pregunta: </span>
        {turno.pregunta}
      </p>
      <div className={estilos.respuesta} data-estado={turno.estado}>
        <span className={estilos.avatar} aria-hidden="true">
          <Bot size={17} />
        </span>
        <div className={estilos.contenidoRespuesta}>
          {turno.estado === 'enviando' && <Escribiendo texto={textoGenerando} />}

          {turno.estado === 'listo' && turno.respuesta !== undefined && (
            <motion.div {...ENTRADA}>
              <span className="visualmente-oculto">Respuesta del asistente: </span>
              <Markdown texto={textoDe(turno.respuesta)} />
              {extras?.(turno.respuesta, turno.id)}
              <div className={estilos.accionesMensaje}>
                <BotonCopiar
                  texto={textoPlano(textoDe(turno.respuesta))}
                  etiqueta="Copiar respuesta"
                />
              </div>
            </motion.div>
          )}

          {turno.estado === 'error' && turno.error && (
            <motion.div className={estilos.fallo} {...ENTRADA}>
              <p className={estilos.tituloFallo}>
                {turno.error.sinConexion ? (
                  <WifiOff size={16} aria-hidden="true" />
                ) : (
                  <CircleAlert size={16} aria-hidden="true" />
                )}
                {turno.error.sinConexion ? 'Sin conexión' : tituloError}
              </p>
              <p>{turno.error.mensaje}</p>
              <div className={estilos.accionesFallo}>
                <button
                  type="button"
                  onClick={() => alReintentar(turno)}
                  disabled={!puedeReintentar}
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  Reintentar
                </button>
                <button type="button" onClick={() => alEditar(turno)}>
                  <PencilLine size={14} aria-hidden="true" />
                  Editar pregunta
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.article>
  );
}) as <R>(props: PropsTurno<R>) => ReactNode;

/**
 * Conversación con un asistente de IA: cabecera, mensajes, estados (bienvenida, escribiendo,
 * error, sin conexión) y campo de escritura. La comparten el asistente de usuarios y el de
 * administración; cada uno aporta sus textos, su llamada al backend y su contenido extra.
 */
export function ChatAsistente<R>({
  nombre,
  descripcion,
  textoEnLinea,
  bienvenida,
  sugerencias,
  sugerenciasConFlecha = false,
  campo,
  textoGenerando,
  tituloError,
  nota,
  preguntar,
  textoDe,
  extras,
}: PropsChatAsistente<R>) {
  const { turnos, enviando, enviar, reintentar, descartar, reiniciar } = useConversacion(preguntar);
  const desplazamiento = useDesplazamiento(turnos);
  const { contenedor, contenido, alDesplazar, irAlFinal, alejado, novedad } = desplazamiento;
  const compositor = useRef<ControlCompositor>(null);
  const enLinea = useEnLinea();

  const editar = useCallback(
    (turno: Turno<R>) => {
      descartar(turno.id);
      compositor.current?.escribir(turno.pregunta);
    },
    [descartar],
  );

  const nuevaConversacion = () => {
    reiniciar();
    desplazamiento.reiniciar();
    compositor.current?.enfocar();
  };

  return (
    <section className={estilos.marco} aria-label={`Conversación con ${nombre}`}>
      <header className={estilos.cabecera}>
        <span className={estilos.icono} aria-hidden="true">
          <Bot size={22} />
        </span>
        <div className={estilos.identidad}>
          <h2>{nombre}</h2>
          <p>{descripcion}</p>
        </div>
        <div className={estilos.herramientas}>
          {(!enLinea || textoEnLinea) && (
            <span className={estilos.conexion} data-en-linea={enLinea} role="status">
              <i aria-hidden="true" />
              <span>{enLinea ? textoEnLinea : 'Sin conexión'}</span>
            </span>
          )}
          {turnos.length > 0 && (
            <button className={estilos.nueva} type="button" onClick={nuevaConversacion}>
              <RotateCcw size={15} aria-hidden="true" />
              <span>Nueva conversación</span>
            </button>
          )}
        </div>
      </header>

      <div className={estilos.zonaConversacion}>
        <div
          ref={contenedor}
          className={estilos.conversacion}
          onScroll={alDesplazar}
          aria-live="polite"
          aria-busy={enviando}
        >
          <div ref={contenido} className={estilos.lista}>
            {turnos.length === 0 ? (
              <motion.div className={estilos.bienvenida} {...ENTRADA}>
                <span className={estilos.destello} aria-hidden="true">
                  <Sparkles size={21} />
                </span>
                <h3>{bienvenida.titulo}</h3>
                <p>{bienvenida.texto}</p>
                <ul className={estilos.sugerencias} aria-label="Preguntas sugeridas">
                  {sugerencias.map((sugerencia) => (
                    <li key={sugerencia}>
                      <button type="button" onClick={() => enviar(sugerencia)}>
                        <span>{sugerencia}</span>
                        {sugerenciasConFlecha && (
                          <ArrowUp className={estilos.flecha} size={15} aria-hidden="true" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ) : (
              turnos.map((turno) => (
                <TurnoConversacion
                  key={turno.id}
                  turno={turno}
                  textoGenerando={textoGenerando}
                  tituloError={tituloError}
                  textoDe={textoDe}
                  extras={extras}
                  alReintentar={reintentar}
                  alEditar={editar}
                  puedeReintentar={!enviando}
                />
              ))
            )}
          </div>
        </div>

        <AnimatePresence>
          {alejado && turnos.length > 0 && (
            <motion.button
              type="button"
              className={estilos.irAlFinal}
              onClick={irAlFinal}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: DURACION.rapida, ease: CURVA_SALIDA }}
              data-novedad={novedad || undefined}
            >
              <ArrowDown size={15} aria-hidden="true" />
              {novedad ? 'Nueva respuesta' : 'Ir a lo último'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className={estilos.pie}>
        {!enLinea && (
          <p className={estilos.avisoConexion} role="status">
            <WifiOff size={15} aria-hidden="true" />
            No hay conexión a internet. Podrás enviar tu mensaje cuando vuelva.
          </p>
        )}
        <Compositor
          ref={compositor}
          id={campo.id}
          etiqueta={campo.etiqueta}
          placeholder={campo.placeholder}
          ocupado={enviando}
          alEnviar={enviar}
        />
        <div className={estilos.nota}>{nota}</div>
      </div>
    </section>
  );
}
