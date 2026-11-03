'use client';

import { ArrowRight, CalendarCheck } from 'lucide-react';
import Link from 'next/link';
import { useRef, type MouseEvent } from 'react';
import { Insignia } from '@/components/ui';
import { ESTADOS_FUENTE } from '@/config/fuentes';
import type { FichaServicio } from '@/lib/api/orientacion';
import { formatearFecha } from '@/lib/fechas';
import { ContactoServicio, IconoCanal } from './ContactoServicio';
import estilos from './Orientacion.module.css';

/** Clic normal (sin teclas ni botón central): los demás conservan «abrir en otra pestaña». */
const esClicSimple = (evento: MouseEvent) =>
  evento.button === 0 &&
  !evento.metaKey &&
  !evento.ctrlKey &&
  !evento.shiftKey &&
  !evento.altKey &&
  !evento.defaultPrevented;

/**
 * Resumen de un servicio en listas: siempre con canal, fuente y fecha de verificación.
 * Con `nuevaPestana`, la ficha completa se abre aparte (p. ej. sin salir de una sala).
 * Con `alAbrir`, un clic en la tarjeta (o en su título o «Ver ficha») abre la ficha completa en un
 * modal sin salir de la lista. Los enlaces siguen apuntando a la página de la ficha: con Ctrl/⌘
 * o el botón central se abre en otra pestaña, y los datos de contacto funcionan como siempre.
 */
export function TarjetaServicio({
  servicio,
  nuevaPestana = false,
  alAbrir,
}: {
  servicio: FichaServicio;
  nuevaPestana?: boolean;
  alAbrir?: (servicio: FichaServicio) => void;
}) {
  const estado = ESTADOS_FUENTE[servicio.estado];
  const href = `/orientacion/servicios/${servicio.id}`;
  const refTitulo = useRef<HTMLAnchorElement>(null);
  const conModal = Boolean(alAbrir) && !nuevaPestana;

  const abrir = () => {
    // El foco queda en el título: al cerrar el modal, el navegador lo devuelve aquí.
    refTitulo.current?.focus({ preventScroll: true });
    alAbrir?.(servicio);
  };

  const alPulsarEnlace = (evento: MouseEvent<HTMLAnchorElement>) => {
    if (!conModal || !esClicSimple(evento)) return;
    evento.preventDefault();
    abrir();
  };

  /** Clic en cualquier zona de la tarjeta que no sea un enlace ni un botón, ni al seleccionar texto. */
  const alPulsarTarjeta = (evento: MouseEvent<HTMLElement>) => {
    if (!conModal || !esClicSimple(evento)) return;
    if ((evento.target as HTMLElement).closest('a, button')) return;
    if (window.getSelection()?.toString()) return;
    abrir();
  };

  return (
    // La tarjeta entera es un atajo para el ratón y el tacto; con teclado se usa el enlace del
    // título (mismo resultado), así que la tarjeta no necesita foco propio.
    <article
      className={`${estilos.tarjeta} ${conModal ? estilos.tarjetaConModal : ''} con-luz`}
      onClick={conModal ? alPulsarTarjeta : undefined}
    >
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
            <Link
              ref={refTitulo}
              href={href}
              onClick={alPulsarEnlace}
              aria-haspopup={conModal ? 'dialog' : undefined}
            >
              {servicio.servicio}
            </Link>
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
          <Link
            href={href}
            className={estilos.verFicha}
            onClick={alPulsarEnlace}
            aria-haspopup={conModal ? 'dialog' : undefined}
          >
            Ver ficha
            <span className="visualmente-oculto"> de {servicio.servicio}</span>
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        )}
      </div>
    </article>
  );
}
