import { Avatar } from '@/components/avatar/Avatar';
import type { Autor } from '@/lib/api/hilos';
import { formatearFechaHora } from '@/lib/fechas';
import estilos from './Comunidad.module.css';

/** Alias y avatar del autor con la fecha (F09, F37). Nada más sobre la persona. */
export function AutorContenido({ autor, fecha }: { autor: Autor; fecha: string }) {
  return (
    <div className={estilos.autor}>
      <Avatar apariencia={autor.avatar} tamano={28} />
      <span>
        <strong>{autor.alias}</strong>
        <span className={estilos.fecha}> · {formatearFechaHora(fecha)}</span>
      </span>
    </div>
  );
}
