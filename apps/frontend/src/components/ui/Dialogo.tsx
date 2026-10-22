'use client';

import { TriangleAlert, X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Boton } from './Boton';
import estilos from './Dialogo.module.css';

const DURACION_SALIDA_MS = 170;

/**
 * Diálogo modal sobre el elemento nativo `<dialog>` (patrón «Alert Dialog» de shadcn/ui sin
 * dependencias): el navegador atrapa el foco, Escape lo cierra y el resto de la página queda
 * inerte. Al cerrarse, el foco vuelve al botón que lo abrió.
 */
export function Dialogo({
  abierto,
  alCerrar,
  titulo,
  descripcion,
  children,
  acciones,
  tono = 'normal',
}: {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  descripcion?: ReactNode;
  children?: ReactNode;
  acciones?: ReactNode;
  tono?: 'normal' | 'peligro';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const idDescripcion = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto) {
      delete dialogo.dataset.cerrando;
      if (!dialogo.open) dialogo.showModal();
      return;
    }
    if (!dialogo.open) return;
    // Salida animada: el diálogo se desvanece y luego se cierra de verdad (devuelve el foco).
    const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (sinMovimiento) {
      dialogo.close();
      return;
    }
    dialogo.dataset.cerrando = '';
    const temporizador = setTimeout(() => {
      delete dialogo.dataset.cerrando;
      dialogo.close();
    }, DURACION_SALIDA_MS);
    return () => clearTimeout(temporizador);
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      className={estilos.dialogo}
      aria-labelledby={idTitulo}
      aria-describedby={descripcion ? idDescripcion : undefined}
      onClose={() => {
        if (abierto) alCerrar();
      }}
      onCancel={(evento) => {
        // Escape: cerramos con la misma animación de salida que el botón «Cerrar».
        evento.preventDefault();
        alCerrar();
      }}
      onClick={(evento) => {
        // Clic en el fondo (fuera de la caja): cierra.
        if (evento.target === evento.currentTarget) alCerrar();
      }}
    >
      <div className={estilos.caja}>
        <button type="button" className={estilos.cerrar} onClick={alCerrar}>
          <X aria-hidden="true" size={18} />
          <span className="visualmente-oculto">Cerrar</span>
        </button>
        {tono === 'peligro' && (
          <span className={estilos.iconoPeligro} aria-hidden="true">
            <TriangleAlert size={22} />
          </span>
        )}
        <h2 id={idTitulo} className={estilos.titulo}>
          {titulo}
        </h2>
        {descripcion && (
          <div id={idDescripcion} className={estilos.descripcion}>
            {descripcion}
          </div>
        )}
        {children}
        {acciones && <div className={estilos.acciones}>{acciones}</div>}
      </div>
    </dialog>
  );
}

/** Confirmación para acciones con consecuencias (ocultar, suspender, deshabilitar…). */
export function ConfirmarAccion({
  abierto,
  alCerrar,
  alConfirmar,
  titulo,
  descripcion,
  textoConfirmar,
  cargando = false,
  peligro = true,
}: {
  abierto: boolean;
  alCerrar: () => void;
  alConfirmar: () => void;
  titulo: string;
  descripcion: ReactNode;
  textoConfirmar: string;
  cargando?: boolean;
  peligro?: boolean;
}) {
  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={titulo}
      descripcion={descripcion}
      tono={peligro ? 'peligro' : 'normal'}
      acciones={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton
            variante={peligro ? 'peligro' : 'primario'}
            cargando={cargando}
            onClick={alConfirmar}
            autoFocus
          >
            {textoConfirmar}
          </Boton>
        </>
      }
    />
  );
}
