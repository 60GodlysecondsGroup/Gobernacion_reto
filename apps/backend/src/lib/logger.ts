type Nivel = 'debug' | 'info' | 'warn' | 'error';
export type NivelLog = Nivel | 'silencioso';

const prioridad: Record<NivelLog, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silencioso: 100,
};

export type Logger = Record<Nivel, (mensaje: string, datos?: Record<string, unknown>) => void>;

/**
 * Logger mínimo en consola, una línea por evento. Nunca recibe cuerpos de solicitudes
 * ni contenido de usuarios: solo metadatos técnicos (minimización de datos, sección 22).
 */
export function crearLogger(nivelMinimo: NivelLog = 'info'): Logger {
  const escribir = (nivel: Nivel) => (mensaje: string, datos?: Record<string, unknown>) => {
    if (prioridad[nivel] < prioridad[nivelMinimo]) return;
    const linea = `${new Date().toISOString()} ${nivel.toUpperCase().padEnd(5)} ${mensaje}`;
    const salida =
      datos && Object.keys(datos).length > 0 ? `${linea} ${JSON.stringify(datos)}` : linea;
    if (nivel === 'error') console.error(salida);
    else if (nivel === 'warn') console.warn(salida);
    else console.log(salida);
  };

  return {
    debug: escribir('debug'),
    info: escribir('info'),
    warn: escribir('warn'),
    error: escribir('error'),
  };
}
