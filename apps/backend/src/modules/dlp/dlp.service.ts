import { ErrorApp } from '../../http/errores.js';
import type { Logger } from '../../lib/logger.js';
import {
  analizar,
  masGrave,
  MENSAJE_BLOQUEO,
  normalizar,
  type DeteccionDlp,
  type ReglaCompilada,
  type TipoContenido,
} from './dlp.analizador.js';
import type { RepositorioDlp } from './dlp.repository.js';

export type ContextoDlp = { tipoContenido: TipoContenido; idUsuario: string | null };

export type ResultadoDlp =
  | { permitido: true; deteccion: DeteccionDlp | null }
  | { permitido: false; deteccion: DeteccionDlp; mensaje: string };

/**
 * Punto de extensión para un clasificador automático futuro (sección 16.2). Recibe el texto
 * normalizado y devuelve una detección o null. Hoy no hay ninguno conectado: solo reglas.
 */
export type ClasificadorDlp = (
  textoNormalizado: string,
  contexto: ContextoDlp,
) => Promise<DeteccionDlp | null>;

type Dependencias = {
  repositorio: RepositorioDlp;
  logger: Logger;
  /** Cuánto se reutilizan las reglas leídas de la base antes de volver a consultarlas. */
  ttlReglasMs?: number;
  clasificadores?: ClasificadorDlp[];
};

const RESULTADO_POR_ACCION = {
  bloquear: 'bloqueado',
  advertir: 'advertido',
  registrar: 'registrado',
} as const;

/**
 * DLP reutilizable por perfiles, hilos, respuestas y salas: todo texto de usuarios pasa por
 * aquí antes de guardarse o difundirse (RF04).
 */
export function crearServicioDlp({
  repositorio,
  logger,
  ttlReglasMs = 15_000,
  clasificadores = [],
}: Dependencias) {
  let cache: { reglas: ReglaCompilada[]; vence: number } | null = null;

  async function reglas(): Promise<ReglaCompilada[]> {
    if (cache && cache.vence > Date.now()) return cache.reglas;
    try {
      const nuevas = await repositorio.reglasActivas();
      cache = { reglas: nuevas, vence: Date.now() + ttlReglasMs };
      return nuevas;
    } catch (error) {
      // Seguridad primero: si no se pueden leer las reglas, no se publica nada.
      logger.error('No se pudieron cargar las reglas DLP', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ErrorApp(
        503,
        'DLP_NO_DISPONIBLE',
        'No pudimos revisar el contenido en este momento. Intenta de nuevo en unos segundos.',
      );
    }
  }

  async function revisar(texto: string, contexto: ContextoDlp): Promise<ResultadoDlp> {
    let deteccion = analizar(texto, await reglas());
    if (deteccion?.accion !== 'bloquear') {
      for (const clasificador of clasificadores) {
        deteccion = masGrave(deteccion, await clasificador(normalizar(texto), contexto));
      }
    }
    if (!deteccion) return { permitido: true, deteccion: null };

    await repositorio.registrarEvento({
      idUsuario: contexto.idUsuario,
      tipoContenido: contexto.tipoContenido,
      categoria: deteccion.categoria,
      idRegla: deteccion.regla.id,
      accion: deteccion.accion,
      resultado: RESULTADO_POR_ACCION[deteccion.accion],
    });

    return deteccion.accion === 'bloquear'
      ? { permitido: false, deteccion, mensaje: MENSAJE_BLOQUEO }
      : { permitido: true, deteccion };
  }

  return {
    revisar,

    /**
     * Revisa varios campos y lanza un 422 con el mensaje estándar en el primero bloqueado.
     * La respuesta indica el campo, nunca el dato ni la categoría detectada.
     */
    async exigirPermitido(
      campos: Record<string, string | string[]>,
      contexto: ContextoDlp,
    ): Promise<void> {
      for (const [campo, valor] of Object.entries(campos)) {
        for (const texto of Array.isArray(valor) ? valor : [valor]) {
          const resultado = await revisar(texto, contexto);
          if (!resultado.permitido) {
            throw new ErrorApp(422, 'CONTENIDO_BLOQUEADO', resultado.mensaje, { campo });
          }
        }
      }
    },

    invalidarCache() {
      cache = null;
    },
  };
}

export type ServicioDlp = ReturnType<typeof crearServicioDlp>;
