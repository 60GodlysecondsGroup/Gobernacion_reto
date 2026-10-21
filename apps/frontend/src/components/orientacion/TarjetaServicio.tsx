import Link from 'next/link';
import { Insignia } from '@/components/ui';
import { ESTADOS_FUENTE } from '@/config/fuentes';
import type { FichaServicio } from '@/lib/api/orientacion';
import { formatearFecha } from '@/lib/fechas';
import { ContactoServicio } from './ContactoServicio';
import estilos from './Orientacion.module.css';

/** Resumen de un servicio en listas: siempre con canal, fuente y fecha de verificación. */
export function TarjetaServicio({ servicio }: { servicio: FichaServicio }) {
  const estado = ESTADOS_FUENTE[servicio.estado];

  return (
    <article className={estilos.tarjeta}>
      <div className={estilos.insignias}>
        {servicio.estado !== 'activo' && <Insignia tono={estado.tono}>{estado.etiqueta}</Insignia>}
        {servicio.esDemo && <Insignia tono="info">Dato de demostración</Insignia>}
      </div>
      <h2 className={estilos.tituloTarjeta}>
        <Link href={`/orientacion/servicios/${servicio.id}`}>{servicio.servicio}</Link>
      </h2>
      <p className={estilos.institucion}>{servicio.institucion}</p>
      <ContactoServicio servicio={servicio} />
      <p className={estilos.procedencia}>
        Fuente: {servicio.fuenteOriginal} · Verificado el{' '}
        {formatearFecha(servicio.fechaVerificacion)}
      </p>
    </article>
  );
}
