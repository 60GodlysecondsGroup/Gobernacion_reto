'use client';

import { useId, type ComponentProps } from 'react';
import estilos from './CampoTexto.module.css';

type PropsComunes = {
  etiqueta: string;
  /** Texto de apoyo bajo el campo. */
  ayuda?: string;
  /** Mensaje de error; marca el campo como inválido para lectores de pantalla. */
  error?: string;
};

type PropsCampoTexto =
  | (PropsComunes & ComponentProps<'input'> & { multilinea?: false })
  | (PropsComunes & ComponentProps<'textarea'> & { multilinea: true });

export function CampoTexto(props: PropsCampoTexto) {
  const idGenerado = useId();
  const { etiqueta, ayuda, error, multilinea, id = idGenerado, className, ...resto } = props;

  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  const idError = error ? `${id}-error` : undefined;
  const accesibilidad = {
    id,
    className: estilos.control,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': [idAyuda, idError].filter(Boolean).join(' ') || undefined,
  };

  return (
    <div className={[estilos.campo, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={estilos.etiqueta}>
        {etiqueta}
      </label>
      {multilinea ? (
        <textarea {...(resto as ComponentProps<'textarea'>)} {...accesibilidad} />
      ) : (
        <input {...(resto as ComponentProps<'input'>)} {...accesibilidad} />
      )}
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
