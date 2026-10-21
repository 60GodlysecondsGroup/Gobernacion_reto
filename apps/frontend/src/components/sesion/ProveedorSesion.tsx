'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  cerrarSesion,
  iniciarSesionDemo,
  obtenerSesion,
  type Permiso,
  type SesionPublica,
} from '@/lib/api/sesion';

type ContextoSesion = {
  cargando: boolean;
  usuario: SesionPublica | null;
  /** Solo para ocultar o mostrar interfaz. La autorización real la hace el backend. */
  puede: (permiso: Permiso) => boolean;
  entrar: (codigo: string) => Promise<SesionPublica>;
  /** Cierra la sesión y recarga en `destino` (por defecto, el inicio). */
  salir: (destino?: string) => Promise<void>;
  refrescar: () => Promise<void>;
};

const Contexto = createContext<ContextoSesion | null>(null);

export function ProveedorSesion({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<SesionPublica | null>(null);
  const [cargando, setCargando] = useState(true);

  const refrescar = useCallback(async () => {
    try {
      setUsuario((await obtenerSesion()).usuario);
    } catch {
      setUsuario(null);
    }
  }, []);

  useEffect(() => {
    let vigente = true;
    obtenerSesion()
      .then(({ usuario }) => vigente && setUsuario(usuario))
      .catch(() => vigente && setUsuario(null))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, []);

  const valor = useMemo<ContextoSesion>(
    () => ({
      cargando,
      usuario,
      puede: (permiso) => usuario?.permisos.includes(permiso) ?? false,
      entrar: async (codigo) => {
        const { usuario: nuevo } = await iniciarSesionDemo(codigo);
        setUsuario(nuevo);
        return nuevo;
      },
      // Navegación completa: ninguna página privada alcanza a reaccionar a la sesión vacía.
      salir: async (destino = '/') => {
        await cerrarSesion();
        window.location.assign(destino);
      },
      refrescar,
    }),
    [cargando, usuario, refrescar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): ContextoSesion {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useSesion debe usarse dentro de <ProveedorSesion>.');
  return contexto;
}
