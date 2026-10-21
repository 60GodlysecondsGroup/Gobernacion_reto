import type { Logger } from '../../lib/logger.js';
import type { ConteoDatosDemo, RepositorioSistema } from './sistema.repository.js';

export type EstadoSalud = {
  estado: 'ok' | 'degradado';
  backend: 'ok';
  baseDeDatos: {
    estado: 'ok' | 'sin_conexion' | 'sin_esquema';
    latenciaMs: number | null;
  };
  datosDemo: ConteoDatosDemo | null;
  marcaTiempo: string;
};

// Códigos de PostgreSQL: tabla o esquema inexistente (falta ejecutar `npm run db:reset`).
const CODIGOS_SIN_ESQUEMA = new Set(['42P01', '3F000']);

const codigoDe = (error: unknown) => (error as { code?: string } | null)?.code;
const mensajeDe = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function crearServicioSistema(repositorio: RepositorioSistema, logger: Logger) {
  return {
    /** Si el proceso responde, el backend está OK; la base de datos se informa aparte. */
    async obtenerSalud(): Promise<EstadoSalud> {
      const marcaTiempo = new Date().toISOString();
      const inicio = performance.now();

      try {
        await repositorio.verificarConexion();
      } catch (error) {
        logger.warn('Sin conexión a la base de datos', { error: mensajeDe(error) });
        return {
          estado: 'degradado',
          backend: 'ok',
          baseDeDatos: { estado: 'sin_conexion', latenciaMs: null },
          datosDemo: null,
          marcaTiempo,
        };
      }
      const latenciaMs = Math.round(performance.now() - inicio);

      try {
        const datosDemo = await repositorio.contarDatosDemo();
        return {
          estado: 'ok',
          backend: 'ok',
          baseDeDatos: { estado: 'ok', latenciaMs },
          datosDemo,
          marcaTiempo,
        };
      } catch (error) {
        if (!CODIGOS_SIN_ESQUEMA.has(codigoDe(error) ?? '')) throw error;
        return {
          estado: 'degradado',
          backend: 'ok',
          baseDeDatos: { estado: 'sin_esquema', latenciaMs },
          datosDemo: null,
          marcaTiempo,
        };
      }
    },
  };
}

export type ServicioSistema = ReturnType<typeof crearServicioSistema>;
