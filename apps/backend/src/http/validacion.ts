import { z } from 'zod';
import { errores } from './errores.js';

// Mensajes de validación en español para toda la API.
z.config(z.locales.es());

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const esUuid = (valor: string) => PATRON_UUID.test(valor);

/**
 * Valida y normaliza una entrada (body, query o params) con un esquema zod.
 * Si no es válida lanza un 400 con la lista de campos; nunca devuelve los valores recibidos.
 *
 *   const datos = validar(esquemaCrearHilo, req.body);
 */
export function validar<Esquema extends z.ZodType>(
  esquema: Esquema,
  entrada: unknown,
): z.output<Esquema> {
  const resultado = esquema.safeParse(entrada);
  if (!resultado.success) {
    throw errores.solicitudInvalida(
      resultado.error.issues.map((issue) => ({
        campo: issue.path.join('.') || '(raíz)',
        mensaje: issue.message,
      })),
    );
  }
  return resultado.data;
}
