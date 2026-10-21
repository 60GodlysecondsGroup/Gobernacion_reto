import { z } from 'zod';
import { ErrorApp, errores } from '../../http/errores.js';
import { validar } from '../../http/validacion.js';
import { exigirRango } from '../comunidad/comunidad.service.js';
import type { ServicioDlp } from '../dlp/dlp.service.js';
import { tienePermiso } from '../seguridad/permisos.js';
import type { Sesion } from '../seguridad/sesion.service.js';
import type { RepositorioPerfil } from './perfil.repository.js';

/**
 * Perfil protegido (F16): solo alias, intereses generales y un personaje del catálogo.
 * `.strict()` rechaza cualquier otro campo (edad, rango, contacto…): no hay forma de enviarlos.
 */
const esquemaPerfil = z
  .object({
    alias: z
      .string()
      .trim()
      .min(3, 'El alias debe tener al menos 3 caracteres.')
      .max(30, 'El alias puede tener máximo 30 caracteres.')
      .regex(
        /^[\p{L}\p{N}_.-]+$/u,
        'Usa solo letras, números, punto, guion o guion bajo, sin espacios.',
      ),
    intereses: z
      .array(z.string().trim().min(2, 'Cada interés debe tener al menos 2 caracteres.').max(30))
      .max(10, 'Puedes tener hasta 10 intereses.')
      .default([]),
    avatar: z.string().regex(/^[a-z0-9-]{2,40}$/, 'Elige un personaje del catálogo.'),
  })
  .strict();

const esquemaBusqueda = z.object({ buscar: z.string().trim().min(2).max(30) });

/** Quita intereses repetidos sin distinguir mayúsculas, conservando el primero. */
const sinRepetidos = (intereses: string[]) =>
  intereses.filter(
    (interes, i) =>
      intereses.findIndex((otro) => otro.toLowerCase() === interes.toLowerCase()) === i,
  );

type Dependencias = { repositorio: RepositorioPerfil; dlp: ServicioDlp };

export function crearServicioPerfil({ repositorio, dlp }: Dependencias) {
  async function obtenerPropio(sesion: Sesion) {
    const perfil = await repositorio.propio(sesion.idUsuario);
    if (!perfil) throw errores.noAutenticado();
    return perfil;
  }

  return {
    async obtenerPropioConOpciones(sesion: Sesion) {
      const [perfil, opcionesAvatar] = await Promise.all([
        obtenerPropio(sesion),
        repositorio.opcionesAvatar(),
      ]);
      return { perfil, opcionesAvatar };
    },

    async actualizarPropio(sesion: Sesion, entrada: unknown) {
      const datos = validar(esquemaPerfil, entrada);
      const intereses = sinRepetidos(datos.intereses);
      const actual = await obtenerPropio(sesion);

      if (datos.avatar !== actual.avatar?.id) {
        if (!tienePermiso(sesion.rol, 'personalizar_avatar_propio')) throw errores.prohibido();
        const opciones = await repositorio.opcionesAvatar();
        if (!opciones.some((opcion) => opcion.id === datos.avatar)) {
          throw errores.solicitudInvalida([
            { campo: 'avatar', mensaje: 'Elige un personaje del catálogo.' },
          ]);
        }
      }

      // Todo texto del perfil pasa por el DLP antes de guardarse (F16, RF04).
      await dlp.exigirPermitido(
        { alias: datos.alias, intereses },
        { tipoContenido: 'perfil', idUsuario: sesion.idUsuario },
      );

      try {
        await repositorio.actualizar(sesion.idUsuario, {
          alias: datos.alias,
          intereses,
          idAvatar: datos.avatar,
        });
      } catch (error) {
        if ((error as { code?: string }).code === '23505') {
          throw new ErrorApp(409, 'ALIAS_EN_USO', 'Ese alias ya está en uso. Prueba con otro.', {
            campo: 'alias',
          });
        }
        throw error;
      }
      return obtenerPropio(sesion);
    },

    async buscarEnComunidad(sesion: Sesion, consulta: unknown) {
      const { buscar } = validar(esquemaBusqueda, consulta);
      return repositorio.buscarEnRango(exigirRango(sesion), buscar);
    },

    /** Perfil de otra persona de la misma comunidad; si es de otro rango, 404 como si no existiera. */
    async obtenerPublico(sesion: Sesion, idUsuario: string) {
      const perfil = await repositorio.publicoEnRango(exigirRango(sesion), idUsuario);
      if (!perfil) throw errores.noEncontrado();
      return perfil;
    },
  };
}

export type ServicioPerfil = ReturnType<typeof crearServicioPerfil>;
