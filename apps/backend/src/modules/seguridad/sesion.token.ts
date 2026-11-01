import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Token de la cookie de sesión: `<contenido base64url>.<firma HMAC-SHA256>`.
 * El contenido solo lleva el id de la sesión (app.sesion) y la expiración. La firma descarta
 * tokens inventados sin consultar la base; después, la sesión debe existir, no haber vencido ni
 * haber sido revocada, y rol, rango y estado se leen de la base en cada solicitud.
 */
const firmar = (contenido: string, secreto: string) =>
  createHmac('sha256', secreto).update(contenido).digest('base64url');

export function crearToken(
  idSesion: string,
  secreto: string,
  duracionMs: number,
  ahora = Date.now(),
): string {
  const contenido = Buffer.from(JSON.stringify({ s: idSesion, exp: ahora + duracionMs })).toString(
    'base64url',
  );
  return `${contenido}.${firmar(contenido, secreto)}`;
}

/** Devuelve el id de la sesión si el token es auténtico y no ha expirado; si no, null. */
export function verificarToken(token: string, secreto: string, ahora = Date.now()): string | null {
  const partes = token.split('.');
  if (partes.length !== 2) return null;
  const [contenido, firma] = partes as [string, string];

  const esperada = Buffer.from(firmar(contenido, secreto));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;

  try {
    const datos = JSON.parse(Buffer.from(contenido, 'base64url').toString('utf8')) as {
      s?: unknown;
      exp?: unknown;
    };
    if (typeof datos.s !== 'string' || typeof datos.exp !== 'number' || datos.exp <= ahora) {
      return null;
    }
    return datos.s;
  } catch {
    return null;
  }
}
