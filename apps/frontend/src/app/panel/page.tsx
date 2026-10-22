import type { Metadata } from 'next';
import { ResumenPanel } from '@/components/panel/ResumenPanel';

export const metadata: Metadata = { title: 'Panel' };

export default function PaginaPanel() {
  return <ResumenPanel />;
}
