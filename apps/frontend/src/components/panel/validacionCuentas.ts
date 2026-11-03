/**
 * Reglas de las cuentas que crea el panel (personal y administración), iguales a las del backend
 * para avisar antes de enviar. El backend vuelve a validar todo: esto es solo comodidad.
 */

const PATRON_NOMBRE = /^[\p{L}\p{N}._-]+( [\p{L}\p{N}._-]+)*$/u;
const PATRON_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function problemaNombre(valor: string): string | undefined {
  const nombre = valor.trim();
  if (nombre.length < 3) return 'Usa al menos 3 caracteres.';
  if (nombre.length > 30) return 'Usa máximo 30 caracteres.';
  if (!PATRON_NOMBRE.test(nombre)) {
    return 'Usa letras, números, punto, guion o guion bajo, con un solo espacio entre palabras.';
  }
  return undefined;
}

export function problemaCorreo(valor: string): string | undefined {
  const correo = valor.trim();
  if (!correo) return 'Escribe el correo.';
  if (correo.length > 254 || !PATRON_CORREO.test(correo)) {
    return 'Escribe un correo válido (nombre@dominio.co).';
  }
  return undefined;
}

/** Errores de la contraseña nueva y su confirmación (sin el nombre de la cuenta dentro). */
export function problemasContrasena(
  contrasena: string,
  confirmacion: string,
  nombre: string,
): { contrasena?: string; confirmacion?: string } {
  const errores: { contrasena?: string; confirmacion?: string } = {};
  const sinEspacios = nombre.trim();
  if (contrasena.length < 8) errores.contrasena = 'Usa al menos 8 caracteres.';
  else if (contrasena.length > 128) errores.contrasena = 'Usa máximo 128 caracteres.';
  else if (sinEspacios && contrasena.toLowerCase().includes(sinEspacios.toLowerCase())) {
    errores.contrasena = 'La contraseña no puede contener el nombre de la cuenta.';
  }
  if (!confirmacion) errores.confirmacion = 'Repite la contraseña.';
  else if (confirmacion !== contrasena) errores.confirmacion = 'Las contraseñas no coinciden.';
  return errores;
}

/** Lleva el foco al primer campo marcado con error (tras pintarse). */
export function enfocarPrimerError(formulario: HTMLFormElement | null) {
  requestAnimationFrame(() =>
    formulario
      ?.querySelector<HTMLElement>(
        'input[aria-invalid="true"], fieldset[aria-invalid="true"] input',
      )
      ?.focus(),
  );
}
