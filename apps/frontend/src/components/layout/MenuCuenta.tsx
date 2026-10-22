'use client';

import { BookOpen, Bot, ChevronDown, LogOut, Shirt, UserRound } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useSesion } from '@/components/sesion/ProveedorSesion';
import { NOMBRES_ROL } from '@/lib/api/sesion';
import estilos from './Encabezado.module.css';

/**
 * Menú de la cuenta (patrón «Dropdown Menu» de shadcn/ui, accesible y sin dependencias):
 * flechas para moverse, Escape para cerrar y el foco vuelve al botón.
 */
export function MenuCuenta() {
  const { usuario, puede, salir } = useSesion();
  const ruta = usePathname();
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null);
  const abierto = abiertoEn === ruta;
  const boton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const idMenu = useId();

  const cerrar = (devolverFoco = false) => {
    setAbiertoEn(null);
    if (devolverFoco) boton.current?.focus();
  };

  useEffect(() => {
    if (!abierto) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const fuera = (evento: PointerEvent) => {
      const objetivo = evento.target as Node;
      if (!menu.current?.contains(objetivo) && !boton.current?.contains(objetivo)) {
        setAbiertoEn(null);
      }
    };
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, [abierto]);

  if (!usuario) return null;

  const teclas = (evento: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const indice = items.indexOf(document.activeElement as HTMLElement);
    if (evento.key === 'Escape') {
      evento.preventDefault();
      cerrar(true);
    } else if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      items[(indice + 1) % items.length]?.focus();
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      items[(indice - 1 + items.length) % items.length]?.focus();
    } else if (evento.key === 'Home') {
      evento.preventDefault();
      items[0]?.focus();
    } else if (evento.key === 'End') {
      evento.preventDefault();
      items.at(-1)?.focus();
    } else if (evento.key === 'Tab') {
      cerrar();
    }
  };

  const contexto = usuario.comunidad ? usuario.comunidad.nombre : NOMBRES_ROL[usuario.rol];

  return (
    <div className={estilos.cuenta}>
      <button
        ref={boton}
        type="button"
        className={estilos.botonCuenta}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? idMenu : undefined}
        onClick={() => setAbiertoEn(abierto ? null : ruta)}
        onKeyDown={(evento) => {
          if (evento.key === 'ArrowDown' && !abierto) {
            evento.preventDefault();
            setAbiertoEn(ruta);
          }
        }}
      >
        <span className={estilos.inicial} aria-hidden="true">
          {usuario.alias.slice(0, 1).toUpperCase()}
        </span>
        <span className={estilos.datosCuenta}>
          <strong>{usuario.alias}</strong>
          <span>{contexto}</span>
        </span>
        <ChevronDown aria-hidden="true" size={16} className={estilos.flecha} />
        <span className="visualmente-oculto">, menú de la cuenta</span>
      </button>

      <AnimatePresence>
        {abierto && (
          <motion.div
            ref={menu}
            id={idMenu}
            role="menu"
            aria-label="Cuenta"
            className={estilos.menuCuenta}
            onKeyDown={teclas}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className={estilos.cabeceraMenu}>
              <strong>{usuario.alias}</strong>
              <span>{contexto}</span>
            </div>
            <Link
              href="/perfil"
              role="menuitem"
              className={estilos.itemMenu}
              onClick={() => cerrar()}
            >
              <UserRound aria-hidden="true" size={18} />
              Mi perfil
            </Link>
            {puede('personalizar_avatar_propio') && (
              <Link
                href="/perfil/avatar"
                role="menuitem"
                className={estilos.itemMenu}
                onClick={() => cerrar()}
              >
                <Shirt aria-hidden="true" size={18} />
                Mi avatar
              </Link>
            )}
            <Link
              href="/guia"
              role="menuitem"
              className={estilos.itemMenu}
              onClick={() => cerrar()}
            >
              <BookOpen aria-hidden="true" size={18} />
              Cómo funciona
            </Link>
            {puede('usar_asistente_usuario') && (
              <Link
                href="/asistente"
                role="menuitem"
                className={estilos.itemMenu}
                onClick={() => cerrar()}
              >
                <Bot aria-hidden="true" size={18} />
                Asistente de orientación
              </Link>
            )}
            <hr className={estilos.separador} />
            <button
              type="button"
              role="menuitem"
              className={estilos.itemMenu}
              onClick={() => {
                cerrar();
                void salir();
              }}
            >
              <LogOut aria-hidden="true" size={18} />
              Salir
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
