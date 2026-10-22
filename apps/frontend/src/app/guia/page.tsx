import type { Metadata } from 'next';
import { Cocuyo } from '@/components/guia/Cocuyo';
import { ContenidoTema } from '@/components/guia/ContenidoTema';
import estilos from '@/components/guia/GuiaPagina.module.css';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { PRESENTACION_GUIA, TEMAS_GUIA } from '@/config/guia';

export const metadata: Metadata = { title: 'Cómo funciona' };

/** Página completa de la guía virtual (F25): el mismo contenido preestablecido, para leer de corrido. */
export default function PaginaGuia() {
  return (
    <div className={estilos.pagina}>
      <EncabezadoPagina antetitulo="Guía" titulo="Cómo funciona la plataforma">
        <span className={estilos.presentacion}>
          <Cocuyo tamano={44} />
          {PRESENTACION_GUIA}
        </span>
      </EncabezadoPagina>
      <nav aria-label="Preguntas" className={estilos.indice}>
        <ul>
          {TEMAS_GUIA.map((tema) => (
            <li key={tema.id}>
              <a href={`#${tema.id}`}>{tema.pregunta}</a>
            </li>
          ))}
        </ul>
      </nav>
      {TEMAS_GUIA.map((tema) => (
        <section
          key={tema.id}
          id={tema.id}
          className={estilos.seccion}
          aria-labelledby={`t-${tema.id}`}
        >
          <h2 id={`t-${tema.id}`}>{tema.pregunta}</h2>
          <ContenidoTema tema={tema} />
        </section>
      ))}
    </div>
  );
}
