'use client';

import {
  Home,
  LifeBuoy,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { BotonTema } from '@/components/layout/BotonTema';
import { Logo } from '@/components/layout/Logo';
import { useSesion } from '@/components/sesion/ProveedorSesion';
import { esSeccionActiva, GRUPOS_PANEL, SECCIONES_PANEL } from '@/config/navegacionPanel';
import { NOMBRES_ROL } from '@/lib/api/sesion';
import {
  abrirCajonPanel,
  cerrarCajonPanel,
  CONSULTA_MARCO_MOVIL,
  fijarLateralPlegado,
  useCajonPanelAbierto,
  useLateralPlegado,
  useMarcoPanelActivo,
} from './estadoMarcoPanel';
import estilos from './MarcoPanel.module.css';

const ID_CAJON = 'cajon-panel';
const DURACION_SALIDA_CAJON_MS = 220;

/**
 * Marco de las secciones administrativas (`/panel` y `/gestion`), el único sitio donde se pinta
 * su navegación:
 * - Escritorio (≥ 64rem): sin encabezado superior; barra lateral fija al alto de la pantalla, que
 *   se pliega a solo iconos (con pistas al pasar el puntero o enfocar) y recuerda la elección.
 *   Al pie, «Necesito ayuda», la vuelta a la plataforma, el tema y la cuenta.
 * - Móvil y tableta: encabezado y barra inferior de siempre; los módulos van en un cajón lateral
 *   que se abre con el botón «Módulos» del encabezado (`BotonModulosPanel`).
 * Los módulos salen de `config/navegacionPanel.ts` y se filtran por permiso.
 */
export function MarcoPanel({ children }: { children: ReactNode }) {
  const activo = useMarcoPanelActivo();
  const plegado = useLateralPlegado();

  if (!activo) return children;

  return (
    <div className={estilos.marco} data-plegado={plegado || undefined}>
      <BarraLateral plegado={plegado} />
      <CajonPanel />
      <div className={estilos.contenido}>{children}</div>
    </div>
  );
}

// ── Pistas (tooltips) de la barra plegada ────────────────────────────────────

type Pista = { texto: string; x: number; y: number };

/**
 * Pista flotante junto al icono. Va en un portal a `<body>`: la barra tiene desplazamiento propio
 * y desenfoque, que recortarían o recolocarían cualquier elemento posicionado dentro de ella.
 * Es solo visual (`aria-hidden`): cada icono ya lleva su nombre accesible.
 */
function usePistas(activas: boolean) {
  const [pista, setPista] = useState<Pista | null>(null);
  const visible = activas ? pista : null;

  const props = useCallback(
    (texto: string) => {
      if (!activas) return {};
      const mostrar = (evento: { currentTarget: HTMLElement }) => {
        const caja = evento.currentTarget.getBoundingClientRect();
        setPista({ texto, x: caja.right + 10, y: caja.top + caja.height / 2 });
      };
      const ocultar = () => setPista(null);
      return {
        onPointerEnter: mostrar,
        onPointerLeave: ocultar,
        onFocus: mostrar,
        onBlur: ocultar,
      };
    },
    [activas],
  );

  useEffect(() => {
    if (!visible) return;
    const ocultar = () => setPista(null);
    window.addEventListener('scroll', ocultar, true);
    return () => window.removeEventListener('scroll', ocultar, true);
  }, [visible]);

  const nodo =
    visible &&
    createPortal(
      <span
        className={estilos.pista}
        style={{ left: visible.x, top: visible.y }}
        aria-hidden="true"
        key={visible.texto}
      >
        {visible.texto}
      </span>,
      document.body,
    );

  return { props, nodo };
}

type PropsPistas = ReturnType<typeof usePistas>['props'];

// ── Lista de módulos (compartida por la barra y el cajón) ───────────────────

function ListaSecciones({
  variante,
  pistas,
  alElegir,
}: {
  variante: 'lateral' | 'cajon';
  pistas?: PropsPistas;
  alElegir?: () => void;
}) {
  const ruta = usePathname();
  const { cargando, puede } = useSesion();
  const visibles = SECCIONES_PANEL.filter((s) => puede(s.permiso));

  if (cargando) {
    return (
      <div className={estilos.esqueleto} aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className={estilos.grupos}>
      {GRUPOS_PANEL.map((grupo) => {
        const deGrupo = visibles.filter((s) => s.grupo === grupo);
        if (deGrupo.length === 0) return null;
        return (
          <div key={grupo} className={estilos.grupo}>
            <p className={estilos.tituloGrupo} aria-hidden="true">
              <span>{grupo}</span>
            </p>
            <ul className={estilos.secciones}>
              {deGrupo.map(({ href, etiqueta, icono }) => (
                <li key={href}>
                  <EnlaceSeccion
                    href={href}
                    etiqueta={etiqueta}
                    icono={icono}
                    actual={esSeccionActiva(ruta, href)}
                    indicador={`seccion-panel-${variante}`}
                    pistas={pistas}
                    alElegir={alElegir}
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function EnlaceSeccion({
  href,
  etiqueta,
  icono: Icono,
  actual,
  indicador,
  pistas,
  alElegir,
}: {
  href: string;
  etiqueta: string;
  icono: LucideIcon;
  actual: boolean;
  indicador: string;
  pistas?: PropsPistas;
  alElegir?: () => void;
}) {
  return (
    <Link
      href={href}
      className={estilos.seccion}
      aria-current={actual ? 'page' : undefined}
      onClick={alElegir}
      {...pistas?.(etiqueta)}
    >
      {actual && (
        <motion.span
          layoutId={indicador}
          className={estilos.fondoSeccion}
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        />
      )}
      <Icono aria-hidden="true" size={18} />
      <span className={estilos.etiqueta}>{etiqueta}</span>
    </Link>
  );
}

function Identidad({ children }: { children?: ReactNode }) {
  const { usuario } = useSesion();
  return (
    <div className={estilos.identidad}>
      <Logo tamano={32} className={estilos.logo} />
      <span className={estilos.textosIdentidad}>
        <span className={estilos.tituloPanel}>Panel</span>
        {usuario && (
          <span className={estilos.rolPanel}>
            {usuario.alias} · {NOMBRES_ROL[usuario.rol]}
          </span>
        )}
      </span>
      {children}
    </div>
  );
}

// ── Barra lateral (escritorio) ───────────────────────────────────────────────

function BarraLateral({ plegado }: { plegado: boolean }) {
  const { usuario, salir } = useSesion();
  const ruta = usePathname();
  const idNav = useId();
  const { props: pistas, nodo: pista } = usePistas(plegado);
  const textoPlegar = plegado ? 'Expandir menú' : 'Contraer menú';

  return (
    <aside className={estilos.lateral} aria-label="Panel administrativo">
      <Identidad>
        <button
          type="button"
          className={estilos.botonPlegar}
          onClick={() => fijarLateralPlegado(!plegado)}
          aria-expanded={!plegado}
          aria-controls={idNav}
          {...pistas(textoPlegar)}
        >
          {plegado ? (
            <PanelLeftOpen aria-hidden="true" size={18} />
          ) : (
            <PanelLeftClose aria-hidden="true" size={18} />
          )}
          <span className="visualmente-oculto">{textoPlegar}</span>
        </button>
      </Identidad>

      <nav id={idNav} aria-label="Secciones del panel" className={estilos.navLateral}>
        <ListaSecciones variante="lateral" pistas={pistas} />
      </nav>

      <div className={estilos.pieLateral}>
        {/* Siempre visible, también aquí (F18, RF20): sustituye al botón del encabezado. */}
        <Link
          href="/ayuda"
          className={estilos.ayuda}
          aria-current={ruta === '/ayuda' ? 'page' : undefined}
          {...pistas('Necesito ayuda')}
        >
          <LifeBuoy aria-hidden="true" size={18} strokeWidth={2.25} />
          <span className={estilos.etiqueta}>Necesito ayuda</span>
        </Link>
        <Link href="/" className={estilos.seccion} {...pistas('Ir a la plataforma')}>
          <Home aria-hidden="true" size={18} />
          <span className={estilos.etiqueta}>Ir a la plataforma</span>
        </Link>

        {usuario && (
          <div className={estilos.cuenta}>
            <Link
              href="/perfil"
              className={estilos.enlaceCuenta}
              aria-current={ruta === '/perfil' ? 'page' : undefined}
              {...pistas('Mi perfil')}
            >
              <span className={estilos.inicial} aria-hidden="true">
                {usuario.alias.slice(0, 1).toUpperCase()}
              </span>
              <span className={estilos.datosCuenta}>
                <strong>{usuario.alias}</strong>
                <span>Mi perfil</span>
              </span>
            </Link>
            <span className={estilos.accionesCuenta}>
              <BotonTema />
              <button
                type="button"
                className={estilos.botonIcono}
                onClick={() => void salir()}
                {...pistas('Salir')}
              >
                <LogOut aria-hidden="true" size={18} />
                <span className="visualmente-oculto">Salir</span>
              </button>
            </span>
          </div>
        )}
      </div>
      {pista}
    </aside>
  );
}

// ── Cajón lateral (móvil y tableta) ──────────────────────────────────────────

/**
 * Cajón sobre `<dialog>` nativo: el navegador atrapa el foco, Escape lo cierra y el resto de la
 * página queda inerte. Se cierra al elegir un módulo, al tocar fuera o al pasar a escritorio.
 */
function CajonPanel() {
  const abierto = useCajonPanelAbierto();
  const ruta = usePathname();
  const ref = useRef<HTMLDialogElement>(null);

  // Cualquier cambio de ruta (un módulo, el botón atrás) cierra el cajón.
  useEffect(() => {
    cerrarCajonPanel();
  }, [ruta]);

  // Al pasar a escritorio la barra lateral toma el relevo.
  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_MARCO_MOVIL);
    const alCambiar = () => {
      if (!consulta.matches) cerrarCajonPanel();
    };
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);

  // Al desmontarse el marco (salir del panel), el cajón queda cerrado para la próxima vez.
  useEffect(() => cerrarCajonPanel, []);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto) {
      delete dialogo.dataset.cerrando;
      if (!dialogo.open) dialogo.showModal();
      return;
    }
    if (!dialogo.open) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      dialogo.close();
      return;
    }
    // Salida animada: el cajón se desliza fuera y luego se cierra de verdad (devuelve el foco).
    dialogo.dataset.cerrando = '';
    const temporizador = setTimeout(() => {
      delete dialogo.dataset.cerrando;
      dialogo.close();
    }, DURACION_SALIDA_CAJON_MS);
    return () => clearTimeout(temporizador);
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      id={ID_CAJON}
      className={estilos.cajon}
      aria-label="Módulos del panel"
      onClose={cerrarCajonPanel}
      onCancel={(evento) => {
        // Escape: misma salida animada que el botón de cerrar.
        evento.preventDefault();
        cerrarCajonPanel();
      }}
      onClick={(evento) => {
        // Toque en el fondo (fuera de la hoja): cierra.
        if (evento.target === evento.currentTarget) cerrarCajonPanel();
      }}
    >
      <div className={estilos.hojaCajon}>
        <Identidad>
          <button type="button" className={estilos.botonIcono} onClick={cerrarCajonPanel}>
            <X aria-hidden="true" size={18} />
            <span className="visualmente-oculto">Cerrar módulos</span>
          </button>
        </Identidad>
        <nav aria-label="Secciones del panel" className={estilos.navCajon}>
          <ListaSecciones variante="cajon" alElegir={cerrarCajonPanel} />
        </nav>
        <p className={estilos.nota}>
          Cada acción queda registrada con quién la hizo y cuándo. Solo ves los datos necesarios
          para moderar.
        </p>
      </div>
    </dialog>
  );
}

/**
 * Botón «Módulos» del encabezado en móvil y tableta: abre el cajón. En escritorio no se ve (allí
 * no hay encabezado en el panel). Solo se monta cuando el marco administrativo está activo.
 */
export function BotonModulosPanel() {
  const abierto = useCajonPanelAbierto();
  return (
    <button
      type="button"
      className={estilos.botonModulos}
      onClick={abrirCajonPanel}
      aria-haspopup="dialog"
      aria-expanded={abierto}
      aria-controls={ID_CAJON}
    >
      <Menu aria-hidden="true" size={20} strokeWidth={2.25} />
      <span className={estilos.textoModulos}>Módulos</span>
    </button>
  );
}
