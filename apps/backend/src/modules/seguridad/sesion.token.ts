import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Token de sesión sin estado: `<contenido base64url>.<firma HMAC-SHA256>`.
 * El contenido solo lleva el id del usuario y la expiración; rol y rango se leen de la base
 * en cada solicitud, así una suspensión o un cambio de rol se aplican de inmediato.
 */
const firmar = (contenido: string, secreto: string) =>
  createHmac('sha256', secreto).update(contenido).digest('base64url');

export function crearToken(
  idUsuario: string,
  secreto: string,
  duracionMs: number,
  ahora = Date.now(),
): string {
  const contenido = Buffer.from(JSON.stringify({ u: idUsuario, exp: ahora + duracionMs })).toString(
    'base64url',
  );
  return `${contenido}.${firmar(contenido, secreto)}`;
}

/** Devuelve el id del usuario si el token es auténtico y no ha expirado; si no, null. */
export function verificarToken(token: string, secreto: string, ahora = Date.now()): string | null {
  const partes = token.split('.');
  if (partes.length !== 2) return null;
  const [contenido, firma] = partes as [string, string];

  const esperada = Buffer.from(firmar(contenido, secreto));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;

  try {
    const datos = JSON.parse(Buffer.from(contenido, 'base64url').toString('utf8')) as {
      u?: unknown;
      exp?: unknown;
    };
    if (typeof datos.u !== 'string' || typeof datos.exp !== 'number' || datos.exp <= ahora) {
      return null;
    }
    return datos.u;
  } catch {
    return null;
  }
}
