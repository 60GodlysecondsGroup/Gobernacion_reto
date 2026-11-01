import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * Hash de contraseñas con scrypt (node:crypto, sin dependencias). Parámetros mínimos de OWASP:
 * N = 2^17, r = 8, p = 1 (≈ 128 MiB y ≈ 0,4 s por cálculo). Van guardados dentro del hash, así que
 * se pueden subir más adelante sin invalidar las contraseñas existentes.
 *
 * Formato: `scrypt$N$r$p$<sal base64url>$<hash base64url>`.
 */
const PARAMETROS = { N: 2 ** 17, r: 8, p: 1 } as const;
const BYTES_SAL = 16;
const BYTES_HASH = 64;
const MEMORIA_MAXIMA = 256 * 1024 * 1024;

// Cada cálculo reserva ≈ 128 MiB: como mucho dos a la vez, para que una ráfaga de inicios de
// sesión no agote la memoria del servidor.
const MAXIMO_SIMULTANEOS = 2;
let enCurso = 0;
const enEspera: (() => void)[] = [];

async function derivar(contrasena: string, sal: Buffer, opciones: ScryptOptions): Promise<Buffer> {
  if (enCurso >= MAXIMO_SIMULTANEOS) await new Promise<void>((turno) => enEspera.push(turno));
  enCurso++;
  try {
    return await new Promise<Buffer>((resolver, rechazar) =>
      scrypt(contrasena.normalize('NFKC'), sal, BYTES_HASH, opciones, (error, clave) =>
        error ? rechazar(error) : resolver(clave),
      ),
    );
  } finally {
    enCurso--;
    enEspera.shift()?.();
  }
}

export async function hashearContrasena(contrasena: string): Promise<string> {
  const sal = randomBytes(BYTES_SAL);
  const { N, r, p } = PARAMETROS;
  const hash = await derivar(contrasena, sal, { N, r, p, maxmem: MEMORIA_MAXIMA });
  return ['scrypt', N, r, p, sal.toString('base64url'), hash.toString('base64url')].join('$');
}

/** true solo si la contraseña corresponde al hash. Comparación en tiempo constante. */
export async function verificarContrasena(
  contrasena: string,
  almacenado: string,
): Promise<boolean> {
  const partes = almacenado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [N, r, p] = partes.slice(1, 4).map(Number) as [number, number, number];
  if (![N, r, p].every(Number.isSafeInteger)) return false;
  const sal = Buffer.from(partes[4]!, 'base64url');
  const esperado = Buffer.from(partes[5]!, 'base64url');
  if (esperado.length !== BYTES_HASH) return false;

  const calculado = await derivar(contrasena, sal, { N, r, p, maxmem: MEMORIA_MAXIMA });
  return timingSafeEqual(calculado, esperado);
}

/**
 * Hash de una contraseña que nadie conoce. Cuando el nametag no existe (o la cuenta no tiene
 * contraseña) se verifica contra él igual: la respuesta tarda lo mismo y no revela si la cuenta
 * existe.
 */
let hashSenuelo: Promise<string> | null = null;
export const hashDeRelleno = () =>
  (hashSenuelo ??= hashearContrasena(randomBytes(32).toString('hex')));

/** Contraseñas tan comunes que se rechazan aunque cumplan el largo. */
const DEMASIADO_COMUNES = new Set([
  '12345678',
  '123456789',
  '1234567890',
  '87654321',
  '11111111',
  '00000000',
  'password',
  'password1',
  'contraseña',
  'contrasena',
  'qwertyui',
  'qwerty123',
  'abcdefgh',
  'abc12345',
  'iloveyou',
  'teamo123',
]);

export const LARGO_MINIMO_CONTRASENA = 8;
export const LARGO_MAXIMO_CONTRASENA = 128;

/** Motivo por el que una contraseña no sirve, o null si es aceptable. */
export function problemaDeContrasena(contrasena: string, alias?: string): string | null {
  if (contrasena.length < LARGO_MINIMO_CONTRASENA) {
    return `Usa al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`;
  }
  if (contrasena.length > LARGO_MAXIMO_CONTRASENA) {
    return `Usa máximo ${LARGO_MAXIMO_CONTRASENA} caracteres.`;
  }
  const minuscula = contrasena.toLowerCase();
  if (DEMASIADO_COMUNES.has(minuscula) || /^(.)\1+$/.test(contrasena)) {
    return 'Esa contraseña es muy fácil de adivinar. Prueba con otra.';
  }
  if (alias && minuscula.includes(alias.toLowerCase())) {
    return 'Tu contraseña no puede contener tu nametag.';
  }
  return null;
}
