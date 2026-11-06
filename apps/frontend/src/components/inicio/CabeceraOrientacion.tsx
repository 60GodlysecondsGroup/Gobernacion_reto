'use client';

import { motion } from 'motion/react';
import { useTextoEstatico } from '@/lib/hooks/useTextoEstatico';
import { useEstiloScrollOrientacion } from './SeccionOrientacion';

type Props = {
  className: string;
  antetituloClassName: string;
};

const DESCRIPCION =
  'No necesitas iniciar sesión. Aquí no hay preguntas sobre ti ni resultados: solo información de instituciones.';

/**
 * Móvil: los textos aparecen ya en su sitio. Sin la versión animada no se registran sus escuchas
 * de scroll (la sección conserva su propio movimiento).
 */
export function CabeceraOrientacion(props: Props) {
  const estatico = useTextoEstatico();
  return estatico ? <CabeceraEstatica {...props} /> : <CabeceraAnimada {...props} />;
}

function CabeceraEstatica({ className, antetituloClassName }: Props) {
  return (
    <div className={className}>
      <p className={antetituloClassName}>Orientación</p>
      <h2 id="titulo-orientacion">¿Qué información buscas hoy?</h2>
      <p>{DESCRIPCION}</p>
    </div>
  );
}

function CabeceraAnimada({ className, antetituloClassName }: Props) {
  // Antetítulo primero; título y descripción justo después.
  const { ref: refAntetitulo, style: estiloAntetitulo } = useEstiloScrollOrientacion(0);
  const { ref: refTitulo, style: estiloTitulo } = useEstiloScrollOrientacion(0.08);
  const { ref: refDescripcion, style: estiloDescripcion } = useEstiloScrollOrientacion(0.16);

  return (
    <div className={className}>
      <motion.p
        ref={refAntetitulo as React.RefObject<HTMLParagraphElement | null>}
        className={antetituloClassName}
        style={estiloAntetitulo}
      >
        Orientación
      </motion.p>
      <motion.h2
        ref={refTitulo as React.RefObject<HTMLHeadingElement | null>}
        id="titulo-orientacion"
        style={estiloTitulo}
      >
        ¿Qué información buscas hoy?
      </motion.h2>
      <motion.p
        ref={refDescripcion as React.RefObject<HTMLParagraphElement | null>}
        style={estiloDescripcion}
      >
        {DESCRIPCION}
      </motion.p>
    </div>
  );
}
