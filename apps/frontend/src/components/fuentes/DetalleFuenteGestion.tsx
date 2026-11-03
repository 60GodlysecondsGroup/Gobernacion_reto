'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
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
import { mensajeDeError } from '@/lib/api/cliente';
import { editarFuente, obtenerFuente, type DetalleFuente } from '@/lib/api/fuentes';
import { formatearFecha, haceDias } from '@/lib/fechas';
import comun from '../comun.module.css';
import { AccionesEstado } from './AccionesEstado';
import { Bitacora } from './Bitacora';
import { FormularioFuente } from './FormularioFuente';

export function DetalleFuenteGestion() {
  const { id } = useParams<{ id: string }>();
  const [detalle, setDetalle] = useState<DetalleFuente | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Cambia tras guardar o cambiar estado, para que el formulario se reinicie con los datos nuevos.
  const [version, setVersion] = useState(0);
  const [confirmacion, setConfirmacion] = useState<string | undefined>();
  // Recién registrada desde «Nueva fuente» (`?registrada=1`, como `?publicado=1` en los hilos).
  // La confirmación se retira con el primer cambio posterior.
  const recienRegistrada = useSearchParams().get('registrada') === '1';
  const [ocultarRegistro, setOcultarRegistro] = useState(false);
  const registrada = recienRegistrada && !ocultarRegistro;

  useEffect(() => {
    let vigente = true;
    obtenerFuente(id)
      .then((r) => vigente && setDetalle(r))
      .catch((e: unknown) => vigente && setError(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, [id]);

  const actualizar = (nuevo: DetalleFuente) => {
    setDetalle(nuevo);
    setVersion((v) => v + 1);
    setConfirmacion(undefined);
    setOcultarRegistro(true);
  };

  const guardarDatos = async (id: string, datos: Parameters<typeof editarFuente>[1]) => {
    const nuevo = await editarFuente(id, datos);
    actualizar(nuevo);
    setConfirmacion('Cambios guardados y registrados en la bitácora.');
  };

  if (error) {
    return (
      <ErrorDePagina
        mensaje={error}
        volverA="/gestion/fuentes"
        textoVolver="Ver todas las fuentes"
      />
    );
  }
  if (!detalle) return <CargandoLista etiqueta="Cargando fuente…" />;

  const { fuente } = detalle;
  const estado = ESTADOS_FUENTE[fuente.estado];

  return (
    <div className={comun.pagina}>
      <nav aria-label="Ruta" className={comun.suave}>
        <Link href="/gestion/fuentes">← Fuentes institucionales</Link>
      </nav>

      <EncabezadoPagina antetitulo={fuente.institucion} titulo={fuente.servicio}>
        <div className={comun.fila}>
          <Insignia tono={estado.tono}>{estado.etiqueta}</Insignia>
          {fuente.esDemo && <Insignia tono="info">Dato de demostración</Insignia>}
          <span>
            Verificado el {formatearFecha(fuente.fechaVerificacion)} (
            {haceDias(fuente.diasDesdeVerificacion)})
            {fuente.responsable && ` · Responsable: ${fuente.responsable}`}
          </span>
        </div>
      </EncabezadoPagina>

      {registrada && (
        <Aviso tono="exito" titulo="Fuente registrada">
          <p>
            Ya aparece en el listado de fuentes con estado «{estado.etiqueta}». Aquí puedes revisar
            sus datos, verificarla o editarla.
          </p>
          <div className={comun.fila}>
            <BotonEnlace href="/gestion/fuentes" variante="secundario" tamano="sm">
              Ver listado
            </BotonEnlace>
            <BotonEnlace href="/gestion/fuentes/nueva" variante="fantasma" tamano="sm">
              Registrar otra fuente
            </BotonEnlace>
          </div>
        </Aviso>
      )}

      <Tarjeta
        titulo="Estado y verificación"
        descripcion="Activo → Requiere revisión → Activo (verificada) o Inactivo (ya no disponible)."
      >
        <AccionesEstado
          idFuente={fuente.id}
          permitidas={detalle.accionesPermitidas}
          alCambiar={actualizar}
        />
      </Tarjeta>

      <Tarjeta titulo="Datos de la fuente">
        <FormularioFuente
          key={version}
          modo="editar"
          fuente={fuente}
          confirmacion={confirmacion}
          alGuardar={(datos) => guardarDatos(fuente.id, datos)}
        />
      </Tarjeta>

      <Tarjeta titulo="Bitácora" descripcion="Cada cambio con fecha, responsable y motivo.">
        <Bitacora entradas={detalle.bitacora} />
      </Tarjeta>
    </div>
  );
}
