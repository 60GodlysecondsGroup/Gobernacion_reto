'use client';

import { useId, useState, type FormEvent } from 'react';
import { Aviso, Boton, CampoTexto } from '@/components/ui';
import { ErrorApi, mensajeDeError } from '@/lib/api/cliente';
import { enviarReporte, MOTIVOS_REPORTE, type TipoReportable } from '@/lib/api/reportes';
import estilos from './Comunidad.module.css';

/**
 * «Reportar» (F19, F20). La confirmación es siempre la misma y no dice qué pasará con la otra
 * persona. El detalle opcional también pasa por el DLP en el backend.
 */
export function BotonReportar({
  tipoContenido,
  idContenido,
}: {
  tipoContenido: TipoReportable;
  idContenido: string;
}) {
  const nombreGrupo = useId();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmacion, setConfirmacion] = useState<string | null>(null);

  if (confirmacion) {
    return (
      <div className={estilos.reporte}>
        <Aviso tono="exito">{confirmacion}</Aviso>
      </div>
    );
  }

  if (!abierto) {
    return (
      <Boton variante="fantasma" tamano="sm" onClick={() => setAbierto(true)}>
        Reportar
      </Boton>
    );
  }

  async function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!motivo) {
      setError('Elige un motivo.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const { mensaje } = await enviarReporte({
        tipoContenido,
        idContenido,
        categoria: motivo,
        descripcion: detalle,
      });
      setConfirmacion(mensaje);
    } catch (e) {
      setError(
        e instanceof ErrorApi && e.estado === 404
          ? 'Este contenido ya no está disponible.'
          : mensajeDeError(e),
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className={estilos.reporte} onSubmit={alEnviar} noValidate>
      <fieldset className={estilos.motivos}>
        <legend className={estilos.leyenda}>¿Por qué lo reportas?</legend>
        {MOTIVOS_REPORTE.map((opcion) => (
          <label key={opcion.valor} className={estilos.opcion}>
            <input
              type="radio"
              name={nombreGrupo}
              value={opcion.valor}
              checked={motivo === opcion.valor}
              onChange={() => {
                setMotivo(opcion.valor);
                setError(null);
              }}
            />
            {opcion.etiqueta}
          </label>
        ))}
      </fieldset>
      <CampoTexto
        etiqueta="Detalle (opcional)"
        ayuda="No incluyas datos personales. El equipo de moderación revisará el reporte."
        multilinea
        rows={2}
        maxLength={300}
        value={detalle}
        onChange={(e) => setDetalle(e.target.value)}
      />
      {error && <Aviso tono="peligro">{error}</Aviso>}
      <div className={estilos.acciones}>
        <Boton type="submit" tamano="sm" cargando={enviando}>
          Enviar reporte
        </Boton>
        <Boton variante="fantasma" tamano="sm" onClick={() => setAbierto(false)}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
}
