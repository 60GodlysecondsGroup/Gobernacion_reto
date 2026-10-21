import { ErrorApp, errores } from '../../http/errores.js';
import type { CodigoRango } from '../seguridad/rango-edad.js';
import type { Sesion } from '../seguridad/sesion.service.js';
import type { Comunidad, RepositorioComunidades } from './comunidad.repository.js';

/**
 * Rango de la sesión o 403. La comunidad SIEMPRE sale de aquí, nunca de lo que envía el
 * cliente (RF02). El personal sin comunidad asignada no tiene acceso a contenido comunitario.
 */
export function exigirRango(sesion: Sesion): CodigoRango {
  if (!sesion.rango) {
    throw new ErrorApp(403, 'SIN_COMUNIDAD', 'Tu usuario no pertenece a ninguna comunidad.');
  }
  return sesion.rango;
}

export function crearServicioComunidad(repositorio: RepositorioComunidades) {
  async function obtenerPropia(sesion: Sesion): Promise<Comunidad> {
    const comunidad = await repositorio.porRango(exigirRango(sesion));
    if (!comunidad) throw errores.noEncontrado();
    return comunidad;
  }

  return {
    obtenerPropia,

    /** Las demás comunidades no existen para el usuario: ni se listan ni se pueden buscar. */
    listar: async (sesion: Sesion) => [await obtenerPropia(sesion)],

    /**
     * Acceso directo por id o por código de rango (A–D). Si no es la propia, la respuesta es
     * idéntica a la de un recurso inexistente: no revela si la otra comunidad existe.
     */
    async obtenerPorReferencia(sesion: Sesion, referencia: string): Promise<Comunidad> {
      const propia = await obtenerPropia(sesion);
      const coincide =
        referencia.toLowerCase() === propia.id || referencia.toUpperCase() === sesion.rango;
      if (!coincide) throw errores.noEncontrado();
      return propia;
    },
  };
}

export type ServicioComunidad = ReturnType<typeof crearServicioComunidad>;
