'use client';

import { Clock, Copy, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Boton } from '@/components/ui';
import {
  DIAS_HABILES,
  DIAS_SEMANA,
  INTERVALO_24_HORAS,
  INTERVALO_OFICINA,
  MAX_INTERVALOS_DIA,
  NOMBRE_DIA,
  agruparDias,
  borradorVacio,
  horarioDesde,
  type BorradorHorario,
  type DiaSemana,
  type ErroresHorario,
  type Intervalo,
} from '@/lib/horarios';
import estilos from './SelectorHorario.module.css';

type Props = {
  /** null: la fuente conserva su horario en texto (registrado antes del horario semanal). */
  borrador: BorradorHorario | null;
  alCambiar: (borrador: BorradorHorario | null) => void;
  errores: ErroresHorario;
  /** Texto guardado antes del horario semanal, para tenerlo a la vista mientras se configura. */
  textoAnterior?: string | null;
  /** Error que devolvió el servidor para el horario. */
  errorServidor?: string;
};

const copiar = (intervalos: Intervalo[]) => intervalos.map((i) => ({ ...i }));

/** En `<input type="time">` no existe 24:00: en el cierre, 00:00 significa medianoche. */
const aControl = (hora: string) => (hora === '24:00' ? '00:00' : hora);
const desdeControl = (hora: string, campo: keyof Intervalo) =>
  campo === 'cierre' && hora === '00:00' ? '24:00' : hora;

/**
 * Horario de atención de una fuente (F32): días con interruptor, uno o varios intervalos por día,
 * atajos para los casos comunes y copia de un día a otros. Reemplaza el texto libre.
 */
export function SelectorHorario({
  borrador,
  alCambiar,
  errores,
  textoAnterior,
  errorServidor,
}: Props) {
  const id = useId();
  const [copiandoDesde, setCopiandoDesde] = useState<DiaSemana | null>(null);
  const [destinos, setDestinos] = useState<DiaSemana[]>([]);

  const cabecera = (
    <legend className={estilos.leyenda}>
      Horario de atención <span className={estilos.nota}>Opcional</span>
    </legend>
  );

  if (!borrador) {
    return (
      <fieldset className={estilos.horario}>
        {cabecera}
        <div className={estilos.anterior}>
          <Clock aria-hidden="true" size={20} />
          <div>
            <p className={estilos.anteriorTitulo}>Horario guardado como texto</p>
            <p className={estilos.anteriorTexto}>«{textoAnterior}»</p>
            <p className={estilos.ayuda}>
              Se conserva tal cual mientras no configures el horario semanal.
            </p>
          </div>
        </div>
        <div>
          <Boton variante="secundario" tamano="sm" onClick={() => alCambiar(borradorVacio())}>
            Configurar horario semanal
          </Boton>
        </div>
      </fieldset>
    );
  }

  const cambiarDia = (dia: DiaSemana, cambio: Partial<BorradorHorario[DiaSemana]>) =>
    alCambiar({ ...borrador, [dia]: { ...borrador[dia], ...cambio } });

  const alternarDia = (dia: DiaSemana, activo: boolean) => {
    const { intervalos } = borrador[dia];
    cambiarDia(dia, {
      activo,
      intervalos: activo && intervalos.length === 0 ? [{ ...INTERVALO_OFICINA }] : intervalos,
    });
    if (!activo && copiandoDesde === dia) setCopiandoDesde(null);
  };

  const cambiarHora = (dia: DiaSemana, i: number, campo: keyof Intervalo, valor: string) =>
    cambiarDia(dia, {
      intervalos: borrador[dia].intervalos.map((intervalo, k) =>
        k === i ? { ...intervalo, [campo]: desdeControl(valor, campo) } : intervalo,
      ),
    });

  /** Propone el siguiente intervalo una hora después del último cierre. */
  const agregarIntervalo = (dia: DiaSemana) => {
    const { intervalos } = borrador[dia];
    const ultimo = intervalos[intervalos.length - 1];
    const hora =
      ultimo && /^\d\d:\d\d$/.test(ultimo.cierre) ? Number(ultimo.cierre.slice(0, 2)) : 13;
    const nuevo =
      hora + 2 <= 23
        ? {
            apertura: `${String(hora + 1).padStart(2, '0')}:00`,
            cierre: `${String(hora + 2).padStart(2, '0')}:00`,
          }
        : { apertura: '', cierre: '' };
    cambiarDia(dia, { intervalos: [...intervalos, nuevo] });
  };

  const quitarIntervalo = (dia: DiaSemana, i: number) => {
    const intervalos = borrador[dia].intervalos.filter((_, k) => k !== i);
    cambiarDia(dia, { intervalos, activo: intervalos.length > 0 });
  };

  const aplicarATodos = (dias: DiaSemana[], intervalos: Intervalo[]) => {
    setCopiandoDesde(null);
    alCambiar(
      Object.fromEntries(
        DIAS_SEMANA.map((dia) => [
          dia,
          dias.includes(dia)
            ? { activo: true, intervalos: copiar(intervalos) }
            : { activo: false, intervalos: borrador[dia].intervalos },
        ]),
      ) as BorradorHorario,
    );
  };

  const abrirCopia = (dia: DiaSemana) => {
    setCopiandoDesde(copiandoDesde === dia ? null : dia);
    setDestinos([]);
  };

  const alternarDestino = (dia: DiaSemana) =>
    setDestinos((actual) =>
      actual.includes(dia) ? actual.filter((d) => d !== dia) : [...actual, dia],
    );

  const aplicarCopia = () => {
    if (!copiandoDesde) return;
    const origen = borrador[copiandoDesde];
    const nuevo = { ...borrador };
    for (const dia of destinos) {
      nuevo[dia] = { activo: origen.activo, intervalos: copiar(origen.intervalos) };
    }
    alCambiar(nuevo);
    setCopiandoDesde(null);
  };

  const horario = horarioDesde(borrador);
  const hayErrores = Object.keys(errores).length > 0;

  return (
    <fieldset className={estilos.horario} aria-describedby={`${id}-ayuda`}>
      {cabecera}
      <p id={`${id}-ayuda`} className={estilos.ayuda}>
        Activa los días con atención y define sus franjas. Para una jornada partida, agrega otro
        intervalo al mismo día.
      </p>

      {textoAnterior && (
        <div className={estilos.anterior}>
          <Clock aria-hidden="true" size={20} />
          <div>
            <p className={estilos.anteriorTitulo}>Texto anterior: «{textoAnterior}»</p>
            <p className={estilos.ayuda}>Al guardar, se reemplaza por el horario semanal.</p>
          </div>
          <Boton variante="fantasma" tamano="sm" onClick={() => alCambiar(null)}>
            Mantener el texto
          </Boton>
        </div>
      )}

      <div className={estilos.atajos} role="group" aria-label="Atajos de horario">
        <button
          type="button"
          className={estilos.atajo}
          onClick={() => aplicarATodos(DIAS_HABILES, [INTERVALO_OFICINA])}
        >
          Lunes a viernes, 8:00 a. m. – 5:00 p. m.
        </button>
        <button
          type="button"
          className={estilos.atajo}
          onClick={() => aplicarATodos([...DIAS_SEMANA], [INTERVALO_24_HORAS])}
        >
          24 horas, todos los días
        </button>
        {horario && (
          <button
            type="button"
            className={`${estilos.atajo} ${estilos.atajoQuitar}`}
            onClick={() => aplicarATodos([], [])}
          >
            Quitar horario
          </button>
        )}
      </div>

      <ul className={estilos.dias}>
        {DIAS_SEMANA.map((dia) => {
          const { activo, intervalos } = borrador[dia];
          const idDia = `${id}-${dia}`;
          return (
            <li key={dia} className={`${estilos.dia} ${activo ? '' : estilos.diaInactivo}`}>
              <div className={estilos.cabeceraDia}>
                <label className={estilos.interruptor}>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={activo}
                    onChange={(e) => alternarDia(dia, e.target.checked)}
                    aria-describedby={`${idDia}-estado`}
                  />
                  <span className={estilos.pista} aria-hidden="true" />
                  <span className={estilos.nombreDia}>{NOMBRE_DIA[dia]}</span>
                </label>
                <span id={`${idDia}-estado`} className={estilos.estadoDia}>
                  {activo
                    ? `${intervalos.length} ${intervalos.length === 1 ? 'intervalo' : 'intervalos'}`
                    : 'Sin atención'}
                </span>
                {activo && (
                  <div className={estilos.accionesDia}>
                    <button
                      type="button"
                      className={estilos.accion}
                      onClick={() => cambiarDia(dia, { intervalos: [{ ...INTERVALO_24_HORAS }] })}
                      aria-label={`${NOMBRE_DIA[dia]}: atención 24 horas`}
                    >
                      24 h
                    </button>
                    <button
                      type="button"
                      className={estilos.accion}
                      onClick={() => abrirCopia(dia)}
                      aria-expanded={copiandoDesde === dia}
                      aria-controls={`${idDia}-copia`}
                    >
                      <Copy aria-hidden="true" size={16} />
                      Copiar a…
                    </button>
                  </div>
                )}
              </div>

              {activo && (
                <div className={estilos.intervalos}>
                  {errores[dia] && (
                    <p className={estilos.error} role="alert">
                      {errores[dia]}
                    </p>
                  )}
                  {intervalos.map((intervalo, i) => {
                    const errorApertura = errores[`${dia}.${i}.apertura`];
                    const errorCierre = errores[`${dia}.${i}.cierre`];
                    const idError = `${idDia}-${i}-error`;
                    const etiqueta = `${NOMBRE_DIA[dia]}, intervalo ${i + 1}`;
                    return (
                      <div key={i} className={estilos.intervalo}>
                        <div className={estilos.horas}>
                          <label className={estilos.hora}>
                            <span className={estilos.etiquetaHora}>Abre</span>
                            <input
                              type="time"
                              step={300}
                              className={estilos.control}
                              value={aControl(intervalo.apertura)}
                              onChange={(e) => cambiarHora(dia, i, 'apertura', e.target.value)}
                              aria-label={`${etiqueta}: apertura`}
                              aria-invalid={errorApertura ? true : undefined}
                              aria-describedby={errorApertura ? idError : undefined}
                            />
                          </label>
                          <span className={estilos.separador} aria-hidden="true">
                            –
                          </span>
                          <label className={estilos.hora}>
                            <span className={estilos.etiquetaHora}>Cierra</span>
                            <input
                              type="time"
                              step={300}
                              className={estilos.control}
                              value={aControl(intervalo.cierre)}
                              onChange={(e) => cambiarHora(dia, i, 'cierre', e.target.value)}
                              aria-label={`${etiqueta}: cierre`}
                              aria-invalid={errorCierre ? true : undefined}
                              aria-describedby={errorCierre ? idError : undefined}
                            />
                          </label>
                          <button
                            type="button"
                            className={estilos.quitar}
                            onClick={() => quitarIntervalo(dia, i)}
                            aria-label={`Quitar ${etiqueta.toLowerCase()}`}
                            title="Quitar intervalo"
                          >
                            <Trash2 aria-hidden="true" size={18} />
                          </button>
                        </div>
                        {(errorApertura || errorCierre) && (
                          <p id={idError} className={estilos.error} role="alert">
                            {[errorApertura, errorCierre].filter(Boolean).join(' ')}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  <div>
                    <button
                      type="button"
                      className={estilos.agregar}
                      onClick={() => agregarIntervalo(dia)}
                      disabled={intervalos.length >= MAX_INTERVALOS_DIA}
                    >
                      <Plus aria-hidden="true" size={16} />
                      {intervalos.length >= MAX_INTERVALOS_DIA
                        ? `Máximo ${MAX_INTERVALOS_DIA} intervalos`
                        : 'Agregar intervalo'}
                    </button>
                  </div>
                </div>
              )}

              {copiandoDesde === dia && (
                <div id={`${idDia}-copia`} className={estilos.copia}>
                  <p className={estilos.copiaTitulo}>
                    Copiar el horario del {NOMBRE_DIA[dia].toLowerCase()} a:
                  </p>
                  <div className={estilos.destinos}>
                    {DIAS_SEMANA.filter((d) => d !== dia).map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={estilos.destino}
                        aria-pressed={destinos.includes(d)}
                        onClick={() => alternarDestino(d)}
                      >
                        {NOMBRE_DIA[d]}
                      </button>
                    ))}
                  </div>
                  <div className={estilos.filaCopia}>
                    <button
                      type="button"
                      className={estilos.enlace}
                      onClick={() => setDestinos(DIAS_HABILES.filter((d) => d !== dia))}
                    >
                      Días hábiles
                    </button>
                    <button
                      type="button"
                      className={estilos.enlace}
                      onClick={() => setDestinos(DIAS_SEMANA.filter((d) => d !== dia))}
                    >
                      Todos
                    </button>
                    <span className={estilos.espaciador} />
                    <Boton variante="fantasma" tamano="sm" onClick={() => setCopiandoDesde(null)}>
                      Cancelar
                    </Boton>
                    <Boton tamano="sm" onClick={aplicarCopia} disabled={destinos.length === 0}>
                      Copiar
                    </Boton>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {errorServidor && (
        <p className={estilos.error} role="alert">
          {errorServidor}
        </p>
      )}

      <div className={estilos.resumen} aria-live="polite">
        <p className={estilos.resumenTitulo}>Así se verá en la ficha</p>
        {horario ? (
          <dl className={`${estilos.resumenLista} ${hayErrores ? estilos.resumenConErrores : ''}`}>
            {agruparDias(horario).map(({ dias, texto }) => (
              <div key={dias} className={estilos.resumenFila}>
                <dt>{dias}</dt>
                <dd className={texto === 'sin atención' ? estilos.sinAtencion : undefined}>
                  {texto}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className={estilos.ayuda}>Sin horario: la ficha no mostrará horario de atención.</p>
        )}
        <p className={estilos.ayuda}>
          ¿Atiende pasada la medianoche? Pon el cierre a las 12:00 a. m. y sigue el día siguiente
          desde las 12:00 a. m.
        </p>
      </div>
    </fieldset>
  );
}
