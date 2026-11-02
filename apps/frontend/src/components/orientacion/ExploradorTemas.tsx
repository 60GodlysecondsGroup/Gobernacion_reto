'use client';

import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useId, useRef, useState } from 'react';
import type { Necesidad } from '@/lib/api/orientacion';
import { CURVA_SALIDA, DURACION } from '@/lib/movimiento';
import { anguloDe, giroHacia } from '@/lib/ruleta';
import { EscenaEdificio } from './EscenaEdificio';
import estilos from './Orientacion.module.css';
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
export function ExploradorTemas({ necesidades }: { necesidades: Necesidad[] }) {
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

  return (
    <section className={estilos.explorador} aria-label="Explorar temas">
      <div className={estilos.zonaRuleta}>
        <RuletaTemas
          necesidades={necesidades}
          indice={seleccion.indice}
          giro={seleccion.giro}
          alElegir={elegir}
          alEntrar={entrar}
          idAyuda={idAyuda}
        />
        <p id={idAyuda} className={estilos.ayudaRuleta}>
          <span className={estilos.ayudaPuntero}>Elige un tema con un clic o con las flechas</span>
          <span className={estilos.ayudaTactil}>Toca un tema para elegirlo</span> y su edificio
          aparece. Para entrar, toca el edificio, vuelve a tocar el tema o pulsa Intro.
        </p>
      </div>

      <Link
        ref={enlace}
        href={`/orientacion/${necesidad.codigo}`}
        className={`${estilos.edificio} con-luz`}
        aria-label={`${necesidad.nombre}: ver ${cuentaServicios(necesidad.servicios)}`}
        aria-describedby={idDescripcion}
      >
        <EscenaEdificio codigo={necesidad.codigo} />
        <motion.span
          key={necesidad.codigo}
          className={estilos.rotulo}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURACION.media, ease: CURVA_SALIDA }}
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
    </section>
  );
}
