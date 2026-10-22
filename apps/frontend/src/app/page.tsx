import { ArrowRight, Check, EyeOff, Layers, LifeBuoy, UserRoundCheck } from 'lucide-react';
import Link from 'next/link';
import { Aparecer } from '@/components/movimiento/Aparecer';
import { ElementoEscalonado, ListaEscalonada } from '@/components/movimiento/Escalonado';
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
  'Participas con alias, sin datos personales',
  'Cada fuente indica cuándo se verificó',
  'Gratis y sin anuncios',
];

export default function Inicio() {
  return (
    <div className={estilos.pagina}>
      <section className={estilos.heroe} aria-labelledby="titulo-inicio">
        <div className={estilos.textoHeroe}>
          <p className={estilos.antetitulo}>Para jóvenes de 10 a 22 años en Villavicencio</p>
          <h1 id="titulo-inicio" className={estilos.titulo}>
            Información confiable y un lugar seguro para hablar con gente de tu edad
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
                <Check aria-hidden="true" size={16} strokeWidth={2.5} />
                {texto}
              </li>
            ))}
          </ul>
        </div>
        <div className={estilos.ilustracion}>
          <EdificioLlanero />
        </div>
      </section>

      <Aparecer>
        <section className={estilos.seccion} aria-labelledby="titulo-orientacion">
          <div className={estilos.cabeceraSeccion}>
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
      </Aparecer>

      <Aparecer>
        <section className={`${estilos.seccion} ${estilos.cuidado}`} aria-labelledby="titulo-capas">
          <div className={estilos.cabeceraSeccion}>
            <h2 id="titulo-capas">Cómo te cuidamos</h2>
            <p>
              Tres capas que trabajan juntas. El sistema las aplica siempre, no solo la pantalla.
            </p>
          </div>
          <ListaEscalonada al="scroll" className={estilos.capas}>
            {CAPAS.map(({ icono: Icono, titulo, texto }) => (
              <ElementoEscalonado key={titulo} className={estilos.capa}>
                <Icono
                  aria-hidden="true"
                  size={24}
                  strokeWidth={1.75}
                  className={estilos.iconoCapa}
                />
                <h3>{titulo}</h3>
                <p>{texto}</p>
              </ElementoEscalonado>
            ))}
          </ListaEscalonada>
          <Link href="/reglas" className={estilos.enlace}>
            Leer las reglas de la comunidad
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </section>
      </Aparecer>

      <details className={estilos.estado}>
        <summary>Estado del prototipo</summary>
        <div className={estilos.cuerpoEstado}>
          <EstadoSistema />
        </div>
      </details>
    </div>
  );
}
