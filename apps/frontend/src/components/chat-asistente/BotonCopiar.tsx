'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import estilos from './ChatAsistente.module.css';

/** Copia un texto al portapapeles y confirma durante un momento, sin mover nada alrededor. */
export function BotonCopiar({
  texto,
  etiqueta = 'Copiar',
  conTexto = false,
}: {
  texto: string;
  etiqueta?: string;
  conTexto?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const espera = window.setTimeout(() => setCopiado(false), 1800);
    return () => window.clearTimeout(espera);
  }, [copiado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      // Sin permiso de portapapeles: el texto sigue visible y se puede seleccionar a mano.
    }
  }

  const Icono = copiado ? Check : Copy;
  return (
    <button
      type="button"
      className={estilos.accionMensaje}
      onClick={() => void copiar()}
      aria-label={conTexto ? undefined : copiado ? 'Copiado' : etiqueta}
      title={copiado ? 'Copiado' : etiqueta}
      data-activo={copiado || undefined}
    >
      <Icono size={14} aria-hidden="true" />
      {conTexto && <span aria-live="polite">{copiado ? 'Copiado' : etiqueta}</span>}
    </button>
  );
}
