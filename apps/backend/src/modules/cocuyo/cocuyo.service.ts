/**
 * Cocuyo conversacional (F25): la persona escribe en lenguaje natural y Cocuyo responde SOLO con
 * los temas de su catálogo. Controles, en orden:
 *
 *  1. Clasificación local antes de la IA: urgencias, manipulación (prompt injection), pedidos de
 *     acciones y temas fuera de alcance se responden con textos fijos y nunca llegan al proveedor.
 *  2. Datos personales (expresiones propias + reglas DLP): si los hay, el mensaje no sale del
 *     backend y se responde con la respuesta predeterminada.
 *  3. Si el tema no está claro, la IA elige entre las etiquetas del catálogo (enum estricto); una
 *     etiqueta desconocida se descarta.
 *  4. La IA solo recibe la respuesta autorizada del tema elegido y la reformula. La salida se
 *     valida (cifras, enlaces, nombres, temas, longitud); si falla, va la predeterminada.
 *  5. Tiempo máximo total, presupuesto de llamadas por minuto y, ante cualquier fallo del
 *     proveedor, respuesta predeterminada: nunca un error por culpa de la IA.
 *
 * No guarda conversaciones ni registra el texto de la persona (solo metadatos técnicos).
 */
import type { Logger } from '../../lib/logger.js';
import { crearLimitador } from '../seguridad/limitador.js';
import {
  ENLACE_AYUDA,
  IDS_TEMAS,
  RESPUESTAS_META,
  RESPUESTAS_RESERVA,
  TEMAS_POR_ID,
  type Enlace,
  type IdIntencion,
  type IdTema,
} from './cocuyo.catalogo.js';
import { clasificar } from './cocuyo.clasificador.js';
import {
  crearClienteOpenAI,
  esTema,
  interpretarClasificacion,
  solicitudClasificacion,
  solicitudGeneracion,
  type ClienteIa,
  type SolicitudIa,
} from './cocuyo.ia.js';
import { revisorLocal, type RevisorPrivacidad } from './cocuyo.privacidad.js';
import { validarRespuestaGenerada } from './cocuyo.validacion.js';

export const LARGO_MAXIMO_MENSAJE = 300;

export type TipoRespuestaCocuyo =
  'respuesta' | 'aclaracion' | 'fuera_de_alcance' | 'limite' | 'crisis';

export type RespuestaCocuyo = {
  tipo: TipoRespuestaCocuyo;
  /** Intención atendida (tema o intención de conversación), o null si no hubo ninguna. */
  intencion: IdIntencion | null;
  texto: string;
  /** «ia» solo si el texto lo reformuló la IA y pasó la validación. */
  origen: 'ia' | 'predeterminada';
  enlace: Enlace | null;
  /** El frontend muestra debajo los canales institucionales verificados. */
  conCanales: boolean;
  /** Temas del catálogo que se ofrecen como accesos rápidos. */
  sugerencias: IdTema[];
  /** Nota adicional (privacidad o parte de la pregunta fuera de alcance). */
  aviso: string | null;
};

type Dependencias = {
  apiKey?: string;
  modelo: string;
  fetcher?: typeof fetch;
  revisarPrivacidad?: RevisorPrivacidad;
  logger?: Logger;
  /** Tiempo máximo de todas las llamadas a la IA de una pregunta. */
  tiempoMaximoMs?: number;
  /** Llamadas al proveedor por minuto en todo el proceso (protege el costo ante abuso). */
  llamadasIaPorMinuto?: number;
};

const TIEMPO_CLASIFICACION_MS = 3_000;
/** Por debajo de este tiempo restante no vale la pena llamar a la IA. */
const TIEMPO_MINIMO_MS = 1_000;

const TODOS = [...IDS_TEMAS];

const fija = (
  tipo: TipoRespuestaCocuyo,
  texto: string,
  extra: Partial<RespuestaCocuyo> = {},
): RespuestaCocuyo => ({
  tipo,
  intencion: null,
  texto,
  origen: 'predeterminada',
  enlace: null,
  conCanales: false,
  sugerencias: TODOS,
  aviso: null,
  ...extra,
});

/** Quita caracteres de control y espacios repetidos; corta al largo máximo. */
export const limpiarMensaje = (mensaje: string) =>
  mensaje
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2060-\u206f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LARGO_MAXIMO_MENSAJE);

const motivoDeError = (error: unknown) =>
  error instanceof Error
    ? error.name === 'TimeoutError' || error.name === 'AbortError'
      ? 'tiempo_agotado'
      : error.message
    : 'desconocido';

export function crearServicioCocuyo({
  apiKey,
  modelo,
  fetcher,
  revisarPrivacidad = revisorLocal,
  logger,
  tiempoMaximoMs = 7_000,
  llamadasIaPorMinuto = 60,
}: Dependencias) {
  const ia: ClienteIa | null = apiKey ? crearClienteOpenAI({ apiKey, modelo, fetcher }) : null;
  const presupuesto = crearLimitador({ maximo: llamadasIaPorMinuto, ventanaMs: 60_000 });

  /** Llama a la IA dentro del tiempo y del presupuesto; null si no se puede. */
  async function llamarIa(solicitud: Omit<SolicitudIa, 'signal'>, limiteMs: number) {
    if (!ia || limiteMs < TIEMPO_MINIMO_MS) return null;
    if (presupuesto.bloqueadoPor('global') > 0) {
      logger?.warn('Cocuyo: presupuesto de IA agotado; se usa la respuesta predeterminada');
      return null;
    }
    presupuesto.registrar('global');
    return ia({ ...solicitud, signal: AbortSignal.timeout(limiteMs) });
  }

  return {
    async responder(mensaje: string): Promise<RespuestaCocuyo> {
      const texto = limpiarMensaje(mensaje);
      const inicio = Date.now();
      const restante = () => tiempoMaximoMs - (Date.now() - inicio);
      const local = clasificar(texto);

      switch (local.tipo) {
        case 'crisis':
          return fija('crisis', RESPUESTAS_RESERVA.crisis, {
            enlace: ENLACE_AYUDA,
            conCanales: true,
            sugerencias: [],
          });
        case 'manipulacion':
          return fija('limite', RESPUESTAS_RESERVA.manipulacion);
        case 'accion':
          return fija('limite', RESPUESTAS_RESERVA.accion);
        case 'fuera_de_alcance':
          return fija('fuera_de_alcance', RESPUESTAS_RESERVA.fueraDeAlcance);
        case 'meta':
          return fija('respuesta', RESPUESTAS_META[local.meta].texto, {
            intencion: local.meta,
            sugerencias: local.meta === 'cortesia' ? [] : TODOS,
          });
      }

      const privacidad = await revisarPrivacidad(texto);
      const puedeIrALaIa = privacidad === 'limpio';
      const aviso = privacidad === 'personal' ? RESPUESTAS_RESERVA.datosPersonales : null;

      let tema: IdTema | null = local.tipo === 'tema' ? local.tema : null;
      if (!tema && puedeIrALaIa) {
        try {
          const contenido = await llamarIa(
            solicitudClasificacion(texto),
            Math.min(TIEMPO_CLASIFICACION_MS, restante()),
          );
          const etiqueta = contenido === null ? null : interpretarClasificacion(contenido);
          if (contenido !== null && etiqueta === null) {
            logger?.warn('Cocuyo: la IA devolvió una etiqueta fuera del catálogo');
          }
          if (etiqueta === 'fuera_de_alcance') {
            return fija('fuera_de_alcance', RESPUESTAS_RESERVA.fueraDeAlcance);
          }
          if (etiqueta && esTema(etiqueta)) tema = etiqueta;
        } catch (error) {
          logger?.warn('Cocuyo: la clasificación con IA falló', { motivo: motivoDeError(error) });
        }
      }

      if (!tema) {
        const candidatos = local.tipo === 'ambigua' ? local.candidatos : [];
        return fija('aclaracion', RESPUESTAS_RESERVA.aclaracion, {
          sugerencias: candidatos.length > 0 ? candidatos : TODOS,
          aviso,
        });
      }

      const autorizado = TEMAS_POR_ID.get(tema)!;
      let respuesta = autorizado.parrafos.join('\n\n');
      let origen: RespuestaCocuyo['origen'] = 'predeterminada';
      if (puedeIrALaIa) {
        try {
          const generado = await llamarIa(solicitudGeneracion(autorizado, texto), restante());
          if (generado !== null) {
            const validacion = validarRespuestaGenerada(generado, autorizado);
            if (validacion.valida) {
              respuesta = validacion.texto;
              origen = 'ia';
            } else {
              logger?.warn('Cocuyo descartó una respuesta generada', {
                intencion: tema,
                motivo: validacion.motivo,
              });
            }
          }
        } catch (error) {
          logger?.warn('Cocuyo: la generación con IA falló', {
            intencion: tema,
            motivo: motivoDeError(error),
          });
        }
      }

      return {
        tipo: 'respuesta',
        intencion: tema,
        texto: respuesta,
        origen,
        enlace: autorizado.enlace ?? null,
        conCanales: Boolean(autorizado.conCanales),
        sugerencias: [],
        aviso:
          aviso ??
          (local.tipo === 'tema' && local.fueraDeAlcance
            ? RESPUESTAS_RESERVA.notaFueraDeAlcance
            : null),
      };
    },
  };
}

export type ServicioCocuyo = ReturnType<typeof crearServicioCocuyo>;
