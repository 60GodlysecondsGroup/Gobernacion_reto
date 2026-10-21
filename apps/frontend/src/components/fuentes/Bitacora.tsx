import { Insignia } from '@/components/ui';
import { ESTADOS_FUENTE, TIPOS_CANAL, type EstadoFuente, type TipoCanal } from '@/config/fuentes';
import type { AccionBitacora, EntradaBitacora } from '@/lib/api/fuentes';
import { formatearFecha, formatearFechaHora } from '@/lib/fechas';
import comun from '../comun.module.css';
import estilos from './Fuentes.module.css';

const ACCIONES: Record<AccionBitacora, string> = {
  crear: 'Creada',
  actualizar: 'Datos actualizados',
  marcar_revision: 'Marcada para revisión',
  verificar: 'Verificada',
  desactivar: 'Desactivada',
};

const CAMPOS: Record<string, string> = {
  institucion: 'Institución',
  servicio: 'Servicio',
  descripcion: 'Descripción',
  tipoCanal: 'Tipo de canal',
  telefono: 'Teléfono',
  enlace: 'Enlace',
  horario: 'Horario',
  fuenteOriginal: 'Fuente original',
  necesidades: 'Temas',
  observaciones: 'Observaciones',
  esDemo: 'Dato de demostración',
  estado: 'Estado',
  fechaVerificacion: 'Fecha de verificación',
};

function valor(campo: string, dato: unknown): string {
  if (dato === null || dato === undefined || dato === '') return '—';
  if (campo === 'estado') return ESTADOS_FUENTE[dato as EstadoFuente]?.etiqueta ?? String(dato);
  if (campo === 'tipoCanal') return TIPOS_CANAL[dato as TipoCanal] ?? String(dato);
  if (campo === 'fechaVerificacion') return formatearFecha(String(dato));
  if (typeof dato === 'boolean') return dato ? 'Sí' : 'No';
  if (Array.isArray(dato)) return dato.join(', ');
  return String(dato);
}

function EstadoBadge({ estado }: { estado: EstadoFuente }) {
  return <Insignia tono={ESTADOS_FUENTE[estado].tono}>{ESTADOS_FUENTE[estado].etiqueta}</Insignia>;
}

/** Bitácora de la fuente (F33): qué cambió, cuándo, quién y por qué. Solo lectura. */
export function Bitacora({ entradas }: { entradas: EntradaBitacora[] }) {
  return (
    <ol className={estilos.bitacora}>
      {entradas.map((entrada) => (
        <li key={entrada.id} className={estilos.entrada}>
          <div className={estilos.cabeceraEntrada}>
            <strong>{ACCIONES[entrada.accion]}</strong>
            {entrada.estadoAnterior && entrada.estadoAnterior !== entrada.estadoNuevo && (
              <>
                <EstadoBadge estado={entrada.estadoAnterior} />
                <span aria-label="pasó a">→</span>
              </>
            )}
            {entrada.estadoNuevo &&
              (entrada.accion === 'crear' || entrada.estadoAnterior !== entrada.estadoNuevo) && (
                <EstadoBadge estado={entrada.estadoNuevo} />
              )}
          </div>
          <span className={comun.suave}>
            {formatearFechaHora(entrada.fecha)} · {entrada.responsable ?? 'Archivo de carga'}
          </span>
          {entrada.observacion && <p>{entrada.observacion}</p>}
          {Object.keys(entrada.cambios).length > 0 && (
            <ul className={estilos.cambios}>
              {Object.entries(entrada.cambios).map(([campo, { antes, despues }]) => (
                <li key={campo}>
                  {CAMPOS[campo] ?? campo}: {valor(campo, antes)} → {valor(campo, despues)}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
