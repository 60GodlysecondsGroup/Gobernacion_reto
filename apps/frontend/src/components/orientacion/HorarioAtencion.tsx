import type { FichaServicio } from '@/lib/api/orientacion';
import { agruparDias, diaSemanaEnColombia, formatearIntervalo } from '@/lib/horarios';
import estilos from './HorarioAtencion.module.css';

type Props = { servicio: Pick<FichaServicio, 'horario' | 'horarioSemanal'> };

/** ¿Hay algo que mostrar como horario? (Sin él, la sección no se muestra.) */
export const tieneHorario = ({ horario, horarioSemanal }: Props['servicio']) =>
  Boolean(horarioSemanal || horario?.trim());

/**
 * Horario de atención de una fuente, tal como está registrado (nada inventado):
 * - Con horario semanal: una fila por grupo de días seguidos con el mismo horario («Lunes a
 *   viernes»), cada jornada en su propia línea (horario partido) y los días sin atención en tono
 *   suave. El grupo que incluye el día de hoy (en Colombia) se resalta con «Hoy».
 * - Solo con el texto (fuentes registradas antes del horario semanal): el texto tal cual.
 * - Sin horario: nada (el contenedor decide no mostrar la sección; ver `tieneHorario`).
 *
 * «Hoy» solo señala el día de la semana: no afirma que el servicio esté abierto (puede haber
 * festivos o cambios que la ficha no conoce).
 */
export function HorarioAtencion({ servicio }: Props) {
  const { horario, horarioSemanal } = servicio;

  if (!horarioSemanal) {
    return horario?.trim() ? <p className={estilos.textoLibre}>{horario}</p> : null;
  }

  const hoy = diaSemanaEnColombia();
  return (
    <div className={estilos.horario}>
      <dl className={estilos.dias}>
        {agruparDias(horarioSemanal).map(({ dias, incluye, intervalos }) => {
          const esHoy = incluye.includes(hoy);
          const sinAtencion = intervalos.length === 0;
          return (
            <div
              key={dias}
              className={[estilos.fila, esHoy && estilos.hoy, sinAtencion && estilos.sinAtencion]
                .filter(Boolean)
                .join(' ')}
            >
              <dt className={estilos.dia}>
                {dias}
                {esHoy && (
                  <span className={estilos.marcaHoy}>
                    <span className="visualmente-oculto">, </span>Hoy
                  </span>
                )}
              </dt>
              {sinAtencion ? (
                <dd className={estilos.horas}>Sin atención</dd>
              ) : (
                <dd className={estilos.horas}>
                  {intervalos.map((intervalo) => (
                    <span key={intervalo.apertura} className={estilos.jornada}>
                      {formatearIntervalo(intervalo)}
                    </span>
                  ))}
                </dd>
              )}
            </div>
          );
        })}
      </dl>
      <p className={estilos.nota}>Hora de Colombia.</p>
    </div>
  );
}
