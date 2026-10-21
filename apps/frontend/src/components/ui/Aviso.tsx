import type { ReactNode } from 'react';
import estilos from './Aviso.module.css';

type TonoAviso = 'info' | 'exito' | 'advertencia' | 'peligro';

/** Mensaje destacado. Los de peligro se anuncian de inmediato a lectores de pantalla. */
export function Aviso({
  tono = 'info',
  titulo,
  children,
}: {
  tono?: TonoAviso;
  titulo?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`${estilos.aviso} ${estilos[tono]}`}
      role={tono === 'peligro' ? 'alert' : 'status'}
    >
      {titulo && <p className={estilos.titulo}>{titulo}</p>}
      {children && <div className={estilos.cuerpo}>{children}</div>}
    </div>
  );
}
