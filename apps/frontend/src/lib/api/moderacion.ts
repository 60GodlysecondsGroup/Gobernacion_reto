import { api } from './cliente';

export type IncidenciasDlp = {
  dias: number;
  resumen: { categoria: string; nombre: string; total: number }[];
  recientes: {
    fecha: string;
    categoria: string;
    nombreCategoria: string;
    tipoContenido: string;
    regla: string | null;
    accion: string;
    resultado: string;
  }[];
  porDia: { dia: string; total: number }[];
  porTipo: { tipoContenido: string; total: number }[];
};

export const obtenerIncidenciasDlp = (dias: number) =>
  api.get<IncidenciasDlp>(`/api/moderacion/incidencias-dlp?dias=${dias}`);

// ── Reportes (F30) ──────────────────────────────────────────────────────────

export type EstadoReporte = 'pendiente' | 'en_revision' | 'resuelto' | 'descartado';
export type Resolucion =
  'sin_accion' | 'contenido_oculto' | 'usuario_suspendido' | 'sala_deshabilitada';
export type TipoReportado = 'hilo' | 'respuesta' | 'perfil' | 'sala';
export type AccionReporte =
  | 'ocultar_contenido'
  | 'restaurar_contenido'
  | 'suspender_autor'
  | 'reactivar_autor'
  | 'deshabilitar_sala';

export const ESTADOS_REPORTE: { valor: EstadoReporte; etiqueta: string }[] = [
  { valor: 'pendiente', etiqueta: 'Pendiente' },
  { valor: 'en_revision', etiqueta: 'En revisión' },
  { valor: 'resuelto', etiqueta: 'Resuelto' },
  { valor: 'descartado', etiqueta: 'Descartado' },
];

export const NOMBRE_ESTADO_REPORTE: Record<EstadoReporte, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  resuelto: 'Resuelto',
  descartado: 'Descartado',
};

export const NOMBRE_RESOLUCION: Record<Resolucion, string> = {
  sin_accion: 'Sin medida',
  contenido_oculto: 'Contenido oculto',
  usuario_suspendido: 'Cuenta suspendida',
  sala_deshabilitada: 'Sala deshabilitada',
};

export const NOMBRE_TIPO: Record<TipoReportado, string> = {
  hilo: 'Hilo',
  respuesta: 'Respuesta',
  perfil: 'Perfil',
  sala: 'Sala',
};

export const NOMBRE_MOTIVO: Record<string, string> = {
  informacion_personal: 'Información personal',
  acoso: 'Acoso',
  contenido_inapropiado: 'Contenido inapropiado',
  contacto_externo: 'Intento de contacto externo',
  publicidad: 'Publicidad',
  otro: 'Otro',
};

/** Transiciones permitidas (igual que el backend, que es quien decide). */
export const TRANSICIONES: Record<EstadoReporte, EstadoReporte[]> = {
  pendiente: ['en_revision', 'resuelto', 'descartado'],
  en_revision: ['pendiente', 'resuelto', 'descartado'],
  resuelto: ['en_revision'],
  descartado: ['en_revision'],
};

export type ReporteResumen = {
  id: string;
  tipoContenido: TipoReportado;
  motivo: string;
  estado: EstadoReporte;
  resolucion: Resolucion | null;
  fecha: string;
  fechaRevision: string | null;
  comunidad: string | null;
  tieneDetalle: boolean;
};

export type AutorModeracion = { id: string; alias: string; rol: string; estado: string };

export type ContenidoReportado =
  | {
      tipo: 'hilo';
      id: string;
      titulo: string;
      contenido: string;
      estado: string;
      fecha: string;
      autor: AutorModeracion;
    }
  | {
      tipo: 'respuesta';
      id: string;
      contenido: string;
      estado: string;
      fecha: string;
      hilo: { id: string; titulo: string; estado: string };
      autor: AutorModeracion;
    }
  | { tipo: 'perfil'; id: string; alias: string; intereses: string[]; autor: AutorModeracion }
  | {
      tipo: 'sala';
      id: string;
      nombre: string;
      estado: string;
      habilitada: boolean;
      ocupacion: number;
      capacidad: number;
    };

export type ReporteDetalle = ReporteResumen & {
  descripcion: string | null;
  otrosAbiertos: number;
  revisor: string | null;
  contenido: ContenidoReportado | null;
};

export type ListaReportes = {
  reportes: ReporteResumen[];
  conteo: Record<EstadoReporte, number>;
  pagina: number;
  hayMas: boolean;
};

export const listarReportes = (estado: EstadoReporte | null, pagina = 1) =>
  api.get<ListaReportes>(
    `/api/moderacion/reportes?pagina=${pagina}${estado ? `&estado=${estado}` : ''}`,
  );

export const obtenerReporte = (id: string) =>
  api.get<{ reporte: ReporteDetalle }>(`/api/moderacion/reportes/${encodeURIComponent(id)}`);

export const cambiarEstadoReporte = (id: string, estado: EstadoReporte) =>
  api.patch<{ reporte: ReporteDetalle }>(`/api/moderacion/reportes/${encodeURIComponent(id)}`, {
    estado,
  });

export const aplicarAccionReporte = (id: string, accion: AccionReporte) =>
  api.post<{ reporte: ReporteDetalle }>(
    `/api/moderacion/reportes/${encodeURIComponent(id)}/acciones`,
    { accion },
  );
