'use client';

import { useCallback, useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso, Boton } from '@/components/ui';
import { listarAuditoria, type RegistroAuditoria } from '@/lib/api/administracion';
import { mensajeDeError } from '@/lib/api/cliente';
import { formatearFechaHora } from '@/lib/fechas';
import { NOMBRES_ROL } from '@/lib/api/sesion';
import estilos from './Panel.module.css';

const ACCIONES: Record<string, string> = {
  cambiar_estado_reporte: 'Cambió el estado de un reporte',
  ocultar_contenido: 'Ocultó contenido',
  restaurar_contenido: 'Restauró contenido',
  cambiar_estado_usuario: 'Cambió el estado de una cuenta',
  actualizar_sala: 'Actualizó una sala',
  actualizar_escenario: 'Cambió el escenario de una sala',
  crear_sala: 'Habilitó una sala temática',
  crear_categoria: 'Creó una categoría',
  actualizar_categoria: 'Actualizó una categoría',
  actualizar_comunidad: 'Actualizó una comunidad',
  activar_regla_dlp: 'Activó una regla DLP',
  desactivar_regla_dlp: 'Desactivó una regla DLP',
};

const ESTADOS: Record<string, string> = {
  pendiente: 'pendiente',
  en_revision: 'en revisión',
  resuelto: 'resuelto',
  descartado: 'descartado',
  activo: 'activa',
  suspendido: 'suspendida',
  bloqueado: 'bloqueada',
  activa: 'activa',
  inactiva: 'inactiva',
  oculto: 'oculto',
  oculta: 'oculta',
  publicada: 'publicada',
};

/** Resume el detalle registrado (solo estados y valores de configuración, nunca contenido). */
function resumirDetalle(registro: RegistroAuditoria): string {
  const d = registro.detalle as Record<string, unknown>;
  const partes: string[] = [];
  if (d.estadoAnterior && d.estadoNuevo) {
    partes.push(`de ${ESTADOS[String(d.estadoAnterior)]} a ${ESTADOS[String(d.estadoNuevo)]}`);
  } else if (d.estadoNuevo) {
    partes.push(`quedó ${ESTADOS[String(d.estadoNuevo)] ?? d.estadoNuevo}`);
  }
  if (typeof d.habilitada === 'boolean') partes.push(d.habilitada ? 'habilitada' : 'deshabilitada');
  if (typeof d.capacidad === 'number') partes.push(`capacidad ${d.capacidad}`);
  if (typeof d.obstaculos === 'number') partes.push(`${d.obstaculos} muebles`);
  if (d.categoria) partes.push(`categoría ${String(d.categoria)}`);
  if (registro.entidad === 'regla_dlp' && registro.idEntidad) partes.push(registro.idEntidad);
  return partes.join(', ');
}

/** Registro simple de acciones administrativas: quién, qué y cuándo (Fase 7, punto 7). */
export function RegistroAcciones() {
  const [registros, setRegistros] = useState<RegistroAuditoria[] | null>(null);
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (n: number) => {
    const r = await listarAuditoria(n);
    setRegistros((anteriores) =>
      n === 1 || !anteriores ? r.registros : [...anteriores, ...r.registros],
    );
    setPagina(n);
    setHayMas(r.hayMas);
  }, []);

  useEffect(() => {
    listarAuditoria(1)
      .then((r) => {
        setRegistros(r.registros);
        setHayMas(r.hayMas);
      })
      .catch((e: unknown) => setError(mensajeDeError(e)));
  }, []);

  return (
    <>
      <EncabezadoPagina antetitulo="Panel administrativo" titulo="Registro de acciones">
        Cada medida queda aquí y no se puede editar ni borrar. Es un mecanismo mínimo: la auditoría
        definitiva sigue pendiente de definición.
      </EncabezadoPagina>

      {error && <Aviso tono="peligro">{error}</Aviso>}
      {!registros && !error && <span className="esqueleto" style={{ height: '14rem' }} />}
      {registros?.length === 0 && (
        <div className={estilos.vacio}>
          <strong>Todavía no hay acciones registradas.</strong>
          Cuando alguien cambie el estado de un reporte, oculte contenido o configure una sala,
          aparecerá aquí.
        </div>
      )}
      {registros && registros.length > 0 && (
        <div className={estilos.tablaContenedor}>
          <table className={estilos.tabla}>
            <thead>
              <tr>
                <th scope="col">Cuándo</th>
                <th scope="col">Quién</th>
                <th scope="col">Qué</th>
                <th scope="col">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatearFechaHora(r.fecha)}</td>
                  <td>
                    <strong>{r.actor.alias ?? 'Sistema'}</strong>
                    {r.actor.rol && (
                      <span className={estilos.detalleIndicador}>
                        {' '}
                        ({NOMBRES_ROL[r.actor.rol]})
                      </span>
                    )}
                  </td>
                  <td>{ACCIONES[r.accion] ?? r.accion}</td>
                  <td className={estilos.detalleIndicador}>{resumirDetalle(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hayMas && (
        <div>
          <Boton variante="secundario" onClick={() => void cargar(pagina + 1)}>
            Ver acciones anteriores
          </Boton>
        </div>
      )}
    </>
  );
}
