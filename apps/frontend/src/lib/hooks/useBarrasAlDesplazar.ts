'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** Mismo punto de quiebre que la barra inferior (`Encabezado.module.css`): solo existe por debajo. */
const CONSULTA_MOVIL = '(max-width: 63.99rem)';
/** Recorrido mínimo en un mismo sentido antes de cambiar de barra: ignora roces y temblores. */
const UMBRAL = 24;
/** Al principio de la página (aprox. el alto del encabezado) se ven las dos barras. */
const ZONA_INICIO = 80;
/** Tras cargar cada página (ms), el scroll que se mueva solo no oculta ninguna barra. */
const ESPERA_INICIAL = 500;
const ATRIBUTO = 'data-desplazamiento';

/**
 * En móvil y tableta, el encabezado y la barra inferior se turnan según el sentido del
 * desplazamiento: hacia abajo queda la barra inferior, hacia arriba el encabezado. Solo escribe
 * `data-desplazamiento` en `<html>`; el CSS decide qué se oculta y lo anima. Cada página empieza
 * con las dos barras a la vista. Montar una sola vez (lo hace `BarraInferior`).
 */
export function useBarrasAlDesplazar() {
  const ruta = usePathname();

  useEffect(() => {
    const raiz = document.documentElement;
    const consulta = window.matchMedia(CONSULTA_MOVIL);
    let anterior = 0;
    let recorrido = 0;
    let marco = 0;
    let listaEn = 0;

    const fijar = (sentido: 'abajo' | 'arriba' | null) => {
      if (sentido) raiz.setAttribute(ATRIBUTO, sentido);
      else raiz.removeAttribute(ATRIBUTO);
    };

    // Acotada al recorrido real: el rebote elástico de iOS en los extremos no cuenta como gesto.
    const posicion = () => {
      const maximo = Math.max(raiz.scrollHeight - window.innerHeight, 0);
      return Math.min(Math.max(window.scrollY, 0), maximo);
    };

    const actualizar = () => {
      marco = 0;
      const y = posicion();
      const delta = y - anterior;
      anterior = y;
      if (y <= ZONA_INICIO) {
        recorrido = 0;
        fijar(null);
        return;
      }
      // Recién cargada la página, lo que se mueva (restaurar el scroll al volver atrás, datos que
      // llegan y empujan el contenido) no es un gesto: solo se toma como nueva referencia.
      if (performance.now() < listaEn) {
        recorrido = 0;
        return;
      }
      if (delta === 0) return;
      // Cambiar de sentido reinicia el recorrido acumulado.
      recorrido = Math.sign(delta) === Math.sign(recorrido) ? recorrido + delta : delta;
      if (Math.abs(recorrido) >= UMBRAL) fijar(recorrido > 0 ? 'abajo' : 'arriba');
    };

    const alDesplazar = () => {
      if (!marco) marco = requestAnimationFrame(actualizar);
    };

    // Se (re)engancha al montar y al cruzar el punto de quiebre; en escritorio no escucha nada.
    const activar = () => {
      window.removeEventListener('scroll', alDesplazar);
      cancelAnimationFrame(marco);
      marco = 0;
      fijar(null);
      anterior = posicion();
      recorrido = 0;
      listaEn = performance.now() + ESPERA_INICIAL;
      if (consulta.matches) window.addEventListener('scroll', alDesplazar, { passive: true });
    };

    activar();
    consulta.addEventListener('change', activar);
    return () => {
      consulta.removeEventListener('change', activar);
      window.removeEventListener('scroll', alDesplazar);
      cancelAnimationFrame(marco);
      fijar(null);
    };
  }, [ruta]);
}
