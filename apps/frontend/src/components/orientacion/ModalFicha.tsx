'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import estilos from './ModalFicha.module.css';

const DURACION_SALIDA_MS = 200;

/**
 * Modal de la ficha de servicio, sobre el elemento nativo `<dialog>`: el navegador atrapa el foco,
 * deja inerte el resto de la página y, al cerrar, devuelve el foco al botón que lo abrió.
 * Se cierra con el botón «Cerrar», con Escape o con un clic fuera del panel, siempre con la misma
 * animación de salida. En pantallas pequeñas se muestra como una hoja que sube desde abajo.
 * Con `ancho="amplio"`, en tableta y escritorio aprovecha más espacio (fichas completas).
 */
export function ModalFicha({
  abierto,
  alCerrar,
  icono,
  antetitulo,
  titulo,
  children,
  pie,
  ancho = 'normal',
}: {
  abierto: boolean;
  alCerrar: () => void;
  icono: ReactNode;
  antetitulo?: string;
  titulo: string;
  children: ReactNode;
  pie?: ReactNode;
  ancho?: 'normal' | 'amplio';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto) {
      delete dialogo.dataset.cerrando;
      if (!dialogo.open) dialogo.showModal();
      // La página de fondo no se desplaza mientras el modal está abierto.
      document.documentElement.classList.add(estilos.sinScroll!);
      return;
    }
    if (!dialogo.open) return;
    const cerrar = () => {
      delete dialogo.dataset.cerrando;
      dialogo.close();
      document.documentElement.classList.remove(estilos.sinScroll!);
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cerrar();
      return;
    }
    dialogo.dataset.cerrando = '';
    const temporizador = setTimeout(cerrar, DURACION_SALIDA_MS);
    return () => clearTimeout(temporizador);
  }, [abierto]);

  // Si la página cambia con el modal abierto, se libera el desplazamiento.
  useEffect(() => () => document.documentElement.classList.remove(estilos.sinScroll!), []);

  return (
    <dialog
      ref={ref}
      className={ancho === 'amplio' ? `${estilos.dialogo} ${estilos.amplio}` : estilos.dialogo}
      aria-labelledby={idTitulo}
      onCancel={(evento) => {
        evento.preventDefault();
        alCerrar();
      }}
      onClick={(evento) => {
        // Clic en el fondo (fuera del panel): cierra.
        if (evento.target === evento.currentTarget) alCerrar();
      }}
    >
      <div className={estilos.panel}>
        <header className={estilos.cabecera}>
          <span className={estilos.icono} aria-hidden="true">
            {icono}
          </span>
          <div className={estilos.titulos}>
            {antetitulo && <p className={estilos.antetitulo}>{antetitulo}</p>}
            <h2 id={idTitulo} className={estilos.titulo}>
              {titulo}
            </h2>
          </div>
          <button type="button" className={estilos.cerrar} onClick={alCerrar}>
            <X aria-hidden="true" size={20} />
            <span className="visualmente-oculto">Cerrar</span>
          </button>
        </header>
        <div className={estilos.cuerpo}>{children}</div>
        {pie && <footer className={estilos.pie}>{pie}</footer>}
      </div>
    </dialog>
  );
}
