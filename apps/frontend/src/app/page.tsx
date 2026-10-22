import { ArrowRight, EyeOff, Layers, LifeBuoy, ShieldCheck, UserRoundCheck } from 'lucide-react';
import Link from 'next/link';
import { BordeBrillante } from '@/components/efectos/BordeBrillante';
import { FondoAurora } from '@/components/efectos/FondoAurora';
import { AtajosOrientacion } from '@/components/inicio/AtajosOrientacion';
import { EdificioLlanero } from '@/components/inicio/EdificioLlanero';
import { AccionesInicio } from '@/components/sesion/AccionesInicio';
import { EstadoSistema } from '@/components/sistema/EstadoSistema';
import estilos from './page.module.css';

const CAPAS = [
  {
    icono: Layers,
    titulo: 'Cada edad en su propio piso',
    texto:
      'Cuatro comunidades separadas: de 10 a 12, de 13 a 15, de 16 a 17 y de 18 a 22 años. Nadie ve ni busca a personas de otro rango.',
  },
  {
    icono: EyeOff,
    titulo: 'Lo personal no se publica',
    texto:
      'Un filtro revisa cada mensaje antes de publicarlo. Teléfonos, direcciones, redes sociales o la edad exacta se bloquean y puedes corregir el texto.',
  },
  {
    icono: UserRoundCheck,
    titulo: 'Personas que revisan',
    texto:
      'Si algo te incomoda, repórtalo. Moderación lo revisa y puede ocultar el contenido, sin contarle a nadie quién reportó.',
  },
];

const GARANTIAS = [
  'Sin datos personales públicos',
  'Fuentes con fecha de verificación',
  'Gratis y sin anuncios',
];

export default function Inicio() {
  return (
    <div className={estilos.pagina}>
      <section className={estilos.heroe} aria-labelledby="titulo-inicio">
        <div className={estilos.textoHeroe}>
          <p className={estilos.etiquetaHeroe}>
            <span className={estilos.puntos} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
            Jóvenes de 10 a 22 años · Villavicencio
          </p>
          <h1 id="titulo-inicio" className={estilos.titulo}>
            Información confiable y <span className="resaltado">un lugar seguro</span> para hablar
            con gente de tu edad
          </h1>
          <p className={estilos.entradilla}>
            Encuentra canales de apoyo de instituciones, siempre con su fuente y la fecha en que se
            verificaron. Y conversa en una comunidad protegida, con alias y avatar.
          </p>
          <div className={estilos.acciones}>
            <AccionesInicio />
          </div>
          <ul className={estilos.garantias}>
            {GARANTIAS.map((texto) => (
              <li key={texto}>
                <ShieldCheck aria-hidden="true" size={16} />
                {texto}
              </li>
            ))}
          </ul>
        </div>
        <BordeBrillante className={estilos.marcoEdificio}>
          <div className={estilos.tarjetaEdificio}>
            <EdificioLlanero />
          </div>
        </BordeBrillante>
      </section>

      <section className={estilos.seccion} aria-labelledby="titulo-orientacion">
        <div className={estilos.cabeceraSeccion}>
          <p className={estilos.antetitulo}>Orientación</p>
          <h2 id="titulo-orientacion">¿Qué información buscas hoy?</h2>
          <p>
            No necesitas iniciar sesión. Aquí no hay preguntas sobre ti ni resultados: solo
            información de instituciones.
          </p>
        </div>
        <div className={estilos.orientacion}>
          <AtajosOrientacion />
          <Link href="/ayuda" className={estilos.tarjetaAyuda}>
            <span className={estilos.iconoAyuda} aria-hidden="true">
              <LifeBuoy size={26} />
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
        </div>
      </section>

      <FondoAurora className={estilos.cuidado}>
        <section aria-labelledby="titulo-capas" className={estilos.interiorCuidado}>
          <div className={estilos.cabeceraSeccion}>
            <p className={`${estilos.antetitulo} ${estilos.antetituloClaro}`}>Protección</p>
            <h2 id="titulo-capas">Cómo te cuidamos</h2>
            <p>
              Tres capas que trabajan juntas, todas aplicadas por el sistema y no solo en pantalla.
            </p>
          </div>
          <ol className={estilos.capas}>
            {CAPAS.map(({ icono: Icono, titulo, texto }, i) => (
              <li key={titulo} className={estilos.capa}>
                <span className={estilos.numeroCapa} aria-hidden="true">
                  0{i + 1}
                </span>
                <span className={estilos.iconoCapa} aria-hidden="true">
                  <Icono size={24} strokeWidth={1.9} />
                </span>
                <h3>{titulo}</h3>
                <p>{texto}</p>
              </li>
            ))}
          </ol>
          <Link href="/reglas" className={estilos.enlaceClaro}>
            Leer las reglas de la comunidad
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        </section>
      </FondoAurora>

      <section className={estilos.seccionEstado} aria-label="Estado del prototipo">
        <EstadoSistema />
      </section>
    </div>
  );
}
