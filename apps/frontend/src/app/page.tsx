import { ArrowRight, Check, LifeBuoy, ShieldCheck, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Chigui } from '@/components/guia/Chigui';
import { AtajosOrientacion } from '@/components/inicio/AtajosOrientacion';
import { ComoFunciona } from '@/components/inicio/ComoFunciona';
import { TituloHeroe } from '@/components/inicio/TituloHeroe';
import { ValleComunidades } from '@/components/inicio/ValleComunidades';
import { Inclinable } from '@/components/movimiento/Inclinable';
import { Magnetico } from '@/components/movimiento/Magnetico';
import { Paralaje } from '@/components/movimiento/Paralaje';
import { TextoRevelado } from '@/components/movimiento/TextoRevelado';
import { AccionesInicio } from '@/components/sesion/AccionesInicio';
import { OBJETOS_SALA } from '@/config/salas-mundo';
import estilos from './page.module.css';

const ACTIVIDADES = OBJETOS_SALA.map((o) => o.titulo);

const GARANTIAS = [
  'Participas con alias, sin datos personales',
  'Cada fuente indica cuándo se verificó',
  'Gratis y sin anuncios',
];

export default function Inicio() {
  return (
    <div className={estilos.pagina}>
      {/* ── Héroe ─────────────────────────────────────── */}
      <section className={estilos.heroe} aria-labelledby="titulo-inicio">
        <div className={estilos.textoHeroe}>
          <TituloHeroe />
          <TextoRevelado
            as="p"
            className={estilos.entradilla}
            efecto="desenfoque"
            retraso={420}
            paso={14}
            tramos={[
              'Una comunidad digital para jóvenes de 10 a 22 años, donde puedes encontrar orientación, participar de forma segura y compartir experiencias.',
            ]}
          />
          <div className={estilos.acciones}>
            <Magnetico fuerza={0.12} className={estilos.magnetico}>
              <AccionesInicio />
            </Magnetico>
          </div>
          <ul className={estilos.garantias}>
            {GARANTIAS.map((texto) => (
              <li key={texto}>
                <Check aria-hidden="true" size={15} strokeWidth={2.6} />
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <Paralaje className={estilos.visual} distancia={40}>
          <Inclinable maximo={4}>
            <div className={estilos.ilustracion}>
              {/* El valle se descubre por mosaicos al cargar la portada. */}
              <div className="mosaico" style={{ '--mosaico-retraso': '220ms' } as CSSProperties}>
                <ValleComunidades />
              </div>
            </div>
          </Inclinable>
          <p className={`${estilos.chip} ${estilos.chipA}`} aria-hidden="true">
            <Users size={15} />4 comunidades separadas
          </p>
          <p className={`${estilos.chip} ${estilos.chipB}`} aria-hidden="true">
            <ShieldCheck size={15} />
            Filtro de privacidad activo
          </p>
        </Paralaje>
      </section>

      {/* ── Orientación ───────────────────────────────── */}
      <section className={estilos.seccion} aria-labelledby="titulo-orientacion">
        <div className={estilos.cabeceraSeccion}>
          <TextoRevelado
            as="p"
            className={estilos.antetituloSeccion}
            efecto="letras"
            cuando="scroll"
            tramos={['Orientación']}
          />
          <TextoRevelado
            as="h2"
            id="titulo-orientacion"
            efecto="desenfoque"
            cuando="scroll"
            tramos={['¿Qué información buscas hoy?']}
          />
          <p>
            No necesitas iniciar sesión. Aquí no hay preguntas sobre ti ni resultados: solo
            información de instituciones.
          </p>
        </div>
        <AtajosOrientacion />
        <Link href="/ayuda" className={`${estilos.ayuda} revelar-lateral`}>
          <span className={estilos.iconoAyuda} aria-hidden="true">
            <LifeBuoy size={22} />
          </span>
          <span className={estilos.textoAyuda}>
            <strong>¿Necesitas hablar con alguien ahora?</strong>
            <span>Líneas y canales institucionales, sin pasos intermedios.</span>
          </span>
          <span className={estilos.irAyuda}>
            Ver canales de ayuda
            <ArrowRight aria-hidden="true" size={18} />
          </span>
        </Link>
      </section>

      {/* ── Cómo funciona ─────────────────────────────── */}
      {/* Pila: «Cómo funciona» se queda fija y la tarjeta de las salas se desliza encima. */}
      <div className={estilos.pila}>
        <div className={`revelar-profundidad ${estilos.pilaCapa}`}>
          <ComoFunciona />
        </div>

        {/* ── Salas vivas ───────────────────────────────── */}
        <section
          className={`${estilos.juegos} ${estilos.entradaJuegos} revelar`}
          aria-labelledby="titulo-salas"
        >
          <div className={estilos.personajeJuegos} aria-hidden="true">
            <Chigui tamano={96} />
          </div>
          <div className={estilos.textoJuegos}>
            <p className={estilos.antetituloSeccion}>
              <Sparkles aria-hidden="true" size={16} />
              Salas de tu comunidad
            </p>
            <TextoRevelado
              as="h2"
              id="titulo-salas"
              efecto="mascara"
              cuando="scroll"
              tramos={['Cada sala es un pequeño mundo para descubrir']}
            />
            <p>
              Entra con tu avatar y toca los objetos de la sala: una pizarra, un tablero de ideas,
              una máquina de café… Cada uno abre una actividad corta, y dos bots te acompañan. Todo
              es opcional y nada se publica.
            </p>
            <ul className={estilos.listaJuegos}>
              {ACTIVIDADES.map((titulo) => (
                <li key={titulo}>{titulo}</li>
              ))}
            </ul>
          </div>
          <Link href="/salas" className={estilos.irJuegos}>
            Explorar las salas
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        </section>
      </div>
    </div>
  );
}
