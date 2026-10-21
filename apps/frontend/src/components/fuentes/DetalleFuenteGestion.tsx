'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso, Insignia, Tarjeta } from '@/components/ui';
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
  };

  if (error) return <Aviso tono="peligro">{error}</Aviso>;
  if (!detalle) return <p className={comun.cargando}>Cargando fuente…</p>;

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
          alGuardar={async (datos) => actualizar(await editarFuente(fuente.id, datos))}
        />
      </Tarjeta>

      <Tarjeta titulo="Bitácora" descripcion="Cada cambio con fecha, responsable y motivo.">
        <Bitacora entradas={detalle.bitacora} />
      </Tarjeta>
    </div>
  );
}
