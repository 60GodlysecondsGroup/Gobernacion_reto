import Link from 'next/link';
import estilos from './PiePagina.module.css';

export function PiePagina() {
  return (
    <footer className={estilos.pie}>
      <div className={`contenedor ${estilos.contenido}`}>
        <p>
          Prototipo de hackathon (TRL 4) con <strong>datos sintéticos</strong>. No es un servicio de
          salud ni un canal oficial de ninguna institución.
        </p>
        <Link href="/guia-de-estilos">Guía de estilos</Link>
      </div>
    </footer>
  );
}
