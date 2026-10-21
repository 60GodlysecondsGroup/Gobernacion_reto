export const CODIGOS_RANGO = ['A', 'B', 'C', 'D'] as const;
export type CodigoRango = (typeof CODIGOS_RANGO)[number];

export const esCodigoRango = (valor: string): valor is CodigoRango =>
  (CODIGOS_RANGO as readonly string[]).includes(valor);

/** Lo que el proveedor puede consultar del usuario registrado. */
export type UsuarioParaRango = { idUsuario: string; rangoEdad: string | null };

/**
 * Punto ÚNICO donde se decide el rango de edad de un usuario (RF01).
 * El resto del backend solo usa `sesion.rango`, que sale de aquí.
 *
 * Para conectar el mecanismo definitivo basta con otra implementación de esta interfaz;
 * no hace falta cambiar nada más del sistema.
 */
export interface ProveedorRangoEdad {
  /** Rango A–D del usuario, o null si su rol no pertenece a ninguna comunidad (personal). */
  determinarRango(usuario: UsuarioParaRango): Promise<CodigoRango | null>;
}

/**
 * PROVISIONAL — NO es verificación de edad real.
 * Toma el rango asignado al usuario sintético del seed. El mecanismo definitivo de validación
 * de edad sigue pendiente (sección 8.1 del Documento Maestro y DECISIONES.md).
 */
export const proveedorRangoSintetico: ProveedorRangoEdad = {
  async determinarRango({ rangoEdad }) {
    if (rangoEdad === null) return null;
    if (!esCodigoRango(rangoEdad)) throw new Error(`Rango de edad desconocido: ${rangoEdad}`);
    return rangoEdad;
  },
};
