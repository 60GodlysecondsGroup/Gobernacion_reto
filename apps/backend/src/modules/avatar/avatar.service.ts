import { z } from 'zod';
import { ErrorApp } from '../../http/errores.js';
import type { Sesion } from '../seguridad/sesion.service.js';
import {
  CAPAS,
  TIPO_DE_CAPA,
  type ConfiguracionAvatar,
  type RepositorioAvatar,
} from './avatar.repository.js';

/** Un identificador del catálogo: nunca una URL, una imagen ni texto con espacios. */
const idDelCatalogo = z.string().regex(/^[a-z0-9-]{2,40}$/, 'Elige una opción del catálogo.');

/**
 * Configuración del avatar (F36, RF21, RF22): solo identificadores del catálogo, una por capa.
 * Cualquier otro campo (foto, imagen, texto, nombre, otro usuario…) se rechaza.
 * Cabello y accesorio son opcionales; personaje, rasgos y prenda, obligatorios.
 */
const esquemaAvatar = z.strictObject(
  {
    personaje: idDelCatalogo,
    cabello: idDelCatalogo.nullable(),
    rasgos: idDelCatalogo,
    prenda: idDelCatalogo,
    accesorio: idDelCatalogo.nullable(),
  },
  { error: 'El avatar solo admite elementos del catálogo.' },
);

const avatarInvalido = (detalles: { campo: string; mensaje: string }[]) =>
  new ErrorApp(
    400,
    'AVATAR_INVALIDO',
    'El avatar solo se arma con elementos del catálogo: no admite fotos, enlaces ni texto.',
    detalles,
  );

export function crearServicioAvatar(repositorio: RepositorioAvatar) {
  return {
    /** «Mi avatar»: la configuración guardada (o null) y el catálogo activo. */
    async obtenerPropio(sesion: Sesion) {
      const [configuracion, catalogo] = await Promise.all([
        repositorio.configuracion(sesion.idUsuario),
        repositorio.catalogo(),
      ]);
      return { configuracion, catalogo };
    },

    /**
     * Guarda el avatar de la persona de la sesión. No hay forma de indicar otro usuario: el id
     * sale de la sesión y el esquema no admite campos extra.
     */
    async guardarPropio(sesion: Sesion, entrada: unknown) {
      const resultado = esquemaAvatar.safeParse(entrada);
      if (!resultado.success) {
        throw avatarInvalido(
          resultado.error.issues.map((issue) => ({
            campo: issue.path.join('.') || '(raíz)',
            mensaje: issue.message,
          })),
        );
      }
      const configuracion: ConfiguracionAvatar = resultado.data;

      // Cada capa debe ser un elemento activo del catálogo y del tipo que le corresponde.
      const catalogo = await repositorio.catalogo();
      const fueraDelCatalogo = CAPAS.filter((capa) => {
        const id = configuracion[capa];
        return (
          id !== null &&
          !catalogo.some((elemento) => elemento.id === id && elemento.tipo === TIPO_DE_CAPA[capa])
        );
      });
      if (fueraDelCatalogo.length > 0) {
        throw avatarInvalido(
          fueraDelCatalogo.map((campo) => ({ campo, mensaje: 'Elige una opción del catálogo.' })),
        );
      }

      await repositorio.guardar(sesion.idUsuario, configuracion);
      return { configuracion, apariencia: await repositorio.apariencia(sesion.idUsuario) };
    },
  };
}

export type ServicioAvatar = ReturnType<typeof crearServicioAvatar>;
