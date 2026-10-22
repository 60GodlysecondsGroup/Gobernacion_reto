import { redirect } from 'next/navigation';

/** La moderación vive ahora en el panel administrativo (Fase 7). Se conserva la ruta anterior. */
export default function PaginaModeracion() {
  redirect('/panel/incidencias');
}
