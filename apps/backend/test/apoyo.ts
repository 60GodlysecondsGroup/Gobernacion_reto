import type { Dependencias } from '../src/app.js';

export const ORIGEN_FRONTEND = 'http://localhost:3000';

/** Configuración fija para pruebas: nunca lee el .env ni secretos reales. */
export const configPrueba: Dependencias['config'] = {
  origenesPermitidos: [ORIGEN_FRONTEND],
  sesion: {
    secreto: 'secreto-solo-para-pruebas-automatizadas-0000',
    secretoGenerado: false,
    duracionMs: 60 * 60 * 1000,
    cookieSegura: false,
  },
  accesoDemo: true,
};
