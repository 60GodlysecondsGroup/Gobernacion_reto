import { MarcoPanel } from '@/components/panel/MarcoPanel';
import { RequiereSesion } from '@/components/sesion/RequiereSesion';

/**
 * Panel administrativo simplificado (Fase 7). Ruta protegida por rol: la interfaz lo oculta y,
 * sobre todo, cada llamada de API vuelve a comprobar el permiso en el backend.
 */
export default function LayoutPanel({ children }: { children: React.ReactNode }) {
  return (
    <RequiereSesion permiso="revisar_reportes">
      <MarcoPanel>{children}</MarcoPanel>
    </RequiereSesion>
  );
}
