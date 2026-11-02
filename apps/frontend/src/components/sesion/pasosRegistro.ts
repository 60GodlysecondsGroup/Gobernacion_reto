/**
 * Registro por etapas de «Iniciar con mi Avatar». Funciones puras (sin React ni DOM): qué pide
 * cada etapa, cómo se valida y a qué etapa pertenece un error. Las reglas son las mismas del
 * backend (perfil.service y sesion.service); el backend vuelve a validarlo todo.
 */
import type { CodigoRango } from '@/lib/api/sesion';

/**
 * Orden de las etapas: primero lo que se escribe (teclado), luego lo que se toca (rango y hobbies)
 * y al final el personaje, que cierra el registro con el botón de crear la cuenta.
 */
export const PASOS_REGISTRO = [
  { id: 'cuenta', titulo: 'Tu cuenta', corto: 'Cuenta' },
  { id: 'sobre-ti', titulo: 'Sobre ti', corto: 'Sobre ti' },
  { id: 'personaje', titulo: 'Tu personaje', corto: 'Personaje' },
] as const;

export type IndicePaso = 0 | 1 | 2;
export const ULTIMO_PASO: IndicePaso = 2;

export type CampoRegistro = 'alias' | 'contrasena' | 'rango' | 'intereses' | 'avatar';
export type ErroresRegistro = Partial<Record<CampoRegistro, string>>;

/** Etapa en la que se corrige cada campo (también los que señala el backend). */
const PASO_DEL_CAMPO: Record<CampoRegistro, IndicePaso> = {
  alias: 0,
  contrasena: 0,
  rango: 1,
  intereses: 1,
  avatar: 2,
};

export const pasoDelCampo = (campo: string): IndicePaso | null =>
  campo in PASO_DEL_CAMPO ? PASO_DEL_CAMPO[campo as CampoRegistro] : null;

/** La primera etapa (en orden) con algún error, o `null` si no hay ninguno. */
export function primerPasoConError(errores: ErroresRegistro): IndicePaso | null {
  const pasos = (Object.keys(errores) as CampoRegistro[])
    .filter((campo) => errores[campo])
    .map((campo) => PASO_DEL_CAMPO[campo]);
  return pasos.length ? (Math.min(...pasos) as IndicePaso) : null;
}

const PATRON_ALIAS = /^[\p{L}\p{N}_.-]+$/u;

export type DatosRegistroLocal = {
  alias: string;
  contrasena: string;
  rango: CodigoRango | null;
};

/** Etapa 1: nametag y contraseña. */
export function validarCuenta({ alias: crudo, contrasena }: DatosRegistroLocal): ErroresRegistro {
  const errores: ErroresRegistro = {};
  const alias = crudo.trim();
  if (alias.length < 3) errores.alias = 'Usa al menos 3 caracteres.';
  else if (alias.length > 30) errores.alias = 'Usa máximo 30 caracteres.';
  else if (!PATRON_ALIAS.test(alias)) {
    errores.alias = 'Usa solo letras, números, punto, guion o guion bajo, sin espacios.';
  }
  if (contrasena.length < 8) errores.contrasena = 'Usa al menos 8 caracteres.';
  else if (contrasena.length > 128) errores.contrasena = 'Usa máximo 128 caracteres.';
  else if (alias && contrasena.toLowerCase().includes(alias.toLowerCase())) {
    errores.contrasena = 'Tu contraseña no puede contener tu nametag.';
  }
  return errores;
}

/** Etapa 2: el rango de edad es obligatorio; los hobbies, opcionales. */
export function validarSobreTi({ rango }: DatosRegistroLocal): ErroresRegistro {
  return rango ? {} : { rango: 'Elige tu rango de edad.' };
}

/** Los errores de una etapa; la del personaje no tiene validación local (solo hay catálogo). */
export function validarPaso(paso: IndicePaso, datos: DatosRegistroLocal): ErroresRegistro {
  if (paso === 0) return validarCuenta(datos);
  if (paso === 1) return validarSobreTi(datos);
  return {};
}

/** Todo el registro, antes de enviarlo. */
export const validarRegistro = (datos: DatosRegistroLocal): ErroresRegistro => ({
  ...validarCuenta(datos),
  ...validarSobreTi(datos),
});

/** Normaliza un hobby escrito a mano; `null` si no cumple el largo (2 a 30 caracteres). */
export function hobbyEscrito(texto: string): string | null {
  const hobby = texto.trim().replace(/\s+/g, ' ');
  return hobby.length < 2 || hobby.length > 30 ? null : hobby;
}
