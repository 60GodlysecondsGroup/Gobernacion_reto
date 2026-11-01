'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  cerrarSesion,
  iniciarSesion,
  iniciarSesionPersonal,
  obtenerSesion,
  registrarse,
  type DatosInicio,
  type DatosInicioPersonal,
  type DatosRegistro,
  type Permiso,
  type SesionPublica,
} from '@/lib/api/sesion';

type ContextoSesion = {
  cargando: boolean;
  usuario: SesionPublica | null;
  /** Solo para ocultar o mostrar interfaz. La autorización real la hace el backend. */
  puede: (permiso: Permiso) => boolean;
  /** Inicia sesión con nametag y contraseña. */
  entrar: (datos: DatosInicio) => Promise<SesionPublica>;
  /** Inicia sesión con correo y contraseña (cuentas de personal). */
  entrarPersonal: (datos: DatosInicioPersonal) => Promise<SesionPublica>;
  /** Crea la cuenta y deja la sesión iniciada. */
  registrarse: (datos: DatosRegistro) => Promise<SesionPublica>;
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
      entrar: async (datos) => {
        const { usuario: nuevo } = await iniciarSesion(datos);
        setUsuario(nuevo);
        return nuevo;
      },
      entrarPersonal: async (datos) => {
        const { usuario: nuevo } = await iniciarSesionPersonal(datos);
        setUsuario(nuevo);
        return nuevo;
      },
      registrarse: async (datos) => {
        const { usuario: nuevo } = await registrarse(datos);
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
