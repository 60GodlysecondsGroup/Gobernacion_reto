/** Clave de `localStorage` con el tema elegido («claro» u «oscuro»). */
export const CLAVE_TEMA = 'cp-tema';

/** Cookie con el mismo valor: el servidor la lee y pinta `data-tema` en <html> sin destello. */
export const COOKIE_TEMA = 'cp-tema';

export type TemaElegido = 'claro' | 'oscuro';

export const esTema = (valor: unknown): valor is TemaElegido =>
  valor === 'claro' || valor === 'oscuro';

/** Guarda la elección en la cookie (un año, todo el sitio). */
export function guardarCookieTema(tema: TemaElegido) {
  document.cookie = `${COOKIE_TEMA}=${tema}; path=/; max-age=31536000; samesite=lax`;
}
