/**
 * Lenguaje de movimiento único para toda la interfaz (inspirado en iOS):
 * - las respuestas a una acción son inmediatas (≤ 200 ms);
 * - los cambios de contexto (página, panel, diálogo) son algo más pausados (≈ 350–450 ms);
 * - todo entra desde abajo y con poca distancia, y sale más rápido de lo que entra.
 * Con «reducir movimiento», `MotionConfig reducedMotion="user"` elimina desplazamientos y escalas.
 */
export const CURVA_SALIDA = [0.16, 1, 0.3, 1] as const;
export const CURVA_SUAVE = [0.25, 0.1, 0.25, 1] as const;

export const DURACION = {
  rapida: 0.18,
  media: 0.32,
  contexto: 0.45,
} as const;

/** Resorte para indicadores que se deslizan (pestañas, navegación). */
export const RESORTE_INDICADOR = {
  type: 'spring',
  stiffness: 520,
  damping: 40,
  mass: 0.9,
} as const;

/** Resorte para paneles y elementos que aparecen. */
export const RESORTE_PANEL = { type: 'spring', stiffness: 380, damping: 34 } as const;

/** Distancia de entrada en píxeles: corta, para que el contenido «se asiente» sin viajar. */
export const DESPLAZAMIENTO_ENTRADA = 14;

/** Separación entre elementos relacionados de una lista. */
export const PASO_ESCALONADO = 0.05;
