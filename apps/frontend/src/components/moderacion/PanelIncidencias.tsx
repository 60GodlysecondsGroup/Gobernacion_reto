'use client';

import { useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso, Boton, Insignia, Tarjeta } from '@/components/ui';
import { mensajeDeError } from '@/lib/api/cliente';
import { obtenerIncidenciasDlp, type IncidenciasDlp } from '@/lib/api/moderacion';
import comun from '../comun.module.css';
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

const formatoFecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' });

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

  return (
    <div className={comun.pagina}>
      <EncabezadoPagina antetitulo="Moderación" titulo="Incidencias del DLP">
        Bloqueos del sistema de protección de contenido. No se muestra el texto bloqueado (nunca se
        guarda) ni quién lo escribió.
      </EncabezadoPagina>

      <div className={comun.fila} role="group" aria-label="Periodo">
        {PERIODOS.map((periodo) => (
          <Boton
            key={periodo.dias}
            tamano="sm"
            variante={periodo.dias === dias ? 'primario' : 'secundario'}
            aria-pressed={periodo.dias === dias}
            onClick={() => elegirPeriodo(periodo.dias)}
          >
            {periodo.etiqueta}
          </Boton>
        ))}
      </div>

      {error && <Aviso tono="peligro">{error}</Aviso>}
      {!datos && !error && <p className={comun.cargando}>Cargando incidencias…</p>}

      {datos && (
        <>
          <ul className={estilos.resumen} aria-label="Bloqueos por categoría">
            {datos.resumen.map((categoria) => (
              <li key={categoria.categoria} className={estilos.categoria}>
                <span className={estilos.total}>{categoria.total}</span>
                <span className={comun.suave}>{categoria.nombre}</span>
              </li>
            ))}
          </ul>

          <Tarjeta titulo="Más recientes" descripcion="Hasta 50 eventos del periodo elegido.">
            {datos.recientes.length === 0 ? (
              <p className={comun.suave}>No hay incidencias en este periodo.</p>
            ) : (
              <div className={estilos.tablaContenedor}>
                <table className={estilos.tabla}>
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
                        <td>{formatoFecha.format(new Date(evento.fecha))}</td>
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
    </div>
  );
}
