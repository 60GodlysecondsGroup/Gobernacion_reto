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
};

export const obtenerIncidenciasDlp = (dias: number) =>
  api.get<IncidenciasDlp>(`/api/moderacion/incidencias-dlp?dias=${dias}`);
