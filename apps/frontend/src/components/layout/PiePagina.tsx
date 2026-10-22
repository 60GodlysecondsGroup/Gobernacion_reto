import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { AVISO_LIMITES } from '@/config/textos';
import { MarcaCompleta } from './Logo';
import estilos from './PiePagina.module.css';

const COLUMNAS = [
  {
    titulo: 'Orientación',
    enlaces: [
      { href: '/orientacion', texto: 'Buscar información' },
      { href: '/ayuda', texto: 'Necesito ayuda' },
    ],
  },
  {
    titulo: 'Comunidad',
    enlaces: [
      { href: '/reglas', texto: 'Reglas de la comunidad' },
      { href: '/guia', texto: 'Cómo funciona' },
    ],
  },
  {
    titulo: 'Proyecto',
    enlaces: [{ href: '/guia-de-estilos', texto: 'Guía de estilos' }],
  },
];

export function PiePagina() {
  return (
    <footer className={estilos.pie}>
      <div className={estilos.ventanas} aria-hidden="true" />
      <div className={`contenedor ${estilos.contenido}`}>
        <div className={estilos.marca}>
          <MarcaCompleta
            tamano={44}
            tono="oscuro"
            subtitulo="Orientación y comunidad para jóvenes"
          />
          <section className={estilos.limites} aria-labelledby="pie-limites">
            <h2 id="pie-limites" className={estilos.tituloLimites}>
              <ShieldCheck aria-hidden="true" size={18} />
              Lo que esta plataforma no hace
            </h2>
            <p>{AVISO_LIMITES}</p>
          </section>
        </div>
        <nav aria-label="Información de la plataforma" className={estilos.columnas}>
          {COLUMNAS.map((columna) => (
            <div key={columna.titulo}>
              <h2 className={estilos.tituloColumna}>{columna.titulo}</h2>
              <ul>
                {columna.enlaces.map((enlace) => (
                  <li key={enlace.href}>
                    <Link href={enlace.href}>{enlace.texto}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className={`contenedor ${estilos.legal}`}>
        <p>
          Prototipo de hackathon (TRL 4) con datos sintéticos. No es un canal oficial de ninguna
          institución ni de la Gobernación del Meta.
        </p>
      </div>
    </footer>
  );
}
