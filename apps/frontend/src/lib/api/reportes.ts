import { api } from './cliente';

export type TipoReportable = 'hilo' | 'respuesta' | 'perfil';

/** Motivos de reporte (sección 17.2). */
export const MOTIVOS_REPORTE = [
  { valor: 'informacion_personal', etiqueta: 'Información personal' },
  { valor: 'acoso', etiqueta: 'Acoso' },
  { valor: 'contenido_inapropiado', etiqueta: 'Contenido inapropiado' },
  { valor: 'contacto_externo', etiqueta: 'Intento de contacto externo' },
  { valor: 'publicidad', etiqueta: 'Publicidad' },
  { valor: 'otro', etiqueta: 'Otro' },
] as const;

export const enviarReporte = (reporte: {
  tipoContenido: TipoReportable;
  idContenido: string;
  categoria: string;
  descripcion?: string;
}) => api.post<{ mensaje: string }>('/api/reportes', reporte);
