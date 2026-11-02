import type { Metadata } from 'next';
import { Cocuyo } from '@/components/guia/Cocuyo';
import { PreguntasFrecuentes } from '@/components/guia/PreguntasFrecuentes';
import { ComoFunciona } from '@/components/inicio/ComoFunciona';
import estilos from '@/components/guia/GuiaPagina.module.css';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { PRESENTACION_GUIA, TEMAS_GUIA } from '@/config/guia';

export const metadata: Metadata = { title: 'Cómo funciona' };

/**
 * Página «Cómo funciona»: las seis etapas narrativas y, debajo, la guía completa como preguntas
 * frecuentes en acordeón, con el mismo contenido preestablecido.
 */
export default function PaginaGuia() {
  return (
    <div className={estilos.pagina}>
      <EncabezadoPagina antetitulo="Guía" titulo="Cómo funciona la plataforma">
        <span className={estilos.presentacion}>
          <Cocuyo tamano={44} />
          {PRESENTACION_GUIA}
        </span>
      </EncabezadoPagina>
      <div className={estilos.ancho}>
        <ComoFunciona />
      </div>
      <h2 className={estilos.subtitulo}>Preguntas frecuentes</h2>
      <PreguntasFrecuentes temas={TEMAS_GUIA} />
    </div>
  );
}
