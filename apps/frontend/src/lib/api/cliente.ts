/**
 * Cliente HTTP centralizado. Toda llamada al backend pasa por aquí: URL base, cookies de sesión,
 * tiempo máximo de espera y formato de error únicos para todo el frontend.
 * El frontend nunca habla con la base de datos: solo con el backend.
 */
export const URL_API = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(
  /\/$/,
  '',
);

const TIEMPO_MAXIMO_MS = 10_000;

export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    readonly codigo: string,
    mensaje: string,
    readonly detalles?: unknown,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Opciones = { signal?: AbortSignal };
type CuerpoDeError = { error?: { codigo?: string; mensaje?: string; detalles?: unknown } } | null;

async function solicitar<T>(
  metodo: Metodo,
  ruta: string,
  cuerpo?: unknown,
  opciones: Opciones = {},
): Promise<T> {
  const limite = AbortSignal.timeout(TIEMPO_MAXIMO_MS);
  const signal = opciones.signal ? AbortSignal.any([opciones.signal, limite]) : limite;

  let respuesta: Response;
  try {
    respuesta = await fetch(`${URL_API}${ruta}`, {
      method: metodo,
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(cuerpo !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      signal,
    });
  } catch (error) {
    if (opciones.signal?.aborted) throw error;
    throw new ErrorApi(0, 'SIN_CONEXION', 'No se pudo conectar con el servidor.');
  }

  const datos: unknown = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const error = (datos as CuerpoDeError)?.error;
    throw new ErrorApi(
      respuesta.status,
      error?.codigo ?? 'ERROR_DESCONOCIDO',
      error?.mensaje ?? 'Ocurrió un error inesperado.',
      error?.detalles,
    );
  }
  return datos as T;
}

/** Mensaje para mostrar al usuario a partir de cualquier error de una llamada. */
export const mensajeDeError = (error: unknown) =>
  error instanceof ErrorApi ? error.message : 'Ocurrió un error inesperado.';

/** Campo señalado por el backend en `detalles.campo` (p. ej. un bloqueo DLP), si lo hay. */
export const campoDelError = (error: unknown): string | undefined => {
  const detalles = error instanceof ErrorApi ? error.detalles : undefined;
  return detalles && typeof detalles === 'object' && 'campo' in detalles
    ? String(detalles.campo)
    : undefined;
};

/** Primer mensaje de validación por campo (`intereses.2` → `intereses`) de un error 400. */
export function erroresPorCampo(error: unknown): Record<string, string> {
  const detalles = error instanceof ErrorApi ? error.detalles : undefined;
  if (!Array.isArray(detalles)) return {};
  const porCampo: Record<string, string> = {};
  for (const { campo, mensaje } of detalles as { campo: string; mensaje: string }[]) {
    const raiz = campo.split('.')[0] ?? campo;
    porCampo[raiz] ??= mensaje;
  }
  return porCampo;
}

export const api = {
  get: <T>(ruta: string, opciones?: Opciones) => solicitar<T>('GET', ruta, undefined, opciones),
  post: <T>(ruta: string, cuerpo?: unknown, opciones?: Opciones) =>
    solicitar<T>('POST', ruta, cuerpo, opciones),
  put: <T>(ruta: string, cuerpo?: unknown, opciones?: Opciones) =>
    solicitar<T>('PUT', ruta, cuerpo, opciones),
  patch: <T>(ruta: string, cuerpo?: unknown, opciones?: Opciones) =>
    solicitar<T>('PATCH', ruta, cuerpo, opciones),
  delete: <T>(ruta: string, opciones?: Opciones) =>
    solicitar<T>('DELETE', ruta, undefined, opciones),
};
