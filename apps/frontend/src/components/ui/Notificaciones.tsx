'use client';

import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import estilos from './Notificaciones.module.css';

type TonoNotificacion = 'exito' | 'info' | 'error';
type Notificacion = { id: number; tono: TonoNotificacion; titulo: string; detalle?: string };
type Notificar = (tono: TonoNotificacion, titulo: string, detalle?: string) => void;

const Contexto = createContext<Notificar | null>(null);
const ICONOS = { exito: CircleCheck, info: Info, error: CircleAlert };
const DURACION_MS = 5000;

/**
 * Avisos breves de confirmación (patrón «toast» de sonner/shadcn, sin dependencias). Se anuncian
 * en una región `aria-live`; se pueden cerrar y se quedan mientras el puntero o el foco estén
 * encima. Los errores que exigen corregir algo se siguen mostrando junto al formulario.
 */
export function ProveedorNotificaciones({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<Notificacion[]>([]);
  const siguiente = useRef(1);
  const temporizadores = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const quitar = useCallback((id: number) => {
    clearTimeout(temporizadores.current.get(id));
    temporizadores.current.delete(id);
    setLista((actual) => actual.filter((n) => n.id !== id));
  }, []);

  const programar = useCallback(
    (id: number) => {
      clearTimeout(temporizadores.current.get(id));
      temporizadores.current.set(
        id,
        setTimeout(() => quitar(id), DURACION_MS),
      );
    },
    [quitar],
  );

  const notificar = useCallback<Notificar>(
    (tono, titulo, detalle) => {
      const id = siguiente.current++;
      setLista((actual) => [...actual.slice(-2), { id, tono, titulo, detalle }]);
      programar(id);
    },
    [programar],
  );

  const pausar = () => temporizadores.current.forEach((t) => clearTimeout(t));
  const reanudar = () => lista.forEach((n) => programar(n.id));

  const valor = useMemo(() => notificar, [notificar]);

  return (
    <Contexto.Provider value={valor}>
      {children}
      <section
        aria-label="Notificaciones"
        aria-live="polite"
        className={estilos.region}
        onPointerEnter={pausar}
        onPointerLeave={reanudar}
        onFocus={pausar}
        onBlur={reanudar}
      >
        <AnimatePresence initial={false}>
          {lista.map((n) => {
            const Icono = ICONOS[n.tono];
            return (
              <motion.div
                key={n.id}
                layout
                role={n.tono === 'error' ? 'alert' : 'status'}
                className={`${estilos.notificacion} ${estilos[n.tono]}`}
                initial={{ opacity: 0, y: -12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              >
                <Icono aria-hidden="true" size={20} className={estilos.icono} />
                <div>
                  <p className={estilos.titulo}>{n.titulo}</p>
                  {n.detalle && <p className={estilos.detalle}>{n.detalle}</p>}
                </div>
                <button type="button" className={estilos.cerrar} onClick={() => quitar(n.id)}>
                  <X aria-hidden="true" size={16} />
                  <span className="visualmente-oculto">Cerrar notificación</span>
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </section>
    </Contexto.Provider>
  );
}

/** Muestra una notificación breve. Fuera del proveedor no hace nada (p. ej. en pruebas). */
export function useNotificar(): Notificar {
  return useContext(Contexto) ?? (() => {});
}
