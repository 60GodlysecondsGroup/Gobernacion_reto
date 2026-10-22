import type { Metadata } from 'next';
import { GestionReglasDlp } from '@/components/panel/GestionReglasDlp';

export const metadata: Metadata = { title: 'Reglas DLP' };

export default function Pagina() {
  return <GestionReglasDlp />;
}
