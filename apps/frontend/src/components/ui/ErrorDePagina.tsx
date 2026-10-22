'use client';

import { BotonEnlace } from './Boton';
import { EstadoError } from './Estados';

/**
 * Error al abrir una página de detalle: dice qué pasó (sin tecnicismos), permite reintentar y
 * ofrece un camino de vuelta para no dejar a la persona en un callejón sin salida.
 */
export function ErrorDePagina({
  mensaje,
  volverA,
  textoVolver,
}: {
  mensaje: string;
  volverA: string;
  textoVolver: string;
}) {
  return (
    <EstadoError
      titulo="No pudimos abrir esta página"
      alReintentar={() => window.location.reload()}
      accion={
        <BotonEnlace href={volverA} variante="fantasma">
          {textoVolver}
        </BotonEnlace>
      }
    >
      {mensaje}
    </EstadoError>
  );
}
