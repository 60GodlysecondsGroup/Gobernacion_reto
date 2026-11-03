'use client';

import { useState } from 'react';
import { ElementoEscalonado, ListaEscalonada } from '@/components/movimiento/Escalonado';
import type { FichaServicio } from '@/lib/api/orientacion';
import { ModalServicio } from './DetalleServicio';
import estilos from './Orientacion.module.css';
import { TarjetaServicio } from './TarjetaServicio';

/**
 * Rejilla de fichas de servicio con consulta rápida: al elegir una tarjeta, su ficha completa se
 * abre en un modal sin salir de la página. La comparten «Necesito ayuda» (`/ayuda`) y las listas
 * por tema de Orientación (p. ej. `/orientacion/informacion_institucional`).
 */
export function RejillaServicios({
  servicios,
  etiqueta,
}: {
  servicios: FichaServicio[];
  /** Nombre accesible de la lista. */
  etiqueta?: string;
}) {
  // La ficha elegida se conserva al cerrar, para que el modal salga con su animación y contenido.
  const [elegido, setElegido] = useState<FichaServicio | null>(null);
  const [abierto, setAbierto] = useState(false);

  const abrir = (servicio: FichaServicio) => {
    setElegido(servicio);
    setAbierto(true);
  };

  return (
    <>
      <ListaEscalonada className={estilos.rejillaServicios} aria-label={etiqueta}>
        {servicios.map((servicio) => (
          <ElementoEscalonado key={servicio.id}>
            <TarjetaServicio servicio={servicio} alAbrir={abrir} />
          </ElementoEscalonado>
        ))}
      </ListaEscalonada>

      {elegido && (
        // Una instancia por ficha: al cambiar de ficha, el modal empieza arriba y sin estado previo.
        <ModalServicio
          key={elegido.id}
          servicio={elegido}
          abierto={abierto}
          alCerrar={() => setAbierto(false)}
        />
      )}
    </>
  );
}
