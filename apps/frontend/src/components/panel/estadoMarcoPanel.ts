'use client';

import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { useSesion } from '@/components/sesion/ProveedorSesion';
import { esRutaPanel, SECCIONES_PANEL } from '@/config/navegacionPanel';

/**
 * Estado compartido del marco administrativo. El encabezado (botón «Módulos» del móvil), el
 * contenido principal y `MarcoPanel` lo leen sin pasarse props: viven en ramas distintas del
 * layout raíz.
 */

/** Mismo punto de quiebre que la barra inferior (`Encabezado.module.css`). */
export const CONSULTA_MARCO_MOVIL = '(max-width: 63.99rem)';

/**
 * ¿Se pinta el marco administrativo? En las rutas del panel, mientras se comprueba la sesión o si
 * el rol tiene al menos un módulo. Sin módulos (p. ej. una cuenta joven que abre `/panel`) queda
 * la navegación general y `RequiereSesion` explica que la sección no está disponible.
 */
export function useMarcoPanelActivo() {
  const ruta = usePathname();
  const { cargando, puede } = useSesion();
  return esRutaPanel(ruta) && (cargando || SECCIONES_PANEL.some((s) => puede(s.permiso)));
}

/** Pequeño almacén reactivo sin dependencias (lo consume `useSyncExternalStore`). */
function crearAlmacen<T>(inicial: T) {
  let valor = inicial;
  const avisos = new Set<() => void>();
  return {
    leer: () => valor,
    /** Fija el valor sin avisar (se usa dentro de una lectura, antes de que nadie lo vea). */
    iniciar: (nuevo: T) => {
      valor = nuevo;
    },
    fijar: (nuevo: T) => {
      if (Object.is(nuevo, valor)) return;
      valor = nuevo;
      avisos.forEach((avisar) => avisar());
    },
    suscribir: (avisar: () => void) => {
      avisos.add(avisar);
      return () => avisos.delete(avisar);
    },
  };
}

// ── Cajón del móvil ──────────────────────────────────────────────────────────

const cajon = crearAlmacen(false);

export const abrirCajonPanel = () => cajon.fijar(true);
export const cerrarCajonPanel = () => cajon.fijar(false);

export function useCajonPanelAbierto() {
  return useSyncExternalStore(cajon.suscribir, cajon.leer, () => false);
}

// ── Barra lateral plegada (escritorio) ───────────────────────────────────────

/** Preferencia de cada persona en este navegador; si el almacenamiento falla, se ignora. */
const CLAVE_PLEGADO = 'cp-panel-plegado';

function leerPlegadoGuardado() {
  try {
    return window.localStorage.getItem(CLAVE_PLEGADO) === '1';
  } catch {
    return false;
  }
}

const plegado = crearAlmacen<boolean | null>(null);

export function fijarLateralPlegado(valor: boolean) {
  plegado.fijar(valor);
  try {
    window.localStorage.setItem(CLAVE_PLEGADO, valor ? '1' : '0');
  } catch {
    // Sin almacenamiento (ventana privada, datos bloqueados): vale solo para esta visita.
  }
}

/** En el servidor y en la hidratación vale `false` (desplegada); luego, lo guardado. */
export function useLateralPlegado() {
  return useSyncExternalStore(
    plegado.suscribir,
    () => {
      const actual = plegado.leer();
      if (actual !== null) return actual;
      const guardado = leerPlegadoGuardado();
      plegado.iniciar(guardado);
      return guardado;
    },
    () => false,
  );
}
