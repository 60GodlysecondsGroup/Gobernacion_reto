import type { z } from 'zod';
import { errores } from './errores.js';

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
