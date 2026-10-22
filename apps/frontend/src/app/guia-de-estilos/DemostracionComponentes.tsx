'use client';

import { useState } from 'react';
import { Boton, ConfirmarAccion, useNotificar } from '@/components/ui';

/** Demostración del diálogo de confirmación y de las notificaciones. No cambia ningún dato. */
export function DemostracionComponentes() {
  const [abierto, setAbierto] = useState(false);
  const notificar = useNotificar();

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--espacio-3)' }}>
      <Boton variante="secundario" onClick={() => setAbierto(true)}>
        Abrir confirmación
      </Boton>
      <Boton
        variante="secundario"
        onClick={() => notificar('exito', 'Cambios guardados', 'Así se ve una confirmación breve.')}
      >
        Mostrar notificación
      </Boton>
      <ConfirmarAccion
        abierto={abierto}
        alCerrar={() => setAbierto(false)}
        alConfirmar={() => {
          setAbierto(false);
          notificar('info', 'Solo era una demostración', 'No se cambió nada.');
        }}
        titulo="¿Ocultar este contenido?"
        descripcion="Dejará de mostrarse en la comunidad. La acción queda registrada y se puede revertir."
        textoConfirmar="Ocultar"
      />
    </div>
  );
}
