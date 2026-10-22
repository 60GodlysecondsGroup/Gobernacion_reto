'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import {
  Aviso,
  BotonEnlace,
  CargandoLista,
  ErrorDePagina,
  Insignia,
  Tarjeta,
} from '@/components/ui';
import { ESTADOS_FUENTE } from '@/config/fuentes';
import { ErrorApi, mensajeDeError } from '@/lib/api/cliente';
import { obtenerServicio, type FichaServicio } from '@/lib/api/orientacion';
import { formatearFecha } from '@/lib/fechas';
import comun from '../comun.module.css';
import { ContactoServicio } from './ContactoServicio';
import estilos from './Orientacion.module.css';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; servicio: FichaServicio }
  | { tipo: 'no_disponible' }
  | { tipo: 'error'; mensaje: string };

/**
 * Ficha de servicio (F05, F06, B.6). Orden de transparencia: institución · servicio o canal ·
 * información · canal · fuente · verificado · estado.
 */
export function FichaCompleta() {
  const { id } = useParams<{ id: string }>();
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  useEffect(() => {
    let vigente = true;
    obtenerServicio(id)
      .then(({ servicio }) => vigente && setEstado({ tipo: 'listo', servicio }))
      .catch((e: unknown) => {
        if (!vigente) return;
        setEstado(
          e instanceof ErrorApi && e.estado === 404
            ? { tipo: 'no_disponible' }
            : { tipo: 'error', mensaje: mensajeDeError(e) },
        );
      });
    return () => {
      vigente = false;
    };
  }, [id]);

  if (estado.tipo === 'cargando') return <CargandoLista etiqueta="Cargando el servicio…" />;
  if (estado.tipo === 'error') {
    return (
      <ErrorDePagina
        mensaje={estado.mensaje}
        volverA="/orientacion"
        textoVolver="Ver todos los temas"
      />
    );
  }
  if (estado.tipo === 'no_disponible') {
    return (
      <div className={comun.pagina}>
        <Aviso tono="advertencia" titulo="Este servicio no está disponible">
          Puede que ya no esté vigente. Consulta otras opciones en Orientación o en «Necesito
          ayuda».
        </Aviso>
        <div className={comun.fila}>
          <BotonEnlace href="/orientacion">Ir a Orientación</BotonEnlace>
        </div>
      </div>
    );
  }

  const { servicio } = estado;
  const insigniaEstado = ESTADOS_FUENTE[servicio.estado];

  return (
    <div className={comun.pagina}>
      <EncabezadoPagina antetitulo={servicio.institucion} titulo={servicio.servicio}>
        <div className={estilos.insignias}>
          <Insignia tono={insigniaEstado.tono}>{insigniaEstado.etiqueta}</Insignia>
          {servicio.esDemo && <Insignia tono="info">Dato de demostración</Insignia>}
        </div>
      </EncabezadoPagina>

      {servicio.estado === 'requiere_revision' && (
        <Aviso tono="advertencia" titulo="Información en revisión">
          Estamos volviendo a comprobar este canal y algunos datos podrían haber cambiado.
          Confírmalos en la fuente original antes de usarlo.
        </Aviso>
      )}
      {servicio.esDemo && (
        <Aviso tono="info" titulo="DATO DE DEMOSTRACIÓN">
          Este registro es ficticio: muestra cómo funciona el prototipo y no corresponde a un
          servicio real.
        </Aviso>
      )}

      <Tarjeta>
        <dl className={estilos.ficha}>
          <dt>Institución</dt>
          <dd>{servicio.institucion}</dd>
          <dt>Servicio o canal</dt>
          <dd>{servicio.servicio}</dd>
          <dt>Información</dt>
          <dd>{servicio.descripcion}</dd>
          <dt>Canal</dt>
          <dd>
            <ContactoServicio servicio={servicio} />
          </dd>
          {servicio.horario && (
            <>
              <dt>Horario</dt>
              <dd>{servicio.horario}</dd>
            </>
          )}
          <dt>Fuente</dt>
          <dd>{servicio.fuenteOriginal}</dd>
          <dt>Verificado</dt>
          <dd>{formatearFecha(servicio.fechaVerificacion)}</dd>
          <dt>Estado</dt>
          <dd>
            <Insignia tono={insigniaEstado.tono}>{insigniaEstado.etiqueta}</Insignia>
          </dd>
        </dl>
      </Tarjeta>

      <p className={comun.suave}>
        La plataforma organiza información de instituciones: no presta este servicio ni habla en su
        nombre.
      </p>
      <div className={comun.fila}>
        <BotonEnlace href="/orientacion" variante="secundario">
          Volver a Orientación
        </BotonEnlace>
      </div>
    </div>
  );
}
