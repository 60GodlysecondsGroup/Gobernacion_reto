import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import estilos from './EnlaceVolver.module.css';

/** Enlace para volver a la sección anterior; siempre en el mismo lugar, arriba a la izquierda. */
export function EnlaceVolver({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className={estilos.volver}>
      <ArrowLeft aria-hidden="true" size={16} />
      {children}
    </Link>
  );
}
