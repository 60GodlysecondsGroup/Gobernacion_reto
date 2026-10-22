import { CircleAlert, CircleCheck, Info, ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import estilos from './Aviso.module.css';

type TonoAviso = 'info' | 'exito' | 'advertencia' | 'peligro';

const ICONOS = { info: Info, exito: CircleCheck, advertencia: CircleAlert, peligro: ShieldAlert };

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
  const Icono = ICONOS[tono];
  return (
    <div
      className={`${estilos.aviso} ${estilos[tono]}`}
      role={tono === 'peligro' ? 'alert' : 'status'}
    >
      <Icono className={estilos.icono} aria-hidden="true" size={20} />
      {titulo && <p className={estilos.titulo}>{titulo}</p>}
      {children && <div className={estilos.cuerpo}>{children}</div>}
    </div>
  );
}
