/**
 * Límite de intentos en memoria por clave (p. ej. IP + nametag) dentro de una ventana fija.
 * Frena la fuerza bruta contra el inicio de sesión y el abuso del registro sin dependencias.
 *
 * Vive en el proceso: se reinicia con el backend y no se comparte entre instancias. Para varias
 * instancias haría falta un almacén común (DECISIONES.md).
 */
export type Limitador = {
  /** Segundos que faltan para poder intentar de nuevo, o 0 si la clave aún tiene intentos. */
  bloqueadoPor(clave: string, ahora?: number): number;
  registrar(clave: string, ahora?: number): void;
  reiniciar(clave: string): void;
};

export function crearLimitador({
  maximo,
  ventanaMs,
}: {
  maximo: number;
  ventanaMs: number;
}): Limitador {
  const intentos = new Map<string, { cantidad: number; reinicio: number }>();

  function vigente(clave: string, ahora: number) {
    const registro = intentos.get(clave);
    if (registro && registro.reinicio <= ahora) {
      intentos.delete(clave);
      return undefined;
    }
    return registro;
  }

  // Limpieza ocasional para que el mapa no crezca sin fin con claves viejas.
  function podar(ahora: number) {
    if (intentos.size < 10_000) return;
    for (const [clave, registro] of intentos)
      if (registro.reinicio <= ahora) intentos.delete(clave);
  }

  return {
    bloqueadoPor(clave, ahora = Date.now()) {
      const registro = vigente(clave, ahora);
      return registro && registro.cantidad >= maximo
        ? Math.ceil((registro.reinicio - ahora) / 1000)
        : 0;
    },
    registrar(clave, ahora = Date.now()) {
      podar(ahora);
      const registro = vigente(clave, ahora);
      if (registro) registro.cantidad++;
      else intentos.set(clave, { cantidad: 1, reinicio: ahora + ventanaMs });
    },
    reiniciar(clave) {
      intentos.delete(clave);
    },
  };
}
