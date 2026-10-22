'use client';

import { PildoraActiva } from '@/components/movimiento/PildoraActiva';
import { useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { GraficoPorDia } from '@/components/panel/GraficoPorDia';
import panel from '@/components/panel/Panel.module.css';
import { Aviso, Insignia, Tarjeta } from '@/components/ui';
import { mensajeDeError } from '@/lib/api/cliente';
import { formatearFechaHora } from '@/lib/fechas';
import { obtenerIncidenciasDlp, type IncidenciasDlp } from '@/lib/api/moderacion';
import estilos from './PanelIncidencias.module.css';

const PERIODOS = [
  { dias: 1, etiqueta: '24 horas' },
  { dias: 7, etiqueta: '7 días' },
  { dias: 30, etiqueta: '30 días' },
];

const TIPO_CONTENIDO: Record<string, string> = {
  perfil: 'Perfil',
  hilo: 'Hilo',
  respuesta: 'Respuesta',
  sala: 'Chat de sala',
  reporte: 'Detalle de un reporte',
};

/** Incidencias DLP (F35). Por minimización no hay texto ni autor: el backend nunca los entrega. */
export function PanelIncidencias() {
  const [dias, setDias] = useState(7);
  const [datos, setDatos] = useState<IncidenciasDlp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    obtenerIncidenciasDlp(dias)
      .then((respuesta) => vigente && setDatos(respuesta))
      .catch((e: unknown) => vigente && setError(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, [dias]);

  const elegirPeriodo = (nuevo: number) => {
    setDatos(null);
    setError(null);
    setDias(nuevo);
  };

  const total = datos?.resumen.reduce((suma, c) => suma + c.total, 0) ?? 0;
  const maximo = Math.max(1, ...(datos?.resumen.map((c) => c.total) ?? [0]));

  return (
    <>
      <EncabezadoPagina antetitulo="Panel administrativo" titulo="Incidencias del DLP">
        Bloqueos del filtro automático de contenido. No se muestra el texto bloqueado (nunca se
        guarda) ni quién lo escribió.
      </EncabezadoPagina>

      <div className={panel.filtros} role="group" aria-label="Periodo">
        {PERIODOS.map((periodo) => (
          <button
            key={periodo.dias}
            type="button"
            className={panel.filtro}
            aria-pressed={periodo.dias === dias}
            onClick={() => elegirPeriodo(periodo.dias)}
          >
            {periodo.dias === dias && <PildoraActiva grupo="periodo-incidencias" />}
            Últimos {periodo.etiqueta}
          </button>
        ))}
      </div>

      {error && <Aviso tono="peligro">{error}</Aviso>}
      {!datos && !error && <span className="esqueleto" style={{ height: '16rem' }} />}

      {datos && (
        <>
          <div className={panel.dosColumnas}>
            <Tarjeta
              titulo={`${total} ${total === 1 ? 'bloqueo' : 'bloqueos'} por categoría`}
              descripcion="Las seis categorías de protección de la sección 16.1."
            >
              <ul className={estilos.categorias}>
                {datos.resumen.map((categoria) => (
                  <li key={categoria.categoria} className={estilos.categoria}>
                    <span className={estilos.nombreCategoria}>{categoria.nombre}</span>
                    <span className={estilos.pista} aria-hidden="true">
                      <span
                        className={estilos.relleno}
                        style={{ width: `${(categoria.total / maximo) * 100}%` }}
                      />
                    </span>
                    <span className={estilos.total}>{categoria.total}</span>
                  </li>
                ))}
              </ul>
            </Tarjeta>
            <Tarjeta
              titulo="Por día"
              descripcion={
                datos.porTipo.length
                  ? `Dónde ocurrieron: ${datos.porTipo
                      .map(
                        (t) => `${TIPO_CONTENIDO[t.tipoContenido] ?? t.tipoContenido} (${t.total})`,
                      )
                      .join(', ')}.`
                  : 'Sin bloqueos en el periodo.'
              }
            >
              <GraficoPorDia datos={datos.porDia} />
            </Tarjeta>
          </div>

          <Tarjeta titulo="Más recientes" descripcion="Hasta 50 eventos del periodo elegido.">
            {datos.recientes.length === 0 ? (
              <p className={panel.detalleIndicador}>
                No hay incidencias en este periodo. Prueba publicar «escríbeme al 3000000000» con un
                usuario de prueba para ver una.
              </p>
            ) : (
              <div className={panel.tablaContenedor}>
                <table className={panel.tabla}>
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Categoría</th>
                      <th scope="col">Dónde</th>
                      <th scope="col">Regla</th>
                      <th scope="col">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.recientes.map((evento, i) => (
                      <tr key={`${evento.fecha}-${i}`}>
                        <td>{formatearFechaHora(evento.fecha)}</td>
                        <td>{evento.nombreCategoria}</td>
                        <td>{TIPO_CONTENIDO[evento.tipoContenido] ?? evento.tipoContenido}</td>
                        <td>
                          <code>{evento.regla ?? 'clasificador'}</code>
                        </td>
                        <td>
                          <Insignia
                            tono={evento.resultado === 'bloqueado' ? 'peligro' : 'advertencia'}
                          >
                            {evento.resultado}
                          </Insignia>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Tarjeta>
        </>
      )}
    </>
  );
}
