import { BookOpen, Compass, Home, LifeBuoy, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { BotonEnlace } from '@/components/ui';
import estilos from './PaginaNoEncontrada.module.css';
import { VolverAtras } from './VolverAtras';

/** Secciones públicas: sirven con o sin sesión y no dependen del rol. */
const SUGERENCIAS: { href: string; etiqueta: string; icono: LucideIcon; ayuda?: boolean }[] = [
  { href: '/orientacion', etiqueta: 'Orientación', icono: Compass },
  { href: '/guia', etiqueta: 'Cómo funciona', icono: BookOpen },
  { href: '/ayuda', etiqueta: 'Necesito ayuda', icono: LifeBuoy, ayuda: true },
];

/**
 * Página 404: dice qué pasó sin tecnicismos (ni la ruta pedida ni detalles del sistema) y ofrece
 * caminos de salida para no dejar a la persona en un callejón sin salida.
 */
export function PaginaNoEncontrada() {
  return (
    <section className={estilos.pagina} aria-labelledby="titulo-no-encontrada">
      <div className={estilos.tarjeta}>
        <p className={estilos.antetitulo}>Error 404</p>
        <p className={estilos.codigo} aria-hidden="true">
          404
        </p>
        <h1 id="titulo-no-encontrada" className={estilos.titulo}>
          Página no encontrada
        </h1>
        <p className={estilos.texto}>
          La página que intentas visitar no existe o ya no está disponible. Puede que el enlace esté
          incompleto o que la dirección tenga un error.
        </p>

        <div className={estilos.acciones}>
          <BotonEnlace href="/" tamano="lg">
            <Home aria-hidden="true" size={18} />
            Ir al inicio
          </BotonEnlace>
          <VolverAtras />
        </div>

        <nav className={estilos.sugerencias} aria-labelledby="titulo-sugerencias">
          <h2 id="titulo-sugerencias" className={estilos.sugerenciasTitulo}>
            También puedes ir a
          </h2>
          <ul className={estilos.listaSugerencias}>
            {SUGERENCIAS.map(({ href, etiqueta, icono: Icono, ayuda }) => (
              <li key={href}>
                <Link href={href} className={estilos.sugerencia}>
                  <span
                    className={`${estilos.iconoSugerencia} ${ayuda ? estilos.iconoAyuda : ''}`}
                    aria-hidden="true"
                  >
                    <Icono size={18} />
                  </span>
                  {etiqueta}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}
