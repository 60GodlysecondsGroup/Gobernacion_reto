import type { Metadata } from 'next';
import { PanelIncidencias } from '@/components/moderacion/PanelIncidencias';

export const metadata: Metadata = { title: 'Incidencias del DLP' };

export default function PaginaIncidencias() {
  return <PanelIncidencias />;
}
