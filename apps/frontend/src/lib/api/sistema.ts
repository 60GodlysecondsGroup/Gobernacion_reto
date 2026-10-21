import { api } from './cliente';

/** Respuesta de GET /api/salud (apps/backend/src/modules/sistema/sistema.service.ts). */
export type EstadoSalud = {
  estado: 'ok' | 'degradado';
  backend: 'ok';
  baseDeDatos: {
    estado: 'ok' | 'sin_conexion' | 'sin_esquema';
    latenciaMs: number | null;
  };
  datosDemo: {
    comunidades: number;
    usuarios: number;
    categorias: number;
    salas: number;
    fuentes: number;
  } | null;
  marcaTiempo: string;
};

export const obtenerEstadoSalud = (signal?: AbortSignal) =>
  api.get<EstadoSalud>('/api/salud', { signal });
