'use client';

import { MotionConfig } from 'motion/react';

/**
 * Todas las animaciones respetan la preferencia del sistema «reducir movimiento»: con ella
 * activa, Motion cambia los estados sin animarlos (accesibilidad, sección 28).
 */
export function ProveedorMovimiento({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
