'use client';

import { useState, type FormEvent } from 'react';
import { Aviso, Boton, CampoTexto } from '@/components/ui';
import { erroresPorCampo, mensajeDeError } from '@/lib/api/cliente';
import { cambiarEstadoFuente, type AccionEstado, type DetalleFuente } from '@/lib/api/fuentes';
import { hoyEnColombia } from '@/lib/fechas';
import comun from '../comun.module.css';
import estilos from './Fuentes.module.css';

const ACCIONES: Record<AccionEstado, { boton: string; ayuda: string }> = {
  marcar_revision: {
    boton: 'Marcar para revisión',
    ayuda:
      'El canal no respondió, cambió o hay dudas. Se seguirá mostrando, con un aviso de revisión.',
  },
  verificar: {
    boton: 'Registrar verificación',
    ayuda:
      'Comprobaste el canal en la fuente oficial y sigue vigente. Pasa a Activo con la fecha indicada.',
  },
  desactivar: {
    boton: 'Desactivar',
    ayuda: 'Ya no está disponible. Deja de mostrarse como opción; su historial se conserva.',
  },
};

/** Marcar para revisión, verificar con fecha o desactivar (flujos 13 y 14 del Anexo A). */
export function AccionesEstado({
  idFuente,
  permitidas,
  alCambiar,
}: {
  idFuente: string;
  permitidas: AccionEstado[];
  alCambiar: (detalle: DetalleFuente) => void;
}) {
  const [accion, setAccion] = useState<AccionEstado | null>(null);
  const [motivo, setMotivo] = useState('');
  const [fecha, setFecha] = useState(hoyEnColombia());
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [mensaje, setMensaje] = useState<{ tono: 'exito' | 'peligro'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  function elegir(nueva: AccionEstado) {
    setAccion(nueva);
    setMotivo('');
    setFecha(hoyEnColombia());
    setErrores({});
    setMensaje(null);
  }

  async function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!accion) return;
    setEnviando(true);
    setErrores({});
    try {
      const cuerpo = accion === 'verificar' ? { fecha, observacion: motivo } : { motivo };
      const detalle = await cambiarEstadoFuente(idFuente, accion, cuerpo);
      setMensaje({ tono: 'exito', texto: 'Listo: el cambio quedó registrado en la bitácora.' });
      setAccion(null);
      alCambiar(detalle);
    } catch (e) {
      const porCampo = erroresPorCampo(e);
      setErrores({ ...porCampo, texto: porCampo.motivo ?? porCampo.observacion ?? '' });
      setMensaje({ tono: 'peligro', texto: mensajeDeError(e) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={comun.formulario}>
      {mensaje && <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>}

      <div className={estilos.acciones} role="group" aria-label="Acciones de estado">
        {permitidas.map((opcion) => (
          <Boton
            key={opcion}
            tamano="sm"
            variante={accion === opcion ? 'primario' : 'secundario'}
            aria-pressed={accion === opcion}
            onClick={() => elegir(opcion)}
          >
            {ACCIONES[opcion].boton}
          </Boton>
        ))}
      </div>

      {accion && (
        <form className={comun.formulario} onSubmit={alEnviar} noValidate>
          <p className={comun.suave}>{ACCIONES[accion].ayuda}</p>
          {accion === 'verificar' && (
            <CampoTexto
              etiqueta="Fecha de verificación"
              type="date"
              max={hoyEnColombia()}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              error={errores.fecha || undefined}
            />
          )}
          <CampoTexto
            etiqueta={accion === 'verificar' ? 'Observación (opcional)' : 'Motivo'}
            ayuda="Queda en la bitácora junto con la fecha y tu alias."
            multilinea
            rows={2}
            maxLength={500}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            error={errores.texto || undefined}
          />
          <div className={comun.fila}>
            <Boton type="submit" cargando={enviando}>
              Confirmar: {ACCIONES[accion].boton.toLowerCase()}
            </Boton>
            <Boton variante="fantasma" onClick={() => setAccion(null)}>
              Cancelar
            </Boton>
          </div>
        </form>
      )}
    </div>
  );
}
