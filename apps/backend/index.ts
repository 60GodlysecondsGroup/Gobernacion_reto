
import type {} from 'express';

// Este mensaje debe aparecer antes de intentar importar server.ts.
console.error('[ENTRYPOINT] index.ts iniciado', {
  node: process.version,
  vercel: process.env.VERCEL,
  entorno: process.env.NODE_ENV,
});

// Importación dinámica para capturar errores durante la carga
// de server.ts y de todos sus módulos dependientes.
const modulo = await import('./src/server.js').catch((error: unknown) => {
  console.error('[ENTRYPOINT] ERROR cargando server.ts', error);
  throw error;
});

console.error('[ENTRYPOINT] server.ts importado correctamente');

// Conservamos el servidor HTTP original de la aplicación.
export default modulo.default;
