'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso, BotonEnlace, CargandoLista, Insignia, Tarjeta } from '@/components/ui';
import { ESTADOS_FUENTE, TIPOS_CANAL, type EstadoFuente } from '@/config/fuentes';
import { mensajeDeError } from '@/lib/api/cliente';
import { listarFuentes, type FuenteGestion } from '@/lib/api/fuentes';
import { formatearFecha, haceDias } from '@/lib/fechas';
import comun from '../comun.module.css';
import estilos from './Fuentes.module.css';

type Datos = { resumen: Record<EstadoFuente, number>; fuentes: FuenteGestion[] };

const ORDEN: EstadoFuente[] = ['activo', 'requiere_revision', 'inactivo'];

/** Panel del gestor (F32, F34): semáforo por estado y lista de fuentes. */
export function PanelFuentes() {
  const [filtro, setFiltro] = useState<EstadoFuente | null>(null);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    listarFuentes(filtro ?? undefined)
      .then((r) => vigente && setDatos(r))
      .catch((e: unknown) => vigente && setError(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, [filtro]);

  const elegir = (estado: EstadoFuente | null) => {
    setError(null);
    setFiltro((actual) => (actual === estado ? null : estado));
  };

  return (
    <div className={comun.pagina}>
      <EncabezadoPagina antetitulo="Gestión de fuentes" titulo="Fuentes institucionales">
        Mantén la información verificada: revisa, verifica o desactiva cada fuente. Todo cambio
        queda en la bitácora con fecha y responsable.
      </EncabezadoPagina>

      <div className={comun.fila}>
        <BotonEnlace href="/gestion/fuentes/nueva">Nueva fuente</BotonEnlace>
      </div>

      {error && <Aviso tono="peligro">{error}</Aviso>}

      {datos && (
        <>
          <div className={estilos.semaforo} role="group" aria-label="Filtrar por estado">
            {ORDEN.map((estado) => (
              <button
                key={estado}
                type="button"
                className={`${estilos.luz} ${estilos[estado]}`}
                aria-pressed={filtro === estado}
                onClick={() => elegir(estado)}
              >
                <span className={estilos.total}>{datos.resumen[estado]}</span>
                <Insignia tono={ESTADOS_FUENTE[estado].tono}>
                  {ESTADOS_FUENTE[estado].etiqueta}
                </Insignia>
              </button>
            ))}
          </div>

          <Tarjeta
            titulo={
              filtro
                ? `Fuentes: ${ESTADOS_FUENTE[filtro].etiqueta.toLowerCase()}`
                : 'Todas las fuentes'
            }
            descripcion={filtro ? 'Pulsa de nuevo el filtro para ver todas.' : undefined}
          >
            {datos.fuentes.length === 0 ? (
              <p className={comun.suave}>No hay fuentes en este estado.</p>
            ) : (
              <div className={estilos.tablaContenedor}>
                <table className={estilos.tabla}>
                  <thead>
                    <tr>
                      <th scope="col">Estado</th>
                      <th scope="col">Servicio</th>
                      <th scope="col">Canal</th>
                      <th scope="col">Verificado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.fuentes.map((fuente) => (
                      <tr key={fuente.id}>
                        <td>
                          <Insignia tono={ESTADOS_FUENTE[fuente.estado].tono}>
                            {ESTADOS_FUENTE[fuente.estado].etiqueta}
                          </Insignia>
                        </td>
                        <td>
                          <Link href={`/gestion/fuentes/${fuente.id}`} className={estilos.servicio}>
                            {fuente.servicio}
                          </Link>
                          <span className={comun.suave}>
                            {fuente.institucion}
                            {fuente.esDemo && ' · demostración'}
                          </span>
                        </td>
                        <td>{TIPOS_CANAL[fuente.tipoCanal]}</td>
                        <td>
                          <span>{formatearFecha(fuente.fechaVerificacion)}</span>
                          <span className={comun.suave}>
                            {haceDias(fuente.diasDesdeVerificacion)}
                          </span>
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
      {!datos && !error && <CargandoLista etiqueta="Cargando fuentes…" />}
    </div>
  );
}
