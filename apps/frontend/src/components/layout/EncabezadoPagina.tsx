import type { ReactNode } from 'react';
import estilos from './EncabezadoPagina.module.css';

export function EncabezadoPagina({
  antetitulo,
  titulo,
  children,
}: {
  antetitulo?: string;
  titulo: string;
  children?: ReactNode;
}) {
  return (
    <header className={estilos.encabezado}>
      {antetitulo && <p className={estilos.antetitulo}>{antetitulo}</p>}
      <h1 className={estilos.titulo}>{titulo}</h1>
      {children && <div className={estilos.descripcion}>{children}</div>}
    </header>
  );
}
