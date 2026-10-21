import { TIPOS_CANAL } from '@/config/fuentes';
import type { FichaServicio } from '@/lib/api/orientacion';
import estilos from './Orientacion.module.css';

const dominio = (enlace: string) => {
  try {
    return new URL(enlace).hostname;
  } catch {
    return enlace;
  }
};

/**
 * Cómo contactar el servicio. Los registros de demostración se muestran como texto, sin
 * enlaces ni llamadas: no corresponden a canales reales.
 */
export function ContactoServicio({
  servicio,
}: {
  servicio: Pick<FichaServicio, 'tipoCanal' | 'telefono' | 'enlace' | 'esDemo'>;
}) {
  const { tipoCanal, telefono, enlace, esDemo } = servicio;

  return (
    <span className={estilos.contacto}>
      <span>{TIPOS_CANAL[tipoCanal]}</span>
      {telefono &&
        (esDemo ? (
          <span className={estilos.dato}>{telefono}</span>
        ) : (
          <a className={estilos.dato} href={`tel:${telefono.replace(/[^\d+]/g, '')}`}>
            Llamar al {telefono}
          </a>
        ))}
      {enlace &&
        (esDemo ? (
          <span className={estilos.dato}>{dominio(enlace)}</span>
        ) : (
          <a className={estilos.dato} href={enlace} target="_blank" rel="noopener noreferrer">
            Abrir {dominio(enlace)} (sitio oficial, se abre en otra pestaña)
          </a>
        ))}
    </span>
  );
}
