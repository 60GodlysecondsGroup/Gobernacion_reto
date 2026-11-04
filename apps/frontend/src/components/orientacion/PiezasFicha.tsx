import Link from 'next/link';
import { Insignia } from '@/components/ui';
import { ESTADOS_FUENTE } from '@/config/fuentes';
import type { FichaServicio } from '@/lib/api/orientacion';
import { formatearFecha } from '@/lib/fechas';
import estilos from './PiezasFicha.module.css';

/**
 * Piezas de la ficha de servicio que comparten la página de la ficha (`FichaCompleta`) y el modal
 * de consulta rápida (`DetalleServicio`): mismo texto y misma presentación en los dos sitios.
 */
export const AVISO_PLATAFORMA =
  'La plataforma organiza información de instituciones: no presta este servicio ni habla en su nombre.';

/** Temas de orientación en los que aparece el servicio, cada uno con enlace a su lista. */
export function TemasRelacionados({ necesidades }: { necesidades: FichaServicio['necesidades'] }) {
  return (
    <ul className={estilos.temas}>
      {necesidades.map((necesidad) => (
        <li key={necesidad.codigo}>
          <Link href={`/orientacion/${necesidad.codigo}`} className={estilos.tema}>
            {necesidad.nombre}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Institución, fuente, fecha de verificación y estado: el orden de transparencia (B.6).
 * Con `enRejilla`, cada dato es una celda con su rótulo encima (más compacto en pantallas amplias).
 */
export function DatosVerificacion({
  servicio,
  enRejilla = false,
}: {
  servicio: Pick<FichaServicio, 'institucion' | 'fuenteOriginal' | 'fechaVerificacion' | 'estado'>;
  enRejilla?: boolean;
}) {
  const estado = ESTADOS_FUENTE[servicio.estado];
  return (
    <dl className={enRejilla ? `${estilos.datos} ${estilos.rejilla}` : estilos.datos}>
      <div>
        <dt>Institución</dt>
        <dd>{servicio.institucion}</dd>
      </div>
      <div>
        <dt>Fuente</dt>
        <dd>{servicio.fuenteOriginal}</dd>
      </div>
      <div>
        <dt>Verificado</dt>
        <dd>{formatearFecha(servicio.fechaVerificacion)}</dd>
      </div>
      <div>
        <dt>Estado</dt>
        <dd>
          <Insignia tono={estado.tono}>{estado.etiqueta}</Insignia>
        </dd>
      </div>
    </dl>
  );
}
