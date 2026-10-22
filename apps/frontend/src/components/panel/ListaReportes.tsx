'use client';

import { PildoraActiva } from '@/components/movimiento/PildoraActiva';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso, Boton, Insignia, type TonoInsignia } from '@/components/ui';
import { mensajeDeError } from '@/lib/api/cliente';
import { formatearFechaHora, haceTiempo } from '@/lib/fechas';
import {
  ESTADOS_REPORTE,
  listarReportes,
  NOMBRE_ESTADO_REPORTE,
  NOMBRE_MOTIVO,
  NOMBRE_RESOLUCION,
  NOMBRE_TIPO,
  type EstadoReporte,
  type ListaReportes as Lista,
} from '@/lib/api/moderacion';
import estilos from './Panel.module.css';

export const TONO_ESTADO: Record<EstadoReporte, TonoInsignia> = {
  pendiente: 'advertencia',
  en_revision: 'info',
  resuelto: 'exito',
  descartado: 'neutro',
};

/** F30: reportes con filtro por estado. Primero los pendientes, después los demás. */
export function ListaReportes() {
  const [estado, setEstado] = useState<EstadoReporte | null>('pendiente');
  const [lista, setLista] = useState<Lista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);

  const cargar = useCallback(async (filtro: EstadoReporte | null, pagina: number) => {
    const respuesta = await listarReportes(filtro, pagina);
    setLista((anterior) =>
      pagina === 1 || !anterior
        ? respuesta
        : { ...respuesta, reportes: [...anterior.reportes, ...respuesta.reportes] },
    );
  }, []);

  useEffect(() => {
    listarReportes(estado, 1)
      .then(setLista)
      .catch((e: unknown) => setError(mensajeDeError(e)));
  }, [estado, cargar]);

  const elegir = (nuevo: EstadoReporte | null) => {
    if (nuevo === estado) return;
    setLista(null);
    setError(null);
    setEstado(nuevo);
  };

  const total = lista ? Object.values(lista.conteo).reduce((a, b) => a + b, 0) : 0;

  return (
    <>
      <EncabezadoPagina antetitulo="Panel administrativo" titulo="Reportes">
        Cada reporte muestra el motivo, la fecha y el contenido asociado. Nunca se muestra quién
        reportó.
      </EncabezadoPagina>

      <div className={estilos.filtros} role="group" aria-label="Filtrar por estado">
        {ESTADOS_REPORTE.map(({ valor, etiqueta }) => (
          <button
            key={valor}
            type="button"
            className={estilos.filtro}
            aria-pressed={estado === valor}
            onClick={() => elegir(valor)}
          >
            {estado === valor && <PildoraActiva grupo="estados-reporte" />}
            {etiqueta}
            {lista && <span className={estilos.cuentaFiltro}>{lista.conteo[valor]}</span>}
          </button>
        ))}
        <button
          type="button"
          className={estilos.filtro}
          aria-pressed={estado === null}
          onClick={() => elegir(null)}
        >
          {estado === null && <PildoraActiva grupo="estados-reporte" />}
          Todos
          {lista && <span className={estilos.cuentaFiltro}>{total}</span>}
        </button>
      </div>

      {error && <Aviso tono="peligro">{error}</Aviso>}
      {!lista && !error && <span className="esqueleto" style={{ height: '14rem' }} />}

      {lista && lista.reportes.length === 0 && (
        <div className={estilos.vacio}>
          <strong>
            {estado ? `No hay reportes en «${NOMBRE_ESTADO_REPORTE[estado]}».` : 'No hay reportes.'}
          </strong>
          Cuando alguien reporte un hilo, una respuesta, un perfil o una sala, aparecerá aquí.
        </div>
      )}

      {lista && lista.reportes.length > 0 && (
        <div className={estilos.tablaContenedor}>
          <table className={estilos.tabla}>
            <thead>
              <tr>
                <th scope="col">Motivo</th>
                <th scope="col">Contenido</th>
                <th scope="col">Comunidad</th>
                <th scope="col">Recibido</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {lista.reportes.map((reporte) => (
                <tr key={reporte.id}>
                  <td>
                    <Link href={`/panel/reportes/${reporte.id}`} className={estilos.enlaceFila}>
                      {NOMBRE_MOTIVO[reporte.motivo] ?? reporte.motivo}
                    </Link>
                  </td>
                  <td>{NOMBRE_TIPO[reporte.tipoContenido]}</td>
                  <td>{reporte.comunidad ?? '—'}</td>
                  <td>
                    <time dateTime={reporte.fecha} title={formatearFechaHora(reporte.fecha)}>
                      {haceTiempo(reporte.fecha)}
                    </time>
                  </td>
                  <td>
                    <Insignia tono={TONO_ESTADO[reporte.estado]}>
                      {NOMBRE_ESTADO_REPORTE[reporte.estado]}
                      {reporte.resolucion && reporte.resolucion !== 'sin_accion'
                        ? `: ${NOMBRE_RESOLUCION[reporte.resolucion].toLowerCase()}`
                        : ''}
                    </Insignia>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lista?.hayMas && (
        <div>
          <Boton
            variante="secundario"
            cargando={cargandoMas}
            onClick={() => {
              setCargandoMas(true);
              cargar(estado, lista.pagina + 1)
                .catch((e: unknown) => setError(mensajeDeError(e)))
                .finally(() => setCargandoMas(false));
            }}
          >
            Ver más reportes
          </Boton>
        </div>
      )}
    </>
  );
}
