import type { ReactNode } from 'react';
import estilos from './Tarjeta.module.css';

type PropsTarjeta = {
  titulo?: string;
  descripcion?: ReactNode;
  /** Zona inferior para acciones o metadatos. */
  pie?: ReactNode;
  className?: string;
  children?: ReactNode;
};

export function Tarjeta({ titulo, descripcion, pie, className, children }: PropsTarjeta) {
  return (
    <section className={[estilos.tarjeta, className].filter(Boolean).join(' ')}>
      {(titulo || descripcion) && (
        <header className={estilos.cabecera}>
          {titulo && <h2 className={estilos.titulo}>{titulo}</h2>}
          {descripcion && <p className={estilos.descripcion}>{descripcion}</p>}
        </header>
      )}
      {children && <div className={estilos.cuerpo}>{children}</div>}
      {pie && <footer className={estilos.pie}>{pie}</footer>}
    </section>
  );
}
