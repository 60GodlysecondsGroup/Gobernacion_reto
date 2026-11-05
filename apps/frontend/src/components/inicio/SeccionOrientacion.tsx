'use client';

import {
  createContext,
  useContext,
  useRef,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'motion/react';

const ContextoProgreso = createContext<MotionValue<number> | null>(null);

const sinSuscripcion = () => () => {};
const instantaneaCliente = () => true;
const instantaneaServidor = () => false;

type Props = PropsWithChildren<{
  className: string;
  'aria-labelledby': string;
}>;

function SeccionVinculadaAlScroll({ children, ...props }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.98', 'end 0.12'],
  });
  const y = useTransform(scrollYProgress, [0, 0.18, 0.82, 1], [12, 0, 0, -10]);
  const scale = useTransform(scrollYProgress, [0, 0.18, 0.82, 1], [0.99, 1, 1, 0.995]);

  return (
    <ContextoProgreso.Provider value={scrollYProgress}>
      <motion.section ref={ref} {...props} style={{ y, scale }}>
        {children}
      </motion.section>
    </ContextoProgreso.Provider>
  );
}

export function SeccionOrientacion({ children, ...props }: Props) {
  const reducirMovimiento = useReducedMotion() ?? false;
  const montada = useSyncExternalStore(sinSuscripcion, instantaneaCliente, instantaneaServidor);

  if (!montada || reducirMovimiento) {
    return <section {...props}>{children}</section>;
  }

  return <SeccionVinculadaAlScroll {...props}>{children}</SeccionVinculadaAlScroll>;
}

/**
 * Estilo de entrada de un elemento de la sección, ligado a SU posición: empieza a aparecer en
 * cuanto su borde superior entra por abajo de la pantalla y termina poco después (al llegar al
 * 82 % del alto), así nadie tiene que desplazarse de más para ver el contenido. `retraso` (0–1)
 * desfasa un poco a los vecinos para conservar la secuencia escalonada. La salida sigue ligada al
 * final de la sección, como antes. Devuelve el `ref` que hay que poner en el elemento.
 */
export function useEstiloScrollOrientacion(retraso = 0) {
  const ref = useRef<HTMLElement | null>(null);
  const progresoContexto = useContext(ContextoProgreso);
  const progresoPredeterminado = useMotionValue(0);
  const progreso = progresoContexto ?? progresoPredeterminado;
  const { scrollYProgress: entrada } = useScroll({
    target: ref,
    offset: ['start 1', 'start 0.82'],
  });
  const inicio = Math.min(retraso, 0.5);
  const fin = inicio + 0.5;
  const mezcla = (e: number, p: number, desde: number, hacia: number, salida: number) => {
    const t = Math.min(Math.max((e - inicio) / (fin - inicio), 0), 1);
    const s = Math.min(Math.max((p - 0.84) / 0.16, 0), 1);
    return s > 0 ? hacia + (salida - hacia) * s : desde + (hacia - desde) * t;
  };
  const opacidad = useTransform([entrada, progreso], ([e, p]: number[]) =>
    mezcla(e!, p!, 0, 1, 0.72),
  );
  const y = useTransform([entrada, progreso], ([e, p]: number[]) => mezcla(e!, p!, 18, 0, -10));
  const scale = useTransform([entrada, progreso], ([e, p]: number[]) =>
    mezcla(e!, p!, 0.98, 1, 0.99),
  );

  return { ref, style: progresoContexto ? { opacity: opacidad, y, scale } : undefined };
}

export function ElementoOrientacion({ children, indice }: PropsWithChildren<{ indice: number }>) {
  const { ref, style } = useEstiloScrollOrientacion(indice * 0.08);

  return (
    <motion.div ref={ref as React.RefObject<HTMLDivElement | null>} style={style}>
      {children}
    </motion.div>
  );
}
