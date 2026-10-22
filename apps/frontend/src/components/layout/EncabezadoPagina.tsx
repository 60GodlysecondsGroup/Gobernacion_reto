import type { ReactNode } from 'react';
import estilos from './EncabezadoPagina.module.css';

/**
 * Título de una página. `antetitulo` da contexto (la comunidad, la sección) y `acciones` ubica
 * los botones principales a la derecha en pantallas anchas.
 */
export function EncabezadoPagina({
  antetitulo,
  titulo,
  acciones,
  children,
  tono = 'normal',
}: {
  /** `ayuda` marca la página de «Necesito ayuda» con su color propio. */
  tono?: 'normal' | 'ayuda';
  antetitulo?: string;
  titulo: string;
  acciones?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className={estilos.encabezado}>
      <div className={estilos.textos}>
        {antetitulo && (
          <p className={`${estilos.antetitulo} ${tono === 'ayuda' ? estilos.antetituloAyuda : ''}`}>
            {antetitulo}
          </p>
        )}
        <h1 className={estilos.titulo}>{titulo}</h1>
        {children && <div className={estilos.descripcion}>{children}</div>}
      </div>
      {acciones && <div className={estilos.acciones}>{acciones}</div>}
    </header>
  );
}
