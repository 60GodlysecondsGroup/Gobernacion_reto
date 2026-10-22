import { Globe, MapPin, MessageCircle, Phone, Waypoints } from 'lucide-react';
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

const ICONOS_CANAL = {
  telefono: Phone,
  web: Globe,
  presencial: MapPin,
  chat: MessageCircle,
  otro: Waypoints,
} as const;

/** Icono del tipo de canal (apoyo visual: el tipo siempre se escribe al lado). */
export function IconoCanal({
  tipo,
  tamano = 20,
}: {
  tipo: FichaServicio['tipoCanal'];
  tamano?: number;
}) {
  const Icono = ICONOS_CANAL[tipo] ?? Waypoints;
  return <Icono size={tamano} strokeWidth={1.9} />;
}

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
      <span className={estilos.tipoCanal}>{TIPOS_CANAL[tipoCanal]}</span>
      {telefono &&
        (esDemo ? (
          <span className={estilos.dato}>
            <Phone aria-hidden="true" size={15} />
            {telefono}
          </span>
        ) : (
          <a
            className={`${estilos.dato} ${estilos.datoAccion}`}
            href={`tel:${telefono.replace(/[^\d+]/g, '')}`}
          >
            <Phone aria-hidden="true" size={15} />
            Llamar al {telefono}
          </a>
        ))}
      {enlace &&
        (esDemo ? (
          <span className={estilos.dato}>
            <Globe aria-hidden="true" size={15} />
            {dominio(enlace)}
          </span>
        ) : (
          <a
            className={`${estilos.dato} ${estilos.datoAccion}`}
            href={enlace}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Globe aria-hidden="true" size={15} />
            Abrir {dominio(enlace)} (sitio oficial, se abre en otra pestaña)
          </a>
        ))}
    </span>
  );
}
