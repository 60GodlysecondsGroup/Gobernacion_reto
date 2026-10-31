import { ArrowRight, Check, LifeBuoy, ShieldCheck, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';
import { Chigui } from '@/components/guia/Chigui';
import { AtajosOrientacion } from '@/components/inicio/AtajosOrientacion';
import { ComoFunciona } from '@/components/inicio/ComoFunciona';
import { EdificioLlanero } from '@/components/inicio/EdificioLlanero';
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
          <h1 id="titulo-inicio" className={estilos.titulo}>
            Un espacio para <span className={estilos.resalte}>crecer, conectar y compartir</span> en
            Villavicencio
          </h1>
          <p className={estilos.entradilla}>
            Una comunidad digital para jóvenes de 10 a 22 años, donde puedes encontrar orientación,
            participar de forma segura y compartir experiencias.
          </p>
          <div className={estilos.acciones}>
            <AccionesInicio />
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

        <div className={estilos.visual}>
          <div className={estilos.ilustracion}>
            <EdificioLlanero />
          </div>
          <p className={`${estilos.chip} ${estilos.chipA}`} aria-hidden="true">
            <Users size={15} />4 comunidades separadas
          </p>
          <p className={`${estilos.chip} ${estilos.chipB}`} aria-hidden="true">
            <ShieldCheck size={15} />
            Filtro de privacidad activo
          </p>
        </div>
      </section>

      {/* ── Orientación ───────────────────────────────── */}
      <section className={`${estilos.seccion} revelar`} aria-labelledby="titulo-orientacion">
        <div className={estilos.cabeceraSeccion}>
          <p className={estilos.antetituloSeccion}>Orientación</p>
          <h2 id="titulo-orientacion">¿Qué información buscas hoy?</h2>
          <p>
            No necesitas iniciar sesión. Aquí no hay preguntas sobre ti ni resultados: solo
            información de instituciones.
          </p>
        </div>
        <AtajosOrientacion />
        <Link href="/ayuda" className={estilos.ayuda}>
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
      <div className="revelar">
        <ComoFunciona />
      </div>

      {/* ── Salas vivas ───────────────────────────────── */}
      <section className={`${estilos.juegos} revelar`} aria-labelledby="titulo-salas">
        <div className={estilos.personajeJuegos} aria-hidden="true">
          <Chigui tamano={96} />
        </div>
        <div className={estilos.textoJuegos}>
          <p className={estilos.antetituloSeccion}>
            <Sparkles aria-hidden="true" size={16} />
            Salas de tu comunidad
          </p>
          <h2 id="titulo-salas">Cada sala es un pequeño mundo para descubrir</h2>
          <p>
            Entra con tu avatar y toca los objetos de la sala: una pizarra, un tablero de ideas, una
            máquina de café… Cada uno abre una actividad corta, y dos bots te acompañan. Todo es
            opcional y nada se publica.
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
  );
}
