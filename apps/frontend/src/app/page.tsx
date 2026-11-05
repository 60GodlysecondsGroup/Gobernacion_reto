import { ArrowRight, LifeBuoy, ShieldCheck, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Chigui } from '@/components/guia/Chigui';
import { AtajosOrientacion } from '@/components/inicio/AtajosOrientacion';
import { CabeceraOrientacion } from '@/components/inicio/CabeceraOrientacion';
import { ComoFunciona } from '@/components/inicio/ComoFunciona';
import { SeccionOrientacion } from '@/components/inicio/SeccionOrientacion';
import { MensajesGarantia } from '@/components/inicio/MensajesGarantia';
import { TextoLuminosa } from '@/components/inicio/TextoLuminosa';
import { TituloHeroe } from '@/components/inicio/TituloHeroe';
import { ValleComunidades } from '@/components/inicio/ValleComunidades';
import { Inclinable } from '@/components/movimiento/Inclinable';
import { Magnetico } from '@/components/movimiento/Magnetico';
import { Paralaje } from '@/components/movimiento/Paralaje';
import FoldText from '@/components/react-bits/FoldText';
import { AccionesInicio } from '@/components/sesion/AccionesInicio';
import { OBJETOS_SALA } from '@/config/salas-mundo';
import estilos from './page.module.css';

const ACTIVIDADES = OBJETOS_SALA.map((o) => o.titulo);

export default function Inicio() {
  return (
    <div className={estilos.pagina}>
      {/* ── Héroe ─────────────────────────────────────── */}
      <section className={estilos.heroe} aria-labelledby="titulo-inicio">
        <div className={estilos.textoHeroe}>
          <TituloHeroe />
          <TextoLuminosa
            className={estilos.entradilla}
            texto="Una comunidad digital para jóvenes de 10 a 22 años, donde puedes encontrar orientación, participar de forma segura y compartir experiencias."
          />
          <div className={estilos.acciones}>
            <Magnetico fuerza={0.12} className={estilos.magnetico}>
              <AccionesInicio />
            </Magnetico>
          </div>
          <MensajesGarantia className={estilos.garantias} />
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
      <SeccionOrientacion className={estilos.seccion} aria-labelledby="titulo-orientacion">
        <CabeceraOrientacion
          className={estilos.cabeceraSeccion}
          antetituloClassName={estilos.antetituloSeccion}
        />
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
      </SeccionOrientacion>

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
            {/* FoldText (React Bits): las letras se despliegan como papel al llegar a la sección.
                Hereda el tamaño, el peso, el interlineado y el color del título. */}
            <h2 id="titulo-salas">
              <FoldText
                text="Cada sala es un pequeño mundo para descubrir"
                foldStyle="paper"
                splitBy="char"
                hinge="top"
                trigger="scroll"
                foldAngle={92}
                duration={0.65}
                stagger={0.03}
                staggerFrom="start"
                ease="power3.out"
                hoverRefold
                refoldRadius={140}
                refoldAngle={45}
                perspective={700}
                creaseShading={0.55}
                fontSize="inherit"
                fontWeight="inherit"
                style={{ lineHeight: 'inherit', letterSpacing: 'inherit' }}
              />
            </h2>
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
