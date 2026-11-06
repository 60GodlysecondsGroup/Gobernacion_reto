'use client';

import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { Inclinable } from '@/components/movimiento/Inclinable';
import type { Necesidad } from '@/lib/api/orientacion';
import { useTextoEstatico } from '@/lib/hooks/useTextoEstatico';
import { anguloDe, giroHacia } from '@/lib/ruleta';
import { EscenaEdificio } from './EscenaEdificio';
import estilos from './Orientacion.module.css';
import {
  DURACION_ESPIRAL,
  barridoMarco,
  espiralRuleta,
  estadosRotulo,
  estadosRotuloInmediato,
} from './movimientoExplorador';
import { RuletaTemas } from './RuletaTemas';

/**
 * Último tema elegido o visitado en esta pestaña: al volver de un tema (también si se llegó por
 * un atajo de la portada), la ruleta lo muestra elegido.
 */
const CLAVE_TEMA = 'orientacion:tema';

export function recordarTema(codigo: string) {
  try {
    window.sessionStorage.setItem(CLAVE_TEMA, codigo);
  } catch {
    // Sin almacenamiento (modo privado, bloqueado): la ruleta empieza en el primer tema.
  }
}

function temaGuardado(necesidades: Necesidad[]) {
  try {
    const codigo = window.sessionStorage.getItem(CLAVE_TEMA);
    return Math.max(
      0,
      necesidades.findIndex((n) => n.codigo === codigo),
    );
  } catch {
    return 0;
  }
}

const cuentaServicios = (n: number) => (n === 1 ? '1 servicio' : `${n} servicios`);

/**
 * Explorador de temas (F04): la ruleta elige un tema y el edificio de ese tema es la puerta a su
 * contenido. Entrar usa el mismo enlace de siempre, `/orientacion/<código>`, con `next/link`;
 * Intro en la ruleta, tocar el centro o volver a tocar el tema elegido pulsan ese mismo enlace.
 */
export function ExploradorTemas({
  necesidades,
  retraso = 0,
}: {
  necesidades: Necesidad[];
  /** Segundos de espera antes de la entrada (la página la usa para no pisar el encabezado). */
  retraso?: number;
}) {
  const total = necesidades.length;
  const idAyuda = useId();
  const idDescripcion = useId();
  const enlace = useRef<HTMLAnchorElement>(null);
  // Solo se monta en el cliente (tras cargar los temas), así que puede leer la pestaña al iniciar.
  const [seleccion, setSeleccion] = useState(() => {
    const indice = temaGuardado(necesidades);
    return { indice, giro: anguloDe(indice, total) };
  });

  const necesidad = necesidades[Math.min(seleccion.indice, total - 1)];

  const elegir = (indice: number) => {
    setSeleccion((actual) => ({
      indice,
      giro: giroHacia(actual.giro, actual.indice, indice, total),
    }));
    recordarTema(necesidades[indice].codigo);
  };

  const entrar = () => enlace.current?.click();
  // La ruleta encaja → destella y el edificio sube. Hasta entonces todo arranca oculto desde el
  // primer pintado (estilos iniciales de Motion), así que no hay destello de carga.
  const [encajada, setEncajada] = useState(false);
  // Móvil: la ayuda y el rótulo aparecen en el mismo momento (al encajar), pero sin fundido.
  const estatico = useTextoEstatico();
  // Respaldo: si el aviso de fin de la espiral no llega (pestaña en segundo plano, animación
  // interrumpida), el edificio y el rótulo aparecen igualmente a su hora.
  useEffect(() => {
    const t = setTimeout(() => setEncajada(true), (retraso + DURACION_ESPIRAL + 0.25) * 1000);
    return () => clearTimeout(t);
  }, [retraso]);

  return (
    <section className={estilos.explorador} aria-label="Explorar temas">
      <div className={estilos.zonaRuleta}>
        <motion.div
          className={estilos.giroRuleta}
          data-encajada={encajada || undefined}
          style={{ transformPerspective: 1000 }}
          variants={espiralRuleta}
          custom={retraso}
          initial="oculto"
          animate="visible"
          onAnimationComplete={() => setEncajada(true)}
        >
          <RuletaTemas
            necesidades={necesidades}
            indice={seleccion.indice}
            giro={seleccion.giro}
            alElegir={elegir}
            alEntrar={entrar}
            idAyuda={idAyuda}
          />
        </motion.div>
        <motion.p
          id={idAyuda}
          className={estilos.ayudaRuleta}
          initial={{ opacity: 0 }}
          animate={{ opacity: encajada ? 1 : 0 }}
          transition={{ duration: estatico ? 0 : 0.4 }}
        >
          <span className={estilos.ayudaPuntero}>Elige un tema con un clic o con las flechas</span>
          <span className={estilos.ayudaTactil}>Toca un tema para elegirlo</span> y su edificio
          aparece. Para entrar, toca el edificio, vuelve a tocar el tema o pulsa Intro.
        </motion.p>
      </div>

      <motion.div
        className={estilos.contenedorEdificio}
        variants={barridoMarco}
        custom={retraso}
        initial="oculto"
        animate="visible"
      >
        <Link
          ref={enlace}
          href={`/orientacion/${necesidad.codigo}`}
          className={`${estilos.edificio} con-luz`}
          aria-label={`${necesidad.nombre}: ver ${cuentaServicios(necesidad.servicios)}`}
          aria-describedby={idDescripcion}
        >
          {/* Parallax muy suave: el edificio se inclina en 3D siguiendo al cursor (solo ratón). */}
          <Inclinable maximo={3}>
            <EscenaEdificio codigo={necesidad.codigo} listo={encajada} />
          </Inclinable>
          <motion.span
            key={necesidad.codigo}
            className={estilos.rotulo}
            variants={estatico ? estadosRotuloInmediato : estadosRotulo}
            initial="esperando"
            animate={encajada ? 'visible' : 'esperando'}
          >
            <span className={estilos.nombreTema}>{necesidad.nombre}</span>
            <span id={idDescripcion} className={estilos.descripcionTema}>
              {necesidad.descripcion}
            </span>
            <span className={estilos.pieTema}>
              <span>{cuentaServicios(necesidad.servicios)}</span>
              <span className={estilos.entrarTema}>
                Ver servicios
                <ArrowRight aria-hidden="true" size={18} />
              </span>
            </span>
          </motion.span>
        </Link>
      </motion.div>
    </section>
  );
}
