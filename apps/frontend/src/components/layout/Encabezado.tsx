import Link from 'next/link';
import estilos from './Encabezado.module.css';
import { Logo } from './Logo';
import { Navegacion } from './Navegacion';

export function Encabezado() {
  return (
    <header className={estilos.encabezado}>
      <div className={`contenedor ${estilos.barra}`}>
        <Link href="/" className={estilos.marca}>
          <Logo />
          <span className={estilos.nombre}>Comunidad Protegida</span>
          <span className={estilos.etiqueta}>Prototipo</span>
        </Link>
        <Navegacion />
      </div>
    </header>
  );
}
