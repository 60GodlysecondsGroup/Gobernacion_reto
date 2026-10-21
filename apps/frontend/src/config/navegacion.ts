import type { Permiso } from '@/lib/api/sesion';

export type EnlaceNavegacion = {
  href: string;
  etiqueta: string;
  /** Solo se muestra con sesión iniciada. */
  requiereSesion?: boolean;
  /** Solo se muestra si el rol tiene este permiso (el backend lo vuelve a comprobar). */
  permiso?: Permiso;
  /** Solo se muestra si el usuario pertenece a una comunidad. */
  requiereComunidad?: boolean;
};

/**
 * Menú principal. Cada fase agrega aquí sus secciones cuando funcionen de verdad
 * (Orientación en la Fase 3, Salas en la 5…).
 */
export const enlacesNavegacion: EnlaceNavegacion[] = [
  { href: '/', etiqueta: 'Inicio' },
  {
    href: '/comunidad',
    etiqueta: 'Mi comunidad',
    permiso: 'ver_comunidad_propia',
    requiereComunidad: true,
  },
  { href: '/perfil', etiqueta: 'Mi perfil', requiereSesion: true },
  { href: '/moderacion', etiqueta: 'Moderación', permiso: 'revisar_incidencias_dlp' },
];
