'use client';

import { useId, type ComponentProps } from 'react';
import estilos from './CampoTexto.module.css';

type PropsCampoSeleccion = ComponentProps<'select'> & {
  etiqueta: string;
  opciones: { valor: string; etiqueta: string }[];
  ayuda?: string;
  error?: string;
  obligatorio?: boolean;
};

/** Lista desplegable con etiqueta, ayuda y error; mismo aspecto que CampoTexto. */
export function CampoSeleccion({
  etiqueta,
  opciones,
  ayuda,
  error,
  obligatorio,
  id: idPropio,
  className,
  ...resto
}: PropsCampoSeleccion) {
  const idGenerado = useId();
  const id = idPropio ?? idGenerado;
  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  const idError = error ? `${id}-error` : undefined;

  return (
    <div className={[estilos.campo, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={estilos.etiqueta}>
        {etiqueta}
        {obligatorio && <span className={estilos.obligatorio}>Obligatorio</span>}
      </label>
      <select
        {...resto}
        id={id}
        className={estilos.control}
        aria-invalid={error ? true : undefined}
        aria-required={obligatorio || undefined}
        aria-describedby={[idAyuda, idError].filter(Boolean).join(' ') || undefined}
      >
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.etiqueta}
          </option>
        ))}
      </select>
      {ayuda && (
        <p id={idAyuda} className={estilos.ayuda}>
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} className={estilos.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
