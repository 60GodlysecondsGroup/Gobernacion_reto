'use client';

import { Moon, Sun } from 'lucide-react';
import { useSyncExternalStore, type MouseEvent } from 'react';
import { CLAVE_TEMA } from '@/lib/tema';
import estilos from './BotonTema.module.css';

type Tema = 'claro' | 'oscuro';

const CONSULTA_OSCURO = '(prefers-color-scheme: dark)';

/** Tema efectivo: el elegido (atributo en <html>) o, si no hay elección, el del sistema. */
function temaActual(): Tema {
  const elegido = document.documentElement.getAttribute('data-tema');
  if (elegido === 'oscuro' || elegido === 'claro') return elegido;
  return window.matchMedia(CONSULTA_OSCURO).matches ? 'oscuro' : 'claro';
}

/** Se entera de cambios del atributo (este botón u otra pestaña) y de la preferencia del sistema. */
function suscribir(avisar: () => void) {
  const observador = new MutationObserver(avisar);
  observador.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-tema'],
  });
  const sistema = window.matchMedia(CONSULTA_OSCURO);
  sistema.addEventListener('change', avisar);
  const otraPestana = (e: StorageEvent) => {
    if (e.key !== CLAVE_TEMA) return;
    if (e.newValue === 'oscuro' || e.newValue === 'claro') {
      document.documentElement.setAttribute('data-tema', e.newValue);
    }
  };
  window.addEventListener('storage', otraPestana);
  return () => {
    observador.disconnect();
    sistema.removeEventListener('change', avisar);
    window.removeEventListener('storage', otraPestana);
  };
}

const enServidor = () => null;

type DocumentoConTransicion = Document & { startViewTransition?: (cambio: () => void) => unknown };

/**
 * Interruptor claro/oscuro. Guarda la elección (persiste entre páginas y recargas) y, donde el
 * navegador lo permite, cambia de tema con un círculo que se expande desde el botón (View
 * Transitions). Con «reducir movimiento» el cambio es inmediato. Es un botón de alternancia
 * accesible: «Modo oscuro» con `aria-pressed`.
 */
export function BotonTema() {
  const tema = useSyncExternalStore(suscribir, temaActual, enServidor);
  const oscuro = tema === 'oscuro';

  const cambiar = (e: MouseEvent<HTMLButtonElement>) => {
    const siguiente: Tema = temaActual() === 'oscuro' ? 'claro' : 'oscuro';
    const raiz = document.documentElement;
    const aplicar = () => {
      raiz.setAttribute('data-tema', siguiente);
      try {
        localStorage.setItem(CLAVE_TEMA, siguiente);
      } catch {
        // Sin almacenamiento (modo privado estricto): el tema vale para esta visita.
      }
    };
    const doc = document as DocumentoConTransicion;
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!doc.startViewTransition || reducir) {
      aplicar();
      return;
    }
    const caja = e.currentTarget.getBoundingClientRect();
    raiz.style.setProperty('--tema-x', `${caja.left + caja.width / 2}px`);
    raiz.style.setProperty('--tema-y', `${caja.top + caja.height / 2}px`);
    doc.startViewTransition(aplicar);
  };

  return (
    <button
      type="button"
      className={estilos.boton}
      onClick={cambiar}
      aria-pressed={tema === null ? undefined : oscuro}
      aria-label="Modo oscuro"
      title={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      data-oscuro={oscuro || undefined}
    >
      <Sun className={estilos.sol} aria-hidden="true" size={18} strokeWidth={2.25} />
      <Moon className={estilos.luna} aria-hidden="true" size={18} strokeWidth={2.25} />
    </button>
  );
}
