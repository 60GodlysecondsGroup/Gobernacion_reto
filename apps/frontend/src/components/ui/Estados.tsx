import { CloudOff, type LucideIcon, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import estilos from './Estados.module.css';

/** Estado vacío: explica qué falta y ofrece el siguiente paso, nunca solo «no hay datos». */
export function EstadoVacio({
  icono: Icono = Sparkles,
  titulo,
  children,
  accion,
}: {
  icono?: LucideIcon;
  titulo: string;
  children?: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <div className={estilos.estado}>
      <span className={estilos.icono} aria-hidden="true">
        <Icono size={24} />
      </span>
      <p className={estilos.titulo}>{titulo}</p>
      {children && <div className={estilos.texto}>{children}</div>}
      {accion && <div className={estilos.accion}>{accion}</div>}
    </div>
  );
}

/** Error al cargar datos: dice qué pasó sin tecnicismos y permite reintentar. */
export function EstadoError({
  titulo = 'No pudimos cargar esta información',
  children,
  alReintentar,
  accion,
}: {
  titulo?: string;
  children?: ReactNode;
  alReintentar?: () => void;
  /** Camino alternativo (p. ej. volver a la lista) además de reintentar. */
  accion?: ReactNode;
}) {
  return (
    <div className={`${estilos.estado} ${estilos.error}`} role="alert">
      <span className={estilos.icono} aria-hidden="true">
        <CloudOff size={24} />
      </span>
      <p className={estilos.titulo}>{titulo}</p>
      {children && <div className={estilos.texto}>{children}</div>}
      {(alReintentar || accion) && (
        <div className={estilos.accion}>
          {alReintentar && (
            <button type="button" className={estilos.reintentar} onClick={alReintentar}>
              Intentar de nuevo
            </button>
          )}
          {accion}
        </div>
      )}
    </div>
  );
}

/** Lista de bloques de carga con la forma aproximada del contenido que llega. */
export function CargandoLista({
  filas = 3,
  etiqueta = 'Cargando…',
  alto = '4.5rem',
}: {
  filas?: number;
  etiqueta?: string;
  alto?: string;
}) {
  return (
    <div className={estilos.cargando} role="status" aria-live="polite">
      <span className="visualmente-oculto">{etiqueta}</span>
      {Array.from({ length: filas }, (_, i) => (
        <span key={i} className="esqueleto" style={{ height: alto, opacity: 1 - i * 0.18 }} />
      ))}
    </div>
  );
}
