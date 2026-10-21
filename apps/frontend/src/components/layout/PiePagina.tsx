import Link from 'next/link';
import { AVISO_LIMITES } from '@/config/textos';
import estilos from './PiePagina.module.css';

export function PiePagina() {
  return (
    <footer className={estilos.pie}>
      <div className={`contenedor ${estilos.contenido}`}>
        <div className={estilos.textos}>
          <p>
            <strong>Límites de la plataforma.</strong> {AVISO_LIMITES}
          </p>
          <p>
            Prototipo de hackathon (TRL 4) con <strong>datos sintéticos</strong>. No es un canal
            oficial de ninguna institución.
          </p>
        </div>
        <div className={estilos.enlaces}>
          <Link href="/reglas">Reglas de la comunidad</Link>
          <Link href="/guia-de-estilos">Guía de estilos</Link>
        </div>
      </div>
    </footer>
  );
}
