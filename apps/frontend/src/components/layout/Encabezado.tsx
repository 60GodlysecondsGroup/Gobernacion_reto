import Link from 'next/link';
import estilos from './Encabezado.module.css';
import { MarcaCompleta } from './Logo';
import { Navegacion } from './Navegacion';

export function Encabezado() {
  return (
    <header className={estilos.encabezado}>
      <div className={`contenedor ${estilos.barra}`}>
        <Link href="/" className={estilos.marca} aria-label="Comunidad Protegida, inicio">
          <MarcaCompleta tamano={38} subtitulo="Prototipo · datos sintéticos" compactaEnMovil />
        </Link>
        <Navegacion />
      </div>
    </header>
  );
}
