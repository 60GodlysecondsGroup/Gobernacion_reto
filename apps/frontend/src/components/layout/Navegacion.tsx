'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSesion } from '@/components/sesion/ProveedorSesion';
import { Boton, BotonEnlace } from '@/components/ui';
import { enlacesNavegacion } from '@/config/navegacion';
import { NOMBRES_ROL } from '@/lib/api/sesion';
import estilos from './Encabezado.module.css';

export function Navegacion() {
  const ruta = usePathname();
  const { cargando, usuario, puede, salir } = useSesion();

  const visibles = enlacesNavegacion.filter(
    (enlace) =>
      (!enlace.requiereSesion || usuario) &&
      (!enlace.permiso || puede(enlace.permiso)) &&
      (!enlace.requiereComunidad || usuario?.comunidad),
  );

  return (
    <div className={estilos.zona}>
      <nav aria-label="Principal">
        <ul className={estilos.menu}>
          {visibles.map(({ href, etiqueta }) => {
            const activo = ruta === href || ruta.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={estilos.enlace}
                  aria-current={activo ? 'page' : undefined}
                >
                  {etiqueta}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {!cargando && (
        <div className={estilos.sesion}>
          {usuario ? (
            <>
              <span className={estilos.usuario}>
                <strong>{usuario.alias}</strong>
                <span className={estilos.rol}>{NOMBRES_ROL[usuario.rol]}</span>
              </span>
              <Boton variante="secundario" tamano="sm" onClick={() => void salir()}>
                Salir
              </Boton>
            </>
          ) : (
            <BotonEnlace href="/acceso" tamano="sm">
              Entrar
            </BotonEnlace>
          )}
        </div>
      )}
    </div>
  );
}
