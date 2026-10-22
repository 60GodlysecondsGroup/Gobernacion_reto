'use client';

import { EyeOff, Eye, Ban, UserRoundCheck, UserRoundX } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { useSesion } from '@/components/sesion/ProveedorSesion';
import { Aviso, Boton, EnlaceVolver, Insignia, Tarjeta, useNotificar } from '@/components/ui';
import { mensajeDeError } from '@/lib/api/cliente';
import { formatearFechaHora } from '@/lib/fechas';
import {
  aplicarAccionReporte,
  cambiarEstadoReporte,
  NOMBRE_ESTADO_REPORTE,
  NOMBRE_MOTIVO,
  NOMBRE_RESOLUCION,
  NOMBRE_TIPO,
  obtenerReporte,
  TRANSICIONES,
  type AccionReporte,
  type EstadoReporte,
  type ReporteDetalle,
} from '@/lib/api/moderacion';
import { TONO_ESTADO } from './ListaReportes';
import estilos from './DetalleReporte.module.css';

const ETIQUETA_TRANSICION: Record<EstadoReporte, string> = {
  pendiente: 'Devolver a pendiente',
  en_revision: 'Pasar a revisión',
  resuelto: 'Marcar como resuelto',
  descartado: 'Descartar reporte',
};

const CONFIRMACION: Record<AccionReporte, { pregunta: string; hecho: string }> = {
  ocultar_contenido: {
    pregunta: 'El contenido dejará de mostrarse en la comunidad. Podrás restaurarlo después.',
    hecho: 'Contenido oculto. Ya no se muestra en la comunidad.',
  },
  restaurar_contenido: {
    pregunta: 'El contenido volverá a mostrarse en la comunidad.',
    hecho: 'Contenido restaurado. Vuelve a mostrarse en la comunidad.',
  },
  suspender_autor: {
    pregunta:
      'La cuenta pierde el acceso de inmediato y sale de cualquier sala en la que esté. Podrás reactivarla.',
    hecho: 'Cuenta suspendida. Perdió el acceso de inmediato.',
  },
  reactivar_autor: {
    pregunta: 'La cuenta recupera el acceso a su comunidad.',
    hecho: 'Cuenta reactivada.',
  },
  deshabilitar_sala: {
    pregunta: 'Quien esté dentro saldrá con un aviso y nadie podrá entrar hasta que la habilites.',
    hecho: 'Sala deshabilitada. Ya no aparece en la lista de la comunidad.',
  },
};

/** Detalle de un reporte (F30): motivo, fecha, contenido asociado, estado y acciones. */
export function DetalleReporte({ id }: { id: string }) {
  const { puede, usuario } = useSesion();
  const [reporte, setReporte] = useState<ReporteDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const notificar = useNotificar();
  /** Las confirmaciones se muestran como notificación breve (se anuncian a lectores de pantalla). */
  const setAviso = useCallback(
    (texto: string | null) => {
      if (texto) notificar('exito', texto);
    },
    [notificar],
  );
  const [confirmando, setConfirmando] = useState<AccionReporte | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    obtenerReporte(id)
      .then((r) => setReporte(r.reporte))
      .catch((e: unknown) => setError(mensajeDeError(e)));
  }, [id]);

  async function ejecutar(trabajo: () => Promise<{ reporte: ReporteDetalle }>, hecho: string) {
    setOcupado(true);
    setError(null);
    setAviso(null);
    try {
      setReporte((await trabajo()).reporte);
      setAviso(hecho);
      setConfirmando(null);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  const volver = <EnlaceVolver href="/panel/reportes">Volver a los reportes</EnlaceVolver>;

  if (!reporte) {
    return (
      <>
        {volver}
        {error ? (
          <Aviso tono="peligro" titulo="No pudimos abrir el reporte">
            {error}
          </Aviso>
        ) : (
          <span className="esqueleto" style={{ height: '20rem' }} />
        )}
      </>
    );
  }

  const contenido = reporte.contenido;
  const autor = contenido && 'autor' in contenido ? contenido.autor : null;
  const ocultable = contenido?.tipo === 'hilo' || contenido?.tipo === 'respuesta';
  const oculto =
    (contenido?.tipo === 'hilo' && contenido.estado === 'oculto') ||
    (contenido?.tipo === 'respuesta' && contenido.estado === 'oculta');
  const puedeMedirAutor =
    autor &&
    puede('gestionar_usuarios') &&
    autor.id !== usuario?.id &&
    (usuario?.rol === 'admin_plataforma' || autor.rol === 'usuario');

  const acciones: { accion: AccionReporte; etiqueta: string; icono: typeof Eye }[] = [];
  if (ocultable) {
    acciones.push(
      oculto
        ? { accion: 'restaurar_contenido', etiqueta: 'Restaurar contenido', icono: Eye }
        : { accion: 'ocultar_contenido', etiqueta: 'Ocultar contenido', icono: EyeOff },
    );
  }
  if (puedeMedirAutor) {
    acciones.push(
      autor.estado === 'activo'
        ? { accion: 'suspender_autor', etiqueta: 'Suspender la cuenta autora', icono: UserRoundX }
        : { accion: 'reactivar_autor', etiqueta: 'Reactivar la cuenta', icono: UserRoundCheck },
    );
  }
  if (contenido?.tipo === 'sala' && contenido.habilitada && puede('configurar_comunidades')) {
    acciones.push({ accion: 'deshabilitar_sala', etiqueta: 'Deshabilitar la sala', icono: Ban });
  }

  return (
    <>
      {volver}
      <EncabezadoPagina
        antetitulo={`Reporte de ${NOMBRE_TIPO[reporte.tipoContenido].toLowerCase()} en ${reporte.comunidad ?? 'la plataforma'}`}
        titulo={NOMBRE_MOTIVO[reporte.motivo] ?? reporte.motivo}
        acciones={
          <Insignia tono={TONO_ESTADO[reporte.estado]}>
            {NOMBRE_ESTADO_REPORTE[reporte.estado]}
          </Insignia>
        }
      />

      <dl className={estilos.datos}>
        <div>
          <dt>Recibido</dt>
          <dd>{formatearFechaHora(reporte.fecha)}</dd>
        </div>
        <div>
          <dt>Otros reportes abiertos sobre lo mismo</dt>
          <dd>{reporte.otrosAbiertos}</dd>
        </div>
        <div>
          <dt>Resultado</dt>
          <dd>{reporte.resolucion ? NOMBRE_RESOLUCION[reporte.resolucion] : 'Sin definir'}</dd>
        </div>
        <div>
          <dt>Revisado por</dt>
          <dd>
            {reporte.revisor ?? 'Nadie todavía'}
            {reporte.fechaRevision && `, ${formatearFechaHora(reporte.fechaRevision)}`}
          </dd>
        </div>
      </dl>
      {error && <Aviso tono="peligro">{error}</Aviso>}

      <div className={estilos.columnas}>
        <Tarjeta titulo="Contenido reportado">
          {!contenido && <p>El contenido ya no existe.</p>}
          {contenido?.tipo === 'hilo' && (
            <div className={estilos.contenido}>
              <p className={estilos.tituloContenido}>{contenido.titulo}</p>
              <blockquote className={estilos.cita}>{contenido.contenido}</blockquote>
            </div>
          )}
          {contenido?.tipo === 'respuesta' && (
            <div className={estilos.contenido}>
              <p className={estilos.suave}>Respuesta en el hilo «{contenido.hilo.titulo}»</p>
              <blockquote className={estilos.cita}>{contenido.contenido}</blockquote>
            </div>
          )}
          {contenido?.tipo === 'perfil' && (
            <div className={estilos.contenido}>
              <p className={estilos.tituloContenido}>Perfil de {contenido.alias}</p>
              <p className={estilos.suave}>
                Intereses: {contenido.intereses.length ? contenido.intereses.join(', ') : 'ninguno'}
              </p>
            </div>
          )}
          {contenido?.tipo === 'sala' && (
            <div className={estilos.contenido}>
              <p className={estilos.tituloContenido}>Sala «{contenido.nombre}»</p>
              <p className={estilos.suave}>
                {contenido.habilitada ? 'Habilitada' : 'Deshabilitada'}, con {contenido.ocupacion}{' '}
                de {contenido.capacidad} personas. Los mensajes de las salas no se guardan.
              </p>
            </div>
          )}
          {autor && (
            <p className={estilos.autor}>
              Escrito por <strong>{autor.alias}</strong>
              <Insignia tono={autor.estado === 'activo' ? 'exito' : 'peligro'}>
                Cuenta {autor.estado === 'activo' ? 'activa' : autor.estado}
              </Insignia>
              {oculto && <Insignia tono="neutro">Oculto en la comunidad</Insignia>}
            </p>
          )}
          {reporte.descripcion && (
            <div className={estilos.detalle}>
              <p className={estilos.suave}>Lo que contó quien reportó</p>
              <p>{reporte.descripcion}</p>
            </div>
          )}
        </Tarjeta>

        <div className={estilos.lateral}>
          {acciones.length > 0 && (
            <Tarjeta titulo="Acciones" descripcion="Quedan en el registro de acciones.">
              <div className={estilos.acciones}>
                {acciones.map(({ accion, etiqueta, icono: Icono }) =>
                  confirmando === accion ? (
                    <div key={accion} className={estilos.confirmacion} role="group">
                      <p>{CONFIRMACION[accion].pregunta}</p>
                      <div className={estilos.botones}>
                        <Boton
                          tamano="sm"
                          variante={
                            accion.startsWith('restaurar') || accion.startsWith('reactivar')
                              ? 'primario'
                              : 'peligro'
                          }
                          cargando={ocupado}
                          onClick={() =>
                            void ejecutar(
                              () => aplicarAccionReporte(reporte.id, accion),
                              CONFIRMACION[accion].hecho,
                            )
                          }
                        >
                          Confirmar
                        </Boton>
                        <Boton
                          tamano="sm"
                          variante="secundario"
                          onClick={() => setConfirmando(null)}
                        >
                          Cancelar
                        </Boton>
                      </div>
                    </div>
                  ) : (
                    <Boton
                      key={accion}
                      variante="secundario"
                      onClick={() => setConfirmando(accion)}
                      disabled={ocupado}
                    >
                      <Icono aria-hidden="true" size={18} />
                      {etiqueta}
                    </Boton>
                  ),
                )}
              </div>
            </Tarjeta>
          )}

          <Tarjeta titulo="Estado del reporte">
            <div className={estilos.acciones}>
              {TRANSICIONES[reporte.estado].map((destino) => (
                <Boton
                  key={destino}
                  variante={destino === 'resuelto' ? 'primario' : 'secundario'}
                  disabled={ocupado}
                  onClick={() =>
                    void ejecutar(
                      () => cambiarEstadoReporte(reporte.id, destino),
                      `Reporte en «${NOMBRE_ESTADO_REPORTE[destino]}».`,
                    )
                  }
                >
                  {ETIQUETA_TRANSICION[destino]}
                </Boton>
              ))}
            </div>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
