import { ArrowRight, CalendarCheck } from 'lucide-react';
import Link from 'next/link';
import { Insignia } from '@/components/ui';
import { ESTADOS_FUENTE } from '@/config/fuentes';
import type { FichaServicio } from '@/lib/api/orientacion';
import { formatearFecha } from '@/lib/fechas';
import { ContactoServicio, IconoCanal } from './ContactoServicio';
import estilos from './Orientacion.module.css';

/**
 * Resumen de un servicio en listas: siempre con canal, fuente y fecha de verificación.
 * Con `nuevaPestana`, la ficha completa se abre aparte (p. ej. sin salir de una sala).
 */
export function TarjetaServicio({
  servicio,
  nuevaPestana = false,
}: {
  servicio: FichaServicio;
  nuevaPestana?: boolean;
}) {
  const estado = ESTADOS_FUENTE[servicio.estado];
  const href = `/orientacion/servicios/${servicio.id}`;

  return (
    <article className={`${estilos.tarjeta} con-luz`}>
      <div className={estilos.cabeceraTarjeta}>
        <span className={estilos.iconoCanal} aria-hidden="true">
          <IconoCanal tipo={servicio.tipoCanal} />
        </span>
        <div className={estilos.insignias}>
          {servicio.estado !== 'activo' && (
            <Insignia tono={estado.tono}>{estado.etiqueta}</Insignia>
          )}
          {servicio.esDemo && <Insignia tono="info">Dato de demostración</Insignia>}
        </div>
      </div>
      <div className={estilos.cuerpoTarjeta}>
        <h2 className={estilos.tituloTarjeta}>
          {nuevaPestana ? (
            <a href={href} target="_blank" rel="noopener">
              {servicio.servicio} (se abre en otra pestaña)
            </a>
          ) : (
            <Link href={href}>{servicio.servicio}</Link>
          )}
        </h2>
        <p className={estilos.institucion}>{servicio.institucion}</p>
      </div>
      <ContactoServicio servicio={servicio} />
      <div className={estilos.pieTarjeta}>
        <p className={estilos.procedencia}>
          <CalendarCheck aria-hidden="true" size={16} />
          <span>
            Fuente: {servicio.fuenteOriginal} · Verificado el{' '}
            {formatearFecha(servicio.fechaVerificacion)}
          </span>
        </p>
        {!nuevaPestana && (
          <Link href={href} className={estilos.verFicha}>
            Ver ficha
            <span className="visualmente-oculto"> de {servicio.servicio}</span>
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        )}
      </div>
    </article>
  );
}
