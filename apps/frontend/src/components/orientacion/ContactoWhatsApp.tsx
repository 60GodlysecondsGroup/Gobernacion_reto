import { ArrowUpRight } from 'lucide-react';
import { formatearWhatsapp, urlWhatsapp } from '@/lib/whatsapp';
import estilos from './ContactoWhatsApp.module.css';
import { IconoWhatsApp } from './IconoWhatsApp';

type Props = {
  /** Número guardado (E.164). Sin número, el componente no se usa: no deja espacios vacíos. */
  numero: string;
  /** Nombre del servicio, para que el lector de pantalla diga a quién se escribe. */
  servicio: string;
  esDemo: boolean;
};

/**
 * Contacto por WhatsApp de la ficha: el número registrado y el botón «Contactar vía WhatsApp»,
 * que abre el enlace oficial `https://wa.me/<dígitos>` en otra pestaña (`noopener noreferrer`):
 * en el celular abre la aplicación o su alternativa web; en el computador, WhatsApp Web o la
 * aplicación instalada. Los registros de demostración muestran el número como texto, sin botón,
 * igual que su teléfono y su enlace (un dato ficticio no debe poder usarse como un canal real).
 */
export function ContactoWhatsApp({ numero, servicio, esDemo }: Props) {
  const legible = formatearWhatsapp(numero);
  const href = esDemo ? null : urlWhatsapp(numero);

  return (
    <div className={estilos.whatsapp}>
      <span className={estilos.icono} aria-hidden="true">
        <IconoWhatsApp size={20} />
      </span>
      <span className={estilos.textos}>
        <span className={estilos.rotulo}>WhatsApp</span>
        <span className={estilos.numero}>{legible}</span>
        {!href && <span className={estilos.nota}>Sin enlace: es de demostración</span>}
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
