'use client';

import { ChevronDown, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ACOMPANANTES, mensajesDeRuta } from '@/config/acompanantes';
import { ChatCocuyo, useConversacionCocuyo } from './ChatCocuyo';
import { Cocuyo } from './Cocuyo';
import estilos from './Guia.module.css';
import { HojaCocuyo } from './HojaCocuyo';
import {
  consejosSilenciados,
  MensajeContextual,
  PersonajeAcompanante,
  silenciarConsejos,
} from './MensajeContextual';

/** Rutas donde la guía flotante estorbaría (el escenario de las salas y el panel de trabajo). */
const OCULTA_EN = [/^\/salas\/[^/]+/, /^\/panel/, /^\/gestion/, /^\/guia$/];
/**
 * En móvil y tableta, además, la burbuja no va en la entrada y el registro: son formularios con
 * el teclado abierto y la barra inferior ya ofrece «Guía» a quien no ha iniciado sesión.
 */
const OCULTA_EN_MOVIL = [/^\/acceso/];

/** Mismo punto de quiebre que la barra inferior (`Encabezado.module.css`). */
const CONSULTA_MOVIL = '(max-width: 63.99rem)';
const suscribirMovil = (aviso: () => void) => {
  const consulta = window.matchMedia(CONSULTA_MOVIL);
  consulta.addEventListener('change', aviso);
  return () => consulta.removeEventListener('change', aviso);
};

/** En el servidor se asume escritorio; al hidratar se corrige sin desajustes. */
const useEsMovil = () =>
  useSyncExternalStore(
    suscribirMovil,
    () => window.matchMedia(CONSULTA_MOVIL).matches,
    () => false,
  );

function CabeceraGuia({ alCerrar, minimizar }: { alCerrar: () => void; minimizar: boolean }) {
  const Icono = minimizar ? ChevronDown : X;
  return (
    <header className={estilos.cabecera}>
      <Cocuyo tamano={36} />
      <div>
        <h2 id="guia-titulo" className={estilos.titulo}>
          Cocuyo, tu guía
        </h2>
        <p className={estilos.subtitulo}>Guía automática · sin diagnósticos</p>
      </div>
      <button type="button" className={estilos.cerrar} onClick={alCerrar}>
        <Icono aria-hidden="true" size={minimizar ? 24 : 20} />
        <span className="visualmente-oculto">
          {minimizar ? 'Minimizar la guía' : 'Cerrar la guía'}
        </span>
      </button>
    </header>
  );
}

/**
 * Guía virtual (F25): un botón flotante que abre el chat de Cocuyo. La persona escribe su pregunta
 * o usa las preguntas frecuentes como accesos rápidos; Cocuyo solo responde sobre cómo funciona la
 * plataforma (catálogo en config/guia.ts, control de alcance en el backend). No simula a una
 * persona profesional. La conversación dura mientras la página esté abierta.
 *
 * En escritorio el chat es una ventana sobre el botón. En móvil y tableta el botón es una burbuja
 * redonda sobre la barra inferior y el chat, una hoja que sube desde abajo (`HojaCocuyo`). Las dos
 * comparten la misma conversación: vive aquí, en el layout raíz, así que cambiar de página no la
 * reinicia.
 */
export function GuiaVirtual() {
  const ruta = usePathname();
  const movil = useEsMovil();
  const [abierta, setAbierta] = useState(false);
  const conversacion = useConversacionCocuyo();
  const boton = useRef<HTMLButtonElement>(null);
  // Consejo pedido desde la guía; solo vale en la página donde se pidió.
  const [pedido, setPedido] = useState<{ ruta: string; indice: number } | null>(null);
  const [silencio, setSilencio] = useState(false);
  const cerrarPedido = useCallback(() => setPedido(null), []);
  const consejos = mensajesDeRuta(ruta);
  const oculta = OCULTA_EN.some((patron) => patron.test(ruta));
  const ocultaEnMovil = OCULTA_EN_MOVIL.some((patron) => patron.test(ruta));

  // En móvil, si se llega con la hoja abierta a una página sin burbuja, la hoja se cierra.
  const [rutaAnterior, setRutaAnterior] = useState(ruta);
  if (ruta !== rutaAnterior) {
    setRutaAnterior(ruta);
    if (movil && ocultaEnMovil && abierta) setAbierta(false);
  }

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

  if (oculta) return null;
  const pedidoAqui = pedido?.ruta === ruta ? pedido.indice : null;
  const cerrar = () => {
    setAbierta(false);
    boton.current?.focus();
  };

  const chat = (
    <ChatCocuyo
      conversacion={conversacion}
      // En móvil no se abre el teclado solo: la persona primero ve la conversación.
      enfocarAlAbrir={!movil}
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
  );

  return (
    <>
      <div className={estilos.flotante} data-sin-burbuja-movil={ocultaEnMovil || undefined}>
        <MensajeContextual
          key={ruta}
          bloqueado={abierta}
          pedido={pedidoAqui}
          alCerrarPedido={cerrarPedido}
        />
        <AnimatePresence>
          {abierta && !movil && (
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
              <CabeceraGuia alCerrar={cerrar} minimizar={false} />
              {chat}
            </motion.section>
          )}
        </AnimatePresence>

        <button
          ref={boton}
          type="button"
          className={estilos.lanzador}
          aria-expanded={abierta}
          aria-controls="guia-virtual"
          aria-haspopup={movil ? 'dialog' : undefined}
          onClick={() => {
            setSilencio(consejosSilenciados());
            setAbierta((a) => !a);
          }}
        >
          <Cocuyo tamano={30} encendido={!abierta} />
          <span className={estilos.textoLanzador}>
            {abierta ? 'Cerrar guía' : '¿Cómo funciona?'}
          </span>
        </button>
      </div>

      {movil && !ocultaEnMovil && (
        <HojaCocuyo
          abierta={abierta}
          alCerrar={cerrar}
          irAlFinal={conversacion.mensajes.length > 0}
          devolverFocoA={boton}
        >
          <CabeceraGuia alCerrar={cerrar} minimizar />
          {chat}
        </HojaCocuyo>
      )}
    </>
  );
}
