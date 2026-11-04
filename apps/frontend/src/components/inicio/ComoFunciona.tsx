'use client';

import {
  ArrowRight,
  BadgeCheck,
  Blocks,
  Building2,
  DoorOpen,
  EyeOff,
  Flag,
  Gamepad2,
  Layers,
  LifeBuoy,
  MessagesSquare,
  Palette,
  ScanSearch,
  ShieldCheck,
  Shirt,
  Signpost,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { TextoRevelado } from '@/components/movimiento/TextoRevelado';
import estilos from './ComoFunciona.module.css';

type Etapa = {
  id: string;
  titulo: string;
  resumen: string;
  texto: string;
  puntos: { icono: LucideIcon; texto: string }[];
  enlace: { texto: string; href: string };
  ilustracion: ReactNode;
};

const ETAPAS: Etapa[] = [
  {
    id: 'comunidad',
    titulo: 'Elige tu comunidad',
    resumen: 'Un espacio para tu edad',
    texto:
      'Al entrar quedas en la comunidad de tu rango de edad. Cada una es un piso aparte: nadie ve ni busca a personas de otro rango.',
    puntos: [
      { icono: Layers, texto: 'Cuatro comunidades: 10–12, 13–15, 16–17 y 18–22 años' },
      { icono: EyeOff, texto: 'Tu edad exacta nunca se muestra' },
    ],
    enlace: { texto: 'Iniciar con mi Avatar', href: '/acceso' },
    ilustracion: <IlustracionPisos />,
  },
  {
    id: 'avatar',
    titulo: 'Crea tu avatar',
    resumen: 'Alias y apariencia',
    texto:
      'Participas con un alias y un avatar que armas a tu gusto. Así te reconocen en tu comunidad sin mostrar tu nombre ni tu foto.',
    puntos: [
      { icono: Shirt, texto: 'Elige ropa, colores y accesorios' },
      { icono: UserRound, texto: 'Sin nombre real, foto ni datos de contacto' },
    ],
    enlace: { texto: 'Ir a mi avatar', href: '/perfil/avatar' },
    ilustracion: <IlustracionIconos iconos={[UserRound, Shirt, Palette]} destacado={0} />,
  },
  {
    id: 'salas',
    titulo: 'Entra a las salas',
    resumen: 'Espacios en vivo',
    texto:
      'Cada sala tiene un tema y su propio ambiente. Entras con tu avatar, te mueves por la sala y conversas con personas de tu comunidad.',
    puntos: [
      { icono: DoorOpen, texto: 'Hasta 10 personas por sala' },
      { icono: MessagesSquare, texto: 'El chat no se guarda y cada mensaje se revisa' },
    ],
    enlace: { texto: 'Ver las salas', href: '/salas' },
    ilustracion: <IlustracionIconos iconos={[DoorOpen, MessagesSquare, Building2]} destacado={0} />,
  },
  {
    id: 'actividades',
    titulo: 'Participa en actividades',
    resumen: 'Objetos y bots',
    texto:
      'Dentro de cada sala hay objetos que puedes tocar: una pizarra, un tablero de ideas, una máquina de café… Cada uno abre una actividad de pocos segundos. Son opcionales y tus resultados no se guardan.',
    puntos: [
      {
        icono: Gamepad2,
        texto: 'Conectar ideas, ordenar ideas, estado de ánimo, ¿Qué harías? y más',
      },
      { icono: Sparkles, texto: 'Dos bots con mensajes automáticos: no son personas ni una IA' },
    ],
    enlace: { texto: 'Explorar las salas', href: '/salas' },
    ilustracion: (
      <IlustracionIconos iconos={[Signpost, ScanSearch, Blocks, Layers]} destacado={1} />
    ),
  },
  {
    id: 'orientacion',
    titulo: 'Encuentra orientación y apoyo',
    resumen: 'Información con fuente',
    texto:
      'Busca por tema y encuentra servicios de instituciones con su fuente y su fecha de verificación. «Necesito ayuda» lleva directo a canales verificados.',
    puntos: [
      { icono: BadgeCheck, texto: 'Cada ficha dice de dónde viene la información' },
      { icono: LifeBuoy, texto: '«Necesito ayuda» está siempre visible arriba' },
    ],
    enlace: { texto: 'Ver los temas', href: '/orientacion' },
    ilustracion: <IlustracionApoyo />,
  },
  {
    id: 'convivencia',
    titulo: 'Convive con seguridad',
    resumen: 'Reglas, filtro y reportes',
    texto:
      'Un filtro revisa cada mensaje antes de publicarlo y bloquea datos personales y lenguaje ofensivo. Si algo te incomoda, lo reportas y moderación lo revisa.',
    puntos: [
      { icono: ShieldCheck, texto: 'El filtro protege tus datos antes de publicar' },
      { icono: Flag, texto: 'Nadie sabe quién hizo un reporte' },
    ],
    enlace: { texto: 'Leer las reglas', href: '/reglas' },
    ilustracion: <IlustracionParticipa />,
  },
];

/**
 * «Cómo funciona» en cuatro etapas. Pestañas accesibles (flechas, Inicio y Fin), el paso activo
 * destacado, un indicador de progreso y una ilustración por etapa. Nada avanza solo.
 */
export function ComoFunciona() {
  const [activa, setActiva] = useState(0);
  const reducir = useReducedMotion();
  const resorte = reducir
    ? { duration: 0 }
    : ({ type: 'spring', stiffness: 300, damping: 30 } as const);
  const base = useId();
  const pestanas = useRef<(HTMLButtonElement | null)[]>([]);
  const etapa = ETAPAS[activa]!;

  const mover = (evento: KeyboardEvent<HTMLButtonElement>) => {
    const destino =
      evento.key === 'ArrowDown' || evento.key === 'ArrowRight'
        ? (activa + 1) % ETAPAS.length
        : evento.key === 'ArrowUp' || evento.key === 'ArrowLeft'
          ? (activa - 1 + ETAPAS.length) % ETAPAS.length
          : evento.key === 'Home'
            ? 0
            : evento.key === 'End'
              ? ETAPAS.length - 1
              : null;
    if (destino === null) return;
    evento.preventDefault();
    setActiva(destino);
    pestanas.current[destino]?.focus();
  };

  return (
    <section id="como-funciona" className={estilos.seccion} aria-labelledby={`${base}-titulo`}>
      <div className={estilos.guia}>
        <TextoRevelado
          as="p"
          className={estilos.antetitulo}
          efecto="letras"
          cuando="scroll"
          tramos={['Cómo funciona']}
        />
        <TextoRevelado
          as="h2"
          id={`${base}-titulo`}
          className={estilos.titulo}
          efecto="inclinado"
          cuando="scroll"
          tramos={['Seis pasos para sentirte en casa']}
        />

        <div
          className={`${estilos.pasos} ${estilos.pasosVidrio}`}
          role="tablist"
          aria-label="Etapas"
          aria-orientation="vertical"
          style={{
            ['--avance' as string]: activa / (ETAPAS.length - 1),
            ['--pasos' as string]: ETAPAS.length,
          }}
        >
          {ETAPAS.map((e, i) => (
            <button
              key={e.id}
              ref={(el) => {
                pestanas.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${e.id}`}
              aria-selected={i === activa}
              aria-controls={`${base}-panel`}
              tabIndex={i === activa ? 0 : -1}
              className={estilos.paso}
              data-hecho={i < activa || undefined}
              onClick={() => setActiva(i)}
              onKeyDown={mover}
            >
              {i === activa && (
                <motion.span
                  layoutId="paso-activo"
                  className={estilos.fondoActivo}
                  transition={
                    reducir ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }
                  }
                />
              )}
              <span className={estilos.numero} aria-hidden="true">
                {i + 1}
              </span>
              <span className={estilos.textosPaso}>
                <span className={estilos.tituloPaso}>{e.titulo}</span>
                <span className={estilos.resumenPaso}>{e.resumen}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div
        id={`${base}-panel`}
        role="tabpanel"
        aria-labelledby={`${base}-tab-${etapa.id}`}
        className={estilos.panel}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={etapa.id}
            className={estilos.contenidoPanel}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, transition: { duration: reducir ? 0 : 0.14 } }}
            transition={resorte}
          >
            <div className={`${estilos.ilustracion} mosaico`} aria-hidden="true">
              {etapa.ilustracion}
            </div>
            <p className={estilos.etapa}>
              Paso {activa + 1} de {ETAPAS.length}
            </p>
            <h3 className={estilos.tituloPanel}>{etapa.titulo}</h3>
            <p className={estilos.texto}>{etapa.texto}</p>
            <ul className={estilos.puntos}>
              {etapa.puntos.map(({ icono: Icono, texto }) => (
                <li key={texto}>
                  <Icono aria-hidden="true" size={18} />
                  {texto}
                </li>
              ))}
            </ul>
            <div className={estilos.accionesPanel}>
              <Link href={etapa.enlace.href} className={estilos.enlace}>
                {etapa.enlace.texto}
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
              {activa < ETAPAS.length - 1 && (
                <button
                  type="button"
                  className={estilos.siguiente}
                  onClick={() => setActiva(activa + 1)}
                >
                  Siguiente paso
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

// ── Ilustraciones (formas simples, sin imágenes externas) ──────────────────────────────
function IlustracionPisos() {
  return (
    <div className={estilos.pisos}>
      {['D', 'C', 'B', 'A'].map((p) => (
        <span key={p} className={estilos.pisoIlus} data-tuyo={p === 'B' || undefined}>
          <span>{p}</span>
          <i />
          <i />
          <i />
          {p === 'B' && <em>Tu piso</em>}
        </span>
      ))}
    </div>
  );
}

function IlustracionIconos({ iconos, destacado }: { iconos: LucideIcon[]; destacado: number }) {
  return (
    <div className={estilos.iconosIlus}>
      {iconos.map((Icono, i) => (
        <span
          key={i}
          className={estilos.iconoIlus}
          data-destacado={i === destacado || undefined}
          style={{ ['--i' as string]: i }}
        >
          <Icono size={26} strokeWidth={1.8} />
        </span>
      ))}
    </div>
  );
}

function IlustracionParticipa() {
  return (
    <div className={estilos.participa}>
      <span className={estilos.burbujaIlus}>¡Hola a todos!</span>
      <span className={estilos.burbujaIlus} data-bloqueada>
        <EyeOff size={14} /> Mensaje con un dato personal
      </span>
      <span className={estilos.escudo}>
        <ShieldCheck size={26} />
      </span>
    </div>
  );
}

function IlustracionApoyo() {
  return (
    <div className={estilos.apoyo}>
      <span className={estilos.salvavidas}>
        <LifeBuoy size={34} />
      </span>
      <span className={estilos.canalIlus}>
        <BadgeCheck size={14} /> Fuente · verificado
      </span>
      <span className={estilos.canalIlus}>
        <BadgeCheck size={14} /> Fuente · verificado
      </span>
    </div>
  );
}
