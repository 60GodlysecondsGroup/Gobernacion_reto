import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Building2,
  Compass,
  LayoutDashboard,
  Library,
  MessagesSquare,
  UserRound,
} from 'lucide-react';
import type { Permiso } from '@/lib/api/sesion';

export type EnlaceNavegacion = {
  href: string;
  etiqueta: string;
  /** Nombre corto para la barra inferior del móvil. */
  etiquetaCorta?: string;
  icono: LucideIcon;
  /** En escritorio va en el menú de la cuenta, no en la barra principal. */
  soloMenuCuenta?: boolean;
  /** Solo para quien no ha iniciado sesión (con sesión está en el menú de la cuenta). */
  soloSinSesion?: boolean;
  /** Solo se muestra con sesión iniciada. */
  requiereSesion?: boolean;
  /** Solo se muestra si el rol tiene este permiso (el backend lo vuelve a comprobar). */
  permiso?: Permiso;
  /** Solo se muestra si el usuario pertenece a una comunidad. */
  requiereComunidad?: boolean;
  /** Otras rutas que también marcan este enlace como activo. */
  tambienActivoEn?: string[];
};

/**
 * Menú principal. Cada fase agrega aquí sus secciones cuando funcionan de verdad.
 * «Necesito ayuda» no va aquí: es un botón fijo del encabezado.
 */
export const enlacesNavegacion: EnlaceNavegacion[] = [
  { href: '/orientacion', etiqueta: 'Orientación', icono: Compass },
  {
    href: '/guia',
    etiqueta: 'Cómo funciona',
    etiquetaCorta: 'Guía',
    icono: BookOpen,
    soloSinSesion: true,
  },
  {
    href: '/comunidad',
    etiqueta: 'Mi comunidad',
    etiquetaCorta: 'Comunidad',
    icono: MessagesSquare,
    permiso: 'ver_comunidad_propia',
    requiereComunidad: true,
    tambienActivoEn: ['/perfiles'],
  },
  {
    href: '/salas',
    etiqueta: 'Salas',
    icono: Building2,
    permiso: 'acceder_salas',
    requiereComunidad: true,
  },
  {
    href: '/panel',
    etiqueta: 'Panel',
    icono: LayoutDashboard,
    permiso: 'revisar_reportes',
    tambienActivoEn: ['/moderacion'],
  },
  { href: '/gestion/fuentes', etiqueta: 'Fuentes', icono: Library, permiso: 'gestionar_fuentes' },
  {
    href: '/perfil',
    etiqueta: 'Mi perfil',
    etiquetaCorta: 'Perfil',
    icono: UserRound,
    requiereSesion: true,
    soloMenuCuenta: true,
  },
];
