'use client';

import { Home, LifeBuoy, LogIn } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSesion } from '@/components/sesion/ProveedorSesion';
import { enlacesNavegacion, type EnlaceNavegacion } from '@/config/navegacion';
import estilos from './Encabezado.module.css';
import { MenuCuenta } from './MenuCuenta';

/**
 * Navegación principal. En escritorio: enlaces en una cápsula, «Necesito ayuda» y el menú de la
 * cuenta. En móvil: barra inferior al alcance del pulgar y la ayuda siempre arriba.
 * Solo se muestran las secciones que el rol puede usar (el backend lo vuelve a comprobar).
 */
export function Navegacion() {
  const ruta = usePathname();
  const { cargando, usuario, puede } = useSesion();

  const visibles = enlacesNavegacion.filter(
    (enlace) =>
      (!enlace.requiereSesion || usuario) &&
      (!enlace.soloSinSesion || (!cargando && !usuario)) &&
      (!enlace.permiso || puede(enlace.permiso)) &&
      (!enlace.requiereComunidad || usuario?.comunidad),
  );

  const activo = (href: string, otras: string[] = []) =>
    [href, ...otras].some((r) =>
      r === '/' ? ruta === '/' : ruta === r || ruta.startsWith(`${r}/`),
    );

  const principales = visibles.filter((e) => !e.soloMenuCuenta);

  // Barra inferior: Inicio + secciones (perfil incluido) o «Entrar»; como mucho cinco.
  const inicio: EnlaceNavegacion = { href: '/', etiqueta: 'Inicio', icono: Home };
  const entrar: EnlaceNavegacion = { href: '/acceso', etiqueta: 'Entrar', icono: LogIn };
  const inferiores = [inicio, ...visibles, ...(!cargando && !usuario ? [entrar] : [])].slice(-5);

  return (
    <>
      <nav aria-label="Principal" className={estilos.navEscritorio}>
        <ul className={estilos.menu}>
          {principales.map(({ href, etiqueta, icono: Icono, tambienActivoEn }) => {
            const actual = activo(href, tambienActivoEn);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={estilos.enlace}
                  aria-current={actual ? 'page' : undefined}
                >
                  {actual && (
                    <motion.span
                      layoutId="indicador-nav"
                      className={estilos.indicador}
                      transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                    />
                  )}
                  <Icono aria-hidden="true" size={18} strokeWidth={2} />
                  <span>{etiqueta}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={estilos.acciones}>
        {/* Siempre visible, con o sin sesión, también en móvil (F18, RF20). */}
        <Link
          href="/ayuda"
          className={estilos.ayuda}
          aria-current={ruta === '/ayuda' ? 'page' : undefined}
        >
          <span className={estilos.pulso} aria-hidden="true" />
          <LifeBuoy aria-hidden="true" size={18} strokeWidth={2.25} />
          Necesito ayuda
        </Link>
        {!cargando &&
          (usuario ? (
            <MenuCuenta />
          ) : (
            <Link href="/acceso" className={estilos.entrar} aria-label="Entrar">
              <LogIn aria-hidden="true" size={18} />
              <span className={estilos.textoEntrar}>Entrar</span>
            </Link>
          ))}
      </div>

      <nav aria-label="Secciones" className={estilos.barraInferior}>
        <ul>
          {inferiores.map(({ href, etiqueta, etiquetaCorta, icono: Icono, tambienActivoEn }) => {
            const actual = activo(href, tambienActivoEn);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={estilos.pestana}
                  aria-current={actual ? 'page' : undefined}
                >
                  <span className={estilos.iconoPestana}>
                    {actual && (
                      <motion.span
                        layoutId="indicador-inferior"
                        className={estilos.fondoPestana}
                        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                      />
                    )}
                    <Icono aria-hidden="true" size={21} strokeWidth={actual ? 2.4 : 2} />
                  </span>
                  <span className={estilos.textoPestana}>{etiquetaCorta ?? etiqueta}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
