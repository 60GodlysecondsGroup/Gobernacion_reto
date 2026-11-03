import { useId, type ReactNode } from 'react';
import estilos from './Fuentes.module.css';

/** Bloque numerado del formulario de fuentes: agrupa campos con un mismo propósito. */
export function SeccionFormulario({
  numero,
  titulo,
  descripcion,
  children,
}: {
  numero: number;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className={estilos.seccion} aria-labelledby={id}>
      <header className={estilos.cabeceraSeccion}>
        <span className={estilos.numeroSeccion} aria-hidden="true">
          {numero}
        </span>
        <div>
          <h3 id={id} className={estilos.tituloSeccion}>
            {titulo}
          </h3>
          {descripcion && <p className={estilos.descripcionSeccion}>{descripcion}</p>}
        </div>
      </header>
      <div className={estilos.cuerpoSeccion}>{children}</div>
    </section>
  );
}
