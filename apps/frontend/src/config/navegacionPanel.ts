import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  Building2,
  Flag,
  Gauge,
  History,
  Layers,
  Library,
  ShieldCheck,
  ShieldUser,
  UserCog,
  Users,
} from 'lucide-react';
import type { Permiso } from '@/lib/api/sesion';

/**
 * Navegación de las secciones administrativas (Fase 7). Es la única fuente de los módulos: la
 * usan la barra lateral de escritorio y el cajón del móvil (`MarcoPanel`). Cada módulo aparece
 * solo si el rol tiene su permiso; el backend lo vuelve a comprobar en cada llamada.
 */
export const GRUPOS_PANEL = ['Moderación', 'Administración', 'Superadmin', 'Información'] as const;

export type SeccionPanel = {
  href: string;
  etiqueta: string;
  icono: LucideIcon;
  permiso: Permiso;
  grupo: (typeof GRUPOS_PANEL)[number];
};

export const SECCIONES_PANEL: SeccionPanel[] = [
  {
    href: '/panel',
    etiqueta: 'Resumen',
    icono: Gauge,
    permiso: 'revisar_reportes',
    grupo: 'Moderación',
  },
  {
    href: '/panel/reportes',
    etiqueta: 'Reportes',
    icono: Flag,
    permiso: 'revisar_reportes',
    grupo: 'Moderación',
  },
  {
    href: '/panel/incidencias',
    etiqueta: 'Incidencias DLP',
    icono: ShieldCheck,
    permiso: 'revisar_incidencias_dlp',
    grupo: 'Moderación',
  },
  {
    href: '/panel/usuarios',
    etiqueta: 'Usuarios',
    icono: Users,
    permiso: 'gestionar_usuarios',
    grupo: 'Administración',
  },
  {
    href: '/panel/personal',
    etiqueta: 'Cuentas de personal',
    icono: UserCog,
    permiso: 'gestionar_personal',
    grupo: 'Administración',
  },
  {
    href: '/panel/salas',
    etiqueta: 'Salas',
    icono: Building2,
    permiso: 'configurar_comunidades',
    grupo: 'Administración',
  },
  {
    href: '/panel/comunidades',
    etiqueta: 'Comunidades y categorías',
    icono: Layers,
    permiso: 'configurar_comunidades',
    grupo: 'Administración',
  },
  {
    href: '/panel/reglas',
    etiqueta: 'Reglas DLP',
    icono: ShieldCheck,
    permiso: 'consultar_reglas_dlp',
    grupo: 'Administración',
  },
  {
    href: '/panel/registro',
    etiqueta: 'Registro de acciones',
    icono: History,
    permiso: 'consultar_registros_administrativos',
    grupo: 'Administración',
  },
  {
    href: '/panel/asistente',
    etiqueta: 'Asistente IA',
    icono: Bot,
    permiso: 'usar_asistente_admin',
    grupo: 'Administración',
  },
  {
    href: '/panel/superadmin',
    etiqueta: 'Administradores',
    icono: ShieldUser,
    permiso: 'gestionar_administradores',
    grupo: 'Superadmin',
  },
  {
    href: '/gestion/fuentes',
    etiqueta: 'Fuentes institucionales',
    icono: Library,
    permiso: 'gestionar_fuentes',
    grupo: 'Información',
  },
];

/** Rutas que se pintan dentro del marco administrativo (ver `app/panel` y `app/gestion`). */
const PREFIJOS_PANEL = ['/panel', '/gestion'];

export const esRutaPanel = (ruta: string) =>
  PREFIJOS_PANEL.some((prefijo) => ruta === prefijo || ruta.startsWith(`${prefijo}/`));

/** «Resumen» (`/panel`) solo se marca en su propia ruta; el resto, también en sus subrutas. */
export const esSeccionActiva = (ruta: string, href: string) =>
  href === '/panel' ? ruta === '/panel' : ruta === href || ruta.startsWith(`${href}/`);
