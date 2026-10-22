'use client';

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
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { Logo } from '@/components/layout/Logo';
import { usePathname } from 'next/navigation';
import { useSesion } from '@/components/sesion/ProveedorSesion';
import { NOMBRES_ROL, type Permiso } from '@/lib/api/sesion';
import estilos from './Panel.module.css';

type Seccion = {
  href: string;
  etiqueta: string;
  icono: LucideIcon;
  permiso: Permiso;
  grupo: 'Moderación' | 'Administración' | 'Información';
};

const GRUPOS = ['Moderación', 'Administración', 'Información'] as const;

/** Secciones del panel (Fase 7). Cada una aparece solo si el rol tiene su permiso. */
const SECCIONES: Seccion[] = [
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
    href: '/gestion/fuentes',
    etiqueta: 'Fuentes institucionales',
    icono: Library,
    permiso: 'gestionar_fuentes',
    grupo: 'Información',
  },
];

export function MarcoPanel({ children }: { children: React.ReactNode }) {
  const ruta = usePathname();
  const { usuario, puede } = useSesion();
  const visibles = SECCIONES.filter((s) => puede(s.permiso));
  const activa = (href: string) =>
    href === '/panel' ? ruta === '/panel' : ruta === href || ruta.startsWith(`${href}/`);

  return (
    <div className={estilos.marco}>
      <aside className={estilos.lateral}>
        <div className={estilos.quien}>
          <Logo variante="simbolo" tono="oscuro" tamano={30} />
          <span>
            <span className={estilos.tituloPanel}>Panel</span>
            {usuario && (
              <span className={estilos.rolPanel}>
                {usuario.alias} · {NOMBRES_ROL[usuario.rol]}
              </span>
            )}
          </span>
        </div>
        <nav aria-label="Secciones del panel" className={estilos.navPanel}>
          {GRUPOS.map((grupo) => {
            const deGrupo = visibles.filter((s) => s.grupo === grupo);
            if (deGrupo.length === 0) return null;
            return (
              <div key={grupo} className={estilos.grupoSecciones}>
                <p className={estilos.tituloGrupo} aria-hidden="true">
                  {grupo}
                </p>
                <ul className={estilos.secciones}>
                  {deGrupo.map(({ href, etiqueta, icono: Icono }) => {
                    const actual = activa(href);
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          className={estilos.seccion}
                          aria-current={actual ? 'page' : undefined}
                        >
                          {actual && (
                            <motion.span
                              layoutId="seccion-panel"
                              className={estilos.fondoSeccion}
                              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                            />
                          )}
                          <Icono aria-hidden="true" size={18} />
                          {etiqueta}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
        <p className={estilos.notaLateral}>
          Cada acción queda registrada con quién la hizo y cuándo. Solo ves los datos necesarios
          para moderar.
        </p>
      </aside>
      <div className={estilos.contenido}>{children}</div>
    </div>
  );
}
