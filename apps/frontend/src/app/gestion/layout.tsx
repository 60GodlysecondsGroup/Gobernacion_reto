import { MarcoPanel } from '@/components/panel/MarcoPanel';
import { RequiereSesion } from '@/components/sesion/RequiereSesion';

/**
 * La gestión de fuentes comparte el marco del panel: la misma barra lateral y las mismas
 * secciones según el rol. Cada página vuelve a exigir `gestionar_fuentes`, y el backend también.
 */
export default function LayoutGestion({ children }: { children: React.ReactNode }) {
  return (
    <RequiereSesion permiso="gestionar_fuentes">
      <MarcoPanel>{children}</MarcoPanel>
    </RequiereSesion>
  );
}
