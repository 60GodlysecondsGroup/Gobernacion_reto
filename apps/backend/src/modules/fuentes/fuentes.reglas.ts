import type { EstadoFuente, FuenteCompleta } from './fuentes.esquemas.js';

export type AccionEstado = 'marcar_revision' | 'verificar' | 'desactivar';
export type AccionBitacora = 'crear' | 'actualizar' | AccionEstado;

/**
 * Ciclo de vida de una fuente (sección 21 y flujo 14 del Anexo A):
 * Activo → Requiere revisión → Activo (verificada) o Inactivo (ya no disponible).
 */
export const TRANSICIONES: Record<AccionEstado, { desde: EstadoFuente[]; hacia: EstadoFuente }> = {
  marcar_revision: { desde: ['activo', 'inactivo'], hacia: 'requiere_revision' },
  verificar: { desde: ['activo', 'requiere_revision', 'inactivo'], hacia: 'activo' },
  desactivar: { desde: ['activo', 'requiere_revision'], hacia: 'inactivo' },
};

export const accionesPermitidas = (estado: EstadoFuente): AccionEstado[] =>
  (Object.keys(TRANSICIONES) as AccionEstado[]).filter((accion) =>
    TRANSICIONES[accion].desde.includes(estado),
  );

/** Acción de bitácora que mejor describe un cambio hecho por el archivo de carga. */
export function accionParaCambio(
  antes: Pick<FuenteCompleta, 'estado' | 'fechaVerificacion'>,
  despues: Pick<FuenteCompleta, 'estado' | 'fechaVerificacion'>,
): AccionBitacora {
  if (antes.estado !== despues.estado) {
    if (despues.estado === 'inactivo') return 'desactivar';
    if (despues.estado === 'requiere_revision') return 'marcar_revision';
    return 'verificar';
  }
  return antes.fechaVerificacion !== despues.fechaVerificacion ? 'verificar' : 'actualizar';
}

export const CAMPOS_FUENTE = [
  'institucion',
  'servicio',
  'descripcion',
  'tipoCanal',
  'telefono',
  'enlace',
  'horario',
  'fuenteOriginal',
  'necesidades',
  'observaciones',
  'esDemo',
  'estado',
  'fechaVerificacion',
] as const satisfies readonly (keyof FuenteCompleta)[];

export type Cambios = Partial<
  Record<(typeof CAMPOS_FUENTE)[number], { antes: unknown; despues: unknown }>
>;

const comparable = (valor: unknown) =>
  Array.isArray(valor) ? JSON.stringify([...valor].sort()) : JSON.stringify(valor ?? null);

/** Campos que cambian entre dos versiones de una fuente, con su valor anterior y nuevo (F33). */
export function calcularCambios(antes: FuenteCompleta, despues: FuenteCompleta): Cambios {
  const cambios: Cambios = {};
  for (const campo of CAMPOS_FUENTE) {
    if (comparable(antes[campo]) !== comparable(despues[campo])) {
      cambios[campo] = { antes: antes[campo] ?? null, despues: despues[campo] ?? null };
    }
  }
  return cambios;
}

/** Código estable para fuentes creadas desde el panel: `nombre-del-servicio-a1b2c3`. */
export function generarCodigo(servicio: string, sufijo: string): string {
  const base = servicio
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base || 'fuente'}-${sufijo}`;
}
