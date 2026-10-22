'use client';

import { useCallback, useEffect, useState } from 'react';

const PREFIJO = 'borrador:';

function leer<T>(clave: string, inicial: T): T {
  if (typeof window === 'undefined') return inicial;
  try {
    const guardado = window.sessionStorage.getItem(PREFIJO + clave);
    return guardado ? { ...inicial, ...(JSON.parse(guardado) as Partial<T>) } : inicial;
  } catch {
    return inicial;
  }
}

/**
 * Estado de un formulario que sobrevive a una navegación accidental: se guarda en
 * `sessionStorage` (solo en esta pestaña, se borra al cerrarla) y se limpia al publicar.
 * Solo para formularios que se montan en el cliente (detrás de `RequiereSesion`), así el valor
 * inicial no difiere del HTML del servidor.
 */
export function useBorrador<T extends Record<string, string>>(clave: string, inicial: T) {
  const [valor, setValor] = useState<T>(() => leer(clave, inicial));

  useEffect(() => {
    try {
      const vacio = Object.values(valor).every((v) => !v.trim());
      if (vacio) window.sessionStorage.removeItem(PREFIJO + clave);
      else window.sessionStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
    } catch {
      // Sin almacenamiento disponible (modo privado estricto): el formulario funciona igual.
    }
  }, [clave, valor]);

  const descartar = useCallback(() => {
    try {
      window.sessionStorage.removeItem(PREFIJO + clave);
    } catch {
      // Nada que limpiar.
    }
    setValor(inicial);
    // `inicial` se pasa como literal en cada render: solo importa la clave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  return [valor, setValor, descartar] as const;
}
