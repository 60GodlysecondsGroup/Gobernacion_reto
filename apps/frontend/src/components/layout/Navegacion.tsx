'use client';

import { LifeBuoy, LogIn } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSesion } from '@/components/sesion/ProveedorSesion';
import { enlacesNavegacion, type EnlaceNavegacion } from '@/config/navegacion';
import { useBarrasAlDesplazar } from '@/lib/hooks/useBarrasAlDesplazar';
import { BotonTema } from './BotonTema';
import estilos from './Encabezado.module.css';
import { MenuCuenta } from './MenuCuenta';

/**
 * Secciones visibles para el rol actual. Solo se muestran las que el rol puede usar (el backend
 * lo vuelve a comprobar en cada llamada).
 */
function useSecciones() {
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
  // «Inicio» va siempre primero; si sobran secciones, se recortan las del medio, nunca Inicio.
  const inicio = visibles.find((e) => e.href === '/')!;
  const entrar: EnlaceNavegacion = { href: '/acceso', etiqueta: 'Entrar', icono: LogIn };
  const resto = [...visibles.filter((e) => e !== inicio), ...(!cargando && !usuario ? [entrar] : [])];
  const inferiores = [inicio, ...resto.slice(-4)];

  return { ruta, cargando, usuario, activo, principales, inferiores };
}

/**
 * Navegación del encabezado. En escritorio: control segmentado con las secciones, «Necesito
 * ayuda» y el menú de la cuenta. En móvil solo quedan la ayuda y la cuenta: las secciones van en
 * la barra inferior (`BarraInferior`).
 */
export function Navegacion() {
  const { ruta, cargando, usuario, activo, principales } = useSecciones();

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
                      transition={{ type: 'spring', stiffness: 520, damping: 40 }}
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
        <BotonTema />
        {/* Siempre visible, con o sin sesión, también en móvil (F18, RF20). */}
        <Link
          href="/ayuda"
          className={estilos.ayuda}
          aria-current={ruta === '/ayuda' ? 'page' : undefined}
        >
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
    </>
  );
}

/**
 * Barra inferior flotante de cristal (móvil y tableta), al alcance del pulgar. Va fuera del
 * encabezado: el desenfoque de la barra superior convertiría `position: fixed` en relativo a ella.
 * Se monta una sola vez, así que también turna las dos barras al desplazarse (solo en móvil).
 */
export function BarraInferior() {
  const { activo, inferiores } = useSecciones();
  useBarrasAlDesplazar();

  return (
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
                {actual && (
                  <motion.span
                    layoutId="indicador-inferior"
                    className={estilos.fondoPestana}
                    transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                  />
                )}
                <span className={estilos.iconoPestana}>
                  <Icono aria-hidden="true" size={22} strokeWidth={actual ? 2.3 : 1.9} />
                </span>
                <span className={estilos.textoPestana}>{etiquetaCorta ?? etiqueta}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
