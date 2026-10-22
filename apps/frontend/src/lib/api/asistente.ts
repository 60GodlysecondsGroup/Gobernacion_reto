import { api } from './cliente';

export type MetricaAsistente = { herramienta: string; datos: unknown };
export type RespuestaAsistente = {
  respuesta: string;
  metricas: MetricaAsistente[];
  actualizado: string;
};

export const preguntarAsistente = (pregunta: string) =>
  api.post<RespuestaAsistente>('/api/admin/asistente', { pregunta });
