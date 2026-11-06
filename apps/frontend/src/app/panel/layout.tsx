import { MarcoPanel } from '@/components/panel/MarcoPanel';
import { RequiereSesion } from '@/components/sesion/RequiereSesion';

/**
 * Panel administrativo simplificado (Fase 7). Ruta protegida por rol: la interfaz lo oculta y,
 * sobre todo, cada llamada de API vuelve a comprobar el permiso en el backend. El marco va por
 * fuera de la comprobación: si una página no está disponible para el rol, la navegación sigue ahí.
 */
export default function LayoutPanel({ children }: { children: React.ReactNode }) {
  return (
    <MarcoPanel>
      <RequiereSesion permiso="revisar_reportes">{children}</RequiereSesion>
    </MarcoPanel>
  );
}
