import { api } from './cliente';

export type AccesoAsistenteUsuario = { texto: string; href: string };
export type RespuestaAsistenteUsuario = {
  respuesta: string;
  accesos: AccesoAsistenteUsuario[];
};

export const preguntarAsistenteUsuario = (pregunta: string) =>
  api.post<RespuestaAsistenteUsuario>('/api/usuario/asistente', { pregunta });
