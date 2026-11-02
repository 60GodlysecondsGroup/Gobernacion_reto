/** Variables cuyo contenido nunca debe aparecer en los logs de diagnóstico. */
const VARIABLES_SENSIBLES = /(?:URL|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL|KEY|AUTHORIZATION)/i;

function valoresSensibles(): string[] {
  const valores = new Set<string>();
  for (const [nombre, valor] of Object.entries(process.env)) {
    if (!VARIABLES_SENSIBLES.test(nombre) || !valor || valor.length < 4) continue;
    valores.add(valor);
    try {
      valores.add(encodeURIComponent(valor));
    } catch {
      // encodeURIComponent no falla con strings, pero no dejamos que la sanitización interrumpa logs.
    }
  }
  return [...valores].sort((a, b) => b.length - a.length);
}

/** Quita URLs, credenciales y valores sensibles conocidos antes de emitir texto de errores. */
export function sanitizarTexto(texto: string): string {
  let seguro = texto;
  for (const valor of valoresSensibles()) {
    seguro = seguro.replaceAll(valor, '[REDACTADO]');
  }
  const directorioActual = process.cwd().replace(/\\/g, '/');
  if (directorioActual.length >= 4) {
    seguro = seguro.replaceAll(directorioActual, '<directorio-backend>');
    seguro = seguro.replaceAll(directorioActual.replace(/\//g, '\\'), '<directorio-backend>');
  }
  return seguro
    .replace(
      /\b(rediss?|postgres(?:ql)?|https?|mongodb(?:\+srv)?|amqps?|mysql|mariadb):\/\/[^\s"'<>]+/gi,
      '$1://[REDACTADO]',
    )
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}:\d{1,5}\b/g, '[HOST_REDACTADO]')
    .replace(
      /\b(?:[a-z\d-]+\.)+(?!ts:|tsx:|js:|jsx:|mjs:|cjs:|json:|map:|css:|html:|sql:)([a-z]{2,}):\d{1,5}\b/gi,
      '[HOST_REDACTADO]',
    )
    .replace(/\[(?:[\da-f:]+)\]:\d{1,5}/gi, '[HOST_REDACTADO]')
    .replace(/\b[A-Z]:\\Users\\[^\\\s]+/gi, '[RUTA_USUARIO]')
    .replace(/\/(?:home|Users)\/[^/\s]+/g, '/[RUTA_USUARIO]')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [REDACTADO]')
    .replace(
      /((?:password|passwd|pwd|token|secret|api[_-]?key|authorization)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi,
      '$1[REDACTADO]',
    )
    .replace(/[\w.+-]+@[\w.-]+\.[A-Z]{2,}/gi, '[CORREO_REDACTADO]');
}

export function sanitizarRuta(ruta: string): string {
  return sanitizarTexto(ruta.split('?')[0]!).replace(
    /\/(?:[0-9a-f]{8}-[0-9a-f-]{27}|\d{6,}|[^/]{40,})(?=\/|$)/gi,
    '/:id',
  );
}

/** Presencia solamente; nunca devuelve valores de las variables. */
export function presenciaVariablesObligatorias(): Record<string, boolean> {
  return Object.fromEntries(
    ['DATABASE_URL', 'SESSION_SECRET', 'REDIS_URL'].map((nombre) => [
      nombre,
      Boolean(process.env[nombre]?.trim()),
    ]),
  );
}

/** Metadatos útiles para diagnosticar un error sin imprimir su mensaje arbitrario. */
export function datosError(error: unknown, incluirMensaje = false): Record<string, unknown> {
  const esError = error instanceof Error;
  const candidato = error as { name?: unknown; code?: unknown; stack?: unknown } | null;
  const nombre = typeof candidato?.name === 'string' ? candidato.name : 'Error';
  const codigo = typeof candidato?.code === 'string' ? candidato.code : undefined;
  const stack = typeof candidato?.stack === 'string' ? candidato.stack : undefined;
  const marcos = stack?.split('\n').slice(1).join('\n');

  return {
    nombre: sanitizarTexto(nombre),
    ...(codigo && { codigo: sanitizarTexto(codigo) }),
    ...(incluirMensaje && esError && { mensaje: sanitizarTexto(error.message) }),
    ...(marcos && { stack: sanitizarTexto(marcos) }),
  };
}

export function emitirDiagnostico(
  nivel: 'info' | 'warn' | 'error',
  evento: string,
  datos: Record<string, unknown> = {},
) {
  const linea = JSON.stringify({
    timestamp: new Date().toISOString(),
    evento,
    ...datos,
  });
  if (nivel === 'error') console.error(linea);
  else if (nivel === 'warn') console.warn(linea);
  else console.info(linea);
}
