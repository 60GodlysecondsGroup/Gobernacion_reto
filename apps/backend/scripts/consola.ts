import { createInterface } from 'node:readline';
import type { Logger } from '../src/lib/logger.js';

/** Lee una línea sin mostrar lo que se escribe (terminal interactiva). */
function preguntarOculto(pregunta: string): Promise<string> {
  const entrada = process.stdin;
  process.stdout.write(pregunta);
  entrada.setRawMode(true);
  entrada.resume();
  entrada.setEncoding('utf8');
  let valor = '';
  return new Promise((resolver, rechazar) => {
    const terminar = () => {
      entrada.off('data', alTeclear);
      entrada.setRawMode(false);
      entrada.pause();
      process.stdout.write('\n');
    };
    function alTeclear(texto: string) {
      for (const caracter of texto) {
        if (caracter === '\r' || caracter === '\n') {
          terminar();
          return resolver(valor);
        }
        if (caracter === '\u0003') {
          terminar();
          return rechazar(new Error('Cancelado.'));
        }
        if (caracter === '\u007f' || caracter === '\b') valor = valor.slice(0, -1);
        else valor += caracter;
      }
    }
    entrada.on('data', alTeclear);
  });
}

/** Sin terminal (entrada redirigida): la primera línea de la entrada estándar. */
async function leerPrimeraLinea(): Promise<string> {
  const lector = createInterface({ input: process.stdin });
  for await (const linea of lector) {
    lector.close();
    return linea;
  }
  return '';
}

/**
 * Pide una contraseña nueva sin que se vea al escribirla, dos veces. Sin terminal interactiva,
 * toma la primera línea de la entrada estándar. Nunca la imprime ni la registra.
 */
export async function leerContrasenaNueva(para: string, logger: Logger): Promise<string> {
  if (!process.stdin.isTTY) {
    logger.warn(
      'La entrada no es una terminal interactiva: se toma la primera línea de la entrada estándar.',
    );
    return leerPrimeraLinea();
  }
  console.log(`Nueva contraseña para ${para} (no se mostrará al escribir).`);
  const contrasena = await preguntarOculto('Contraseña: ');
  if ((await preguntarOculto('Repítela: ')) !== contrasena) {
    throw new Error('Las contraseñas no coinciden. No se cambió nada.');
  }
  return contrasena;
}
