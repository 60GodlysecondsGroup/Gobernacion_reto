import { ArrowUpRight } from 'lucide-react';
import { formatearWhatsapp, urlWhatsapp } from '@/lib/whatsapp';
import estilos from './ContactoWhatsApp.module.css';
import { IconoWhatsApp } from './IconoWhatsApp';

type Props = {
  /** Número guardado (E.164). Sin número, el componente no se usa: no deja espacios vacíos. */
  numero: string;
  /** Nombre del servicio, para que el lector de pantalla diga a quién se escribe. */
  servicio: string;
};

/**
 * Contacto por WhatsApp de la ficha: el número registrado y el botón «Contactar vía WhatsApp»,
 * que abre el enlace oficial `https://wa.me/<dígitos>` en otra pestaña (`noopener noreferrer`):
 * en el celular abre la aplicación o su alternativa web; en el computador, WhatsApp Web o la
 * aplicación instalada. Está activo en todas las fichas, también las de demostración: el número
 * lo registra el equipo de gestión desde el panel.
 */
export function ContactoWhatsApp({ numero, servicio }: Props) {
  const legible = formatearWhatsapp(numero);
  // El backend solo guarda números válidos; si aun así no lo fuera, se muestra sin botón.
  const href = urlWhatsapp(numero);

  return (
    <div className={estilos.whatsapp}>
      <span className={estilos.icono} aria-hidden="true">
        <IconoWhatsApp size={20} />
      </span>
      <span className={estilos.textos}>
        <span className={estilos.rotulo}>WhatsApp</span>
        <span className={estilos.numero}>{legible}</span>
      </span>
      {href && (
        <a
          className={estilos.boton}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Contactar vía WhatsApp a ${servicio} al ${legible} (abre WhatsApp en otra pestaña)`}
        >
          <IconoWhatsApp size={20} />
          Contactar vía WhatsApp
          <ArrowUpRight aria-hidden="true" size={16} className={estilos.flecha} />
        </a>
      )}
    </div>
  );
}
