import { z } from 'zod';
import { ErrorApp, errores } from '../../http/errores.js';
import { esUuid, validar } from '../../http/validacion.js';
import type { ServicioDlp } from '../dlp/dlp.service.js';
import type { Sesion } from '../seguridad/sesion.service.js';
import type { ServicioComunidad } from './comunidad.service.js';
import type { RepositorioHilos } from './hilos.repository.js';

export const HILOS_POR_PAGINA = 10;

const codigoCategoria = z.string().regex(/^[a-z0-9-]{2,60}$/, 'Elige una categoría.');

const esquemaListado = z.object({
  categoria: codigoCategoria.optional(),
  buscar: z.string().trim().min(2).max(60).optional(),
  pagina: z.coerce.number().int().min(1).max(1000).default(1),
});

/** F07: título y contenido. Ningún otro campo: la comunidad sale de la sesión, nunca del cliente. */
const esquemaHilo = z
  .object({
    categoria: codigoCategoria,
    titulo: z
      .string()
      .trim()
      .min(3, 'El título debe tener al menos 3 caracteres.')
      .max(120, 'El título puede tener máximo 120 caracteres.'),
    contenido: z
      .string()
      .trim()
      .min(2, 'Escribe un poco más.')
      .max(5000, 'El texto puede tener máximo 5000 caracteres.'),
  })
  .strict();

const esquemaRespuesta = z
  .object({
    contenido: z
      .string()
      .trim()
      .min(1, 'Escribe tu respuesta.')
      .max(2000, 'La respuesta puede tener máximo 2000 caracteres.'),
  })
  .strict();

type Dependencias = {
  repositorio: RepositorioHilos;
  comunidades: ServicioComunidad;
  dlp: ServicioDlp;
};

/** Foros e hilos (F07–F09). Todo se limita a la comunidad de la sesión y pasa por el DLP. */
export function crearServicioHilos({ repositorio, comunidades, dlp }: Dependencias) {
  async function detalle(idComunidad: string, idHilo: string) {
    const hilo = esUuid(idHilo) ? await repositorio.porId(idComunidad, idHilo) : null;
    if (!hilo) throw errores.noEncontrado();
    return { hilo, respuestas: await repositorio.respuestas(hilo.id) };
  }

  return {
    async categorias(sesion: Sesion) {
      const comunidad = await comunidades.obtenerPropia(sesion);
      return repositorio.categorias(comunidad.id);
    },

    async listar(sesion: Sesion, consulta: unknown) {
      const { categoria, buscar, pagina } = validar(esquemaListado, consulta);
      const comunidad = await comunidades.obtenerPropia(sesion);
      const filas = await repositorio.listar(comunidad.id, {
        categoria,
        buscar,
        limite: HILOS_POR_PAGINA + 1,
        desplazamiento: (pagina - 1) * HILOS_POR_PAGINA,
      });
      return {
        hilos: filas.slice(0, HILOS_POR_PAGINA),
        pagina,
        hayMas: filas.length > HILOS_POR_PAGINA,
      };
    },

    /** Un hilo de otra comunidad responde igual que uno inexistente (no revela que existe). */
    async obtener(sesion: Sesion, idHilo: string) {
      const comunidad = await comunidades.obtenerPropia(sesion);
      return detalle(comunidad.id, idHilo);
    },

    async crear(sesion: Sesion, entrada: unknown) {
      const datos = validar(esquemaHilo, entrada);
      const comunidad = await comunidades.obtenerPropia(sesion);
      const idCategoria = await repositorio.idCategoriaActiva(datos.categoria);
      if (!idCategoria) {
        throw errores.solicitudInvalida([{ campo: 'categoria', mensaje: 'Elige una categoría.' }]);
      }

      await dlp.exigirPermitido(
        { titulo: datos.titulo, contenido: datos.contenido },
        { tipoContenido: 'hilo', idUsuario: sesion.idUsuario },
      );

      const idHilo = await repositorio.crear({
        idUsuario: sesion.idUsuario,
        idComunidad: comunidad.id,
        idCategoria,
        titulo: datos.titulo,
        contenido: datos.contenido,
      });
      return detalle(comunidad.id, idHilo);
    },

    async responder(sesion: Sesion, idHilo: string, entrada: unknown) {
      const { contenido } = validar(esquemaRespuesta, entrada);
      const comunidad = await comunidades.obtenerPropia(sesion);
      const { hilo } = await detalle(comunidad.id, idHilo);
      if (hilo.estado === 'cerrado') {
        throw new ErrorApp(
          409,
          'HILO_CERRADO',
          'Este hilo está cerrado y ya no admite respuestas.',
        );
      }

      await dlp.exigirPermitido(
        { contenido },
        { tipoContenido: 'respuesta', idUsuario: sesion.idUsuario },
      );

      await repositorio.responder({ idHilo: hilo.id, idUsuario: sesion.idUsuario, contenido });
      return detalle(comunidad.id, hilo.id);
    },
  };
}

export type ServicioHilos = ReturnType<typeof crearServicioHilos>;
