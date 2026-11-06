import { Globe, MapPin, MessageCircle, Phone, Waypoints } from 'lucide-react';
import { TIPOS_CANAL } from '@/config/fuentes';
import type { FichaServicio } from '@/lib/api/orientacion';
import { formatearWhatsapp, urlWhatsapp } from '@/lib/whatsapp';
import { IconoWhatsApp } from './IconoWhatsApp';
import estilos from './Orientacion.module.css';

/** Dominio de un enlace, para nombrarlo sin mostrar la URL completa. */
export const dominio = (enlace: string) => {
  try {
    return new URL(enlace).hostname;
  } catch {
    return enlace;
  }
};

/** Enlace `tel:` de un teléfono registrado (solo dígitos y +). */
export const hrefTelefono = (telefono: string) => `tel:${telefono.replace(/[^\d+]/g, '')}`;

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
 * Cómo contactar el servicio. El teléfono y el enlace de los registros de demostración se
 * muestran como texto, sin llamadas ni enlaces. El WhatsApp, si lo tiene, abre siempre
 * `https://wa.me/…` en otra pestaña (lo registra el equipo de gestión desde el panel).
 */
export function ContactoServicio({
  servicio,
  sinWhatsapp = false,
}: {
  servicio: Pick<FichaServicio, 'tipoCanal' | 'telefono' | 'enlace' | 'whatsapp' | 'esDemo'>;
  /** Cuando el WhatsApp ya se muestra aparte, con su botón grande (modal de la ficha). */
  sinWhatsapp?: boolean;
}) {
  const { tipoCanal, telefono, enlace, esDemo } = servicio;
  const whatsapp = sinWhatsapp || !servicio.whatsapp ? null : servicio.whatsapp;
  const hrefWhatsapp = whatsapp && urlWhatsapp(whatsapp);

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
          <a className={`${estilos.dato} ${estilos.datoAccion}`} href={hrefTelefono(telefono)}>
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
      {whatsapp && hrefWhatsapp && (
        <a
          className={`${estilos.dato} ${estilos.datoAccion} ${estilos.datoWhatsapp}`}
          href={hrefWhatsapp}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Contactar vía WhatsApp al ${formatearWhatsapp(whatsapp)} (abre WhatsApp en otra pestaña)`}
        >
          <IconoWhatsApp size={15} />
          WhatsApp {formatearWhatsapp(whatsapp)}
        </a>
      )}
    </span>
  );
}
