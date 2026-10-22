'use client';

import { useId, type ComponentProps } from 'react';
import estilos from './CampoTexto.module.css';

type PropsComunes = {
  etiqueta: string;
  /** Texto de apoyo bajo el campo: qué se espera y cómo escribirlo. */
  ayuda?: string;
  /** Mensaje de error; marca el campo como inválido para lectores de pantalla. */
  error?: string;
  /** Marca el campo como obligatorio de forma visible (no solo con un asterisco). */
  obligatorio?: boolean;
};

type PropsCampoTexto =
  | (PropsComunes & ComponentProps<'input'> & { multilinea?: false })
  | (PropsComunes & ComponentProps<'textarea'> & { multilinea: true });

export function CampoTexto(props: PropsCampoTexto) {
  const idGenerado = useId();
  const {
    etiqueta,
    ayuda,
    error,
    obligatorio,
    multilinea,
    id = idGenerado,
    className,
    ...resto
  } = props;

  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  const idError = error ? `${id}-error` : undefined;
  const accesibilidad = {
    id,
    className: estilos.control,
    'aria-invalid': error ? true : undefined,
    'aria-required': obligatorio || undefined,
    'aria-describedby': [idError, idAyuda].filter(Boolean).join(' ') || undefined,
  };

  // Contador de caracteres en los textos largos: avisa del límite antes de chocar con él.
  const maximo = multilinea ? resto.maxLength : undefined;
  const longitud = typeof resto.value === 'string' ? resto.value.length : 0;

  return (
    <div className={[estilos.campo, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={estilos.etiqueta}>
        {etiqueta}
        {obligatorio && <span className={estilos.obligatorio}>Obligatorio</span>}
      </label>
      {multilinea ? (
        <textarea {...(resto as ComponentProps<'textarea'>)} {...accesibilidad} />
      ) : (
        <input {...(resto as ComponentProps<'input'>)} {...accesibilidad} />
      )}
      {error && (
        <p id={idError} className={estilos.error} role="alert">
          {error}
        </p>
      )}
      {(ayuda || maximo) && (
        <div className={estilos.pie}>
          {ayuda && (
            <p id={idAyuda} className={estilos.ayuda}>
              {ayuda}
            </p>
          )}
          {maximo && (
            <span
              className={`${estilos.contador} ${longitud > maximo * 0.9 ? estilos.contadorCerca : ''}`}
              aria-hidden="true"
            >
              {longitud}/{maximo}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
