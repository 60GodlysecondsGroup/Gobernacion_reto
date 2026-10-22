'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Contador } from '@/components/efectos/Contador';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { useSesion } from '@/components/sesion/ProveedorSesion';
import { Aviso, Insignia, Tarjeta } from '@/components/ui';
import { obtenerResumen, type ResumenAdministracion } from '@/lib/api/administracion';
import { mensajeDeError } from '@/lib/api/cliente';
import { haceTiempo } from '@/lib/fechas';
import {
  listarReportes,
  NOMBRE_MOTIVO,
  NOMBRE_TIPO,
  obtenerIncidenciasDlp,
  type IncidenciasDlp,
  type ReporteResumen,
} from '@/lib/api/moderacion';
import { GraficoPorDia } from './GraficoPorDia';
import estilos from './Panel.module.css';

type Datos = {
  resumen: ResumenAdministracion;
  pendientes: ReporteResumen[];
  incidencias: IncidenciasDlp | null;
};

/** Resumen del panel: todo lo que muestra sale de la base, nada es ilustrativo. */
export function ResumenPanel() {
  const { puede } = useSesion();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    Promise.all([
      obtenerResumen(),
      listarReportes('pendiente'),
      puede('revisar_incidencias_dlp') ? obtenerIncidenciasDlp(14) : Promise.resolve(null),
    ])
      .then(
        ([resumen, reportes, incidencias]) =>
          vigente && setDatos({ resumen, pendientes: reportes.reportes.slice(0, 5), incidencias }),
      )
      .catch((e: unknown) => vigente && setError(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, [puede]);

  const r = datos?.resumen;
  const indicadores = r
    ? [
        {
          etiqueta: 'Reportes pendientes',
          valor: r.reportes.pendiente ?? 0,
          detalle: `${r.reportes.en_revision ?? 0} en revisión`,
          href: '/panel/reportes',
          destacado: (r.reportes.pendiente ?? 0) > 0,
        },
        {
          etiqueta: 'Bloqueos del DLP',
          valor: r.dlp7d,
          detalle: 'en los últimos 7 días',
          href: '/panel/incidencias',
        },
        {
          etiqueta: 'Personas en salas',
          valor: r.salas.personas,
          detalle: `${r.salas.abiertas} salas abiertas, ${r.salas.deshabilitadas} deshabilitadas`,
          href: puede('configurar_comunidades') ? '/panel/salas' : undefined,
        },
        {
          etiqueta: 'Cuentas suspendidas',
          valor: (r.usuarios.suspendido ?? 0) + (r.usuarios.bloqueado ?? 0),
          detalle: `${r.usuarios.activo ?? 0} cuentas de jóvenes activas`,
          href: '/panel/usuarios',
        },
        {
          etiqueta: 'Contenido oculto',
          valor: r.contenidoOculto,
          detalle: 'hilos y respuestas retirados por moderación',
        },
        {
          etiqueta: 'Reglas DLP activas',
          valor: r.reglas.activas,
          detalle: `de ${r.reglas.total} reglas`,
          href: '/panel/reglas',
        },
      ]
    : [];

  return (
    <>
      <EncabezadoPagina antetitulo="Panel administrativo" titulo="Resumen">
        La segunda capa de protección: revisar lo que el filtro automático no detecta y mantener la
        plataforma en orden.
      </EncabezadoPagina>

      {error && <Aviso tono="peligro">{error}</Aviso>}

      <div className={estilos.indicadores} aria-busy={!datos}>
        {!datos &&
          !error &&
          Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="esqueleto" style={{ height: '7.5rem' }} />
          ))}
        {indicadores.map(({ etiqueta, valor, detalle, href, destacado }) => {
          const contenido = (
            <>
              <span className={estilos.etiquetaIndicador}>{etiqueta}</span>
              <Contador className={estilos.valor} valor={valor} />
              <span className={estilos.detalleIndicador}>{detalle}</span>
            </>
          );
          const clase = `${estilos.indicador} ${destacado ? estilos.indicadorDestacado : ''}`;
          return href ? (
            <Link key={etiqueta} href={href} className={clase}>
              {contenido}
            </Link>
          ) : (
            <div key={etiqueta} className={clase}>
              {contenido}
            </div>
          );
        })}
      </div>

      {datos && (
        <div className={estilos.dosColumnas}>
          <Tarjeta
            titulo="Reportes por atender"
            descripcion="Los más recientes primero."
            pie={<Link href="/panel/reportes">Ver todos los reportes</Link>}
          >
            {datos.pendientes.length === 0 ? (
              <p className={estilos.detalleIndicador}>No hay reportes pendientes.</p>
            ) : (
              <ul className={estilos.listaSimple}>
                {datos.pendientes.map((reporte) => (
                  <li key={reporte.id} className={estilos.itemLista}>
                    <span>
                      <Link href={`/panel/reportes/${reporte.id}`} className={estilos.enlaceFila}>
                        {NOMBRE_MOTIVO[reporte.motivo] ?? reporte.motivo}
                      </Link>
                      <br />
                      <span className={estilos.detalleIndicador}>
                        {NOMBRE_TIPO[reporte.tipoContenido]} en {reporte.comunidad},{' '}
                        {haceTiempo(reporte.fecha)}
                      </span>
                    </span>
                    <Insignia tono="advertencia">Pendiente</Insignia>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>

          {datos.incidencias && (
            <Tarjeta
              titulo="Bloqueos del DLP por día"
              descripcion="Últimos 14 días. Sin texto ni autor: solo la categoría y la fecha."
              pie={<Link href="/panel/incidencias">Ver incidencias</Link>}
            >
              <GraficoPorDia datos={datos.incidencias.porDia} />
            </Tarjeta>
          )}
        </div>
      )}
    </>
  );
}
