import estilos from './Logo.module.css';

/**
 * Marca «Refugio» (recurso original, RF28). Un arco que abraza cuatro ventanas: el arco es la
 * protección y cada ventana, con su propia luz, una de las cuatro comunidades por edad.
 * Los archivos de marca están en `public/marca/` (icono, símbolo, horizontal y negativos).
 *
 * - `icono`: el arco blanco sobre la loseta índigo. Funciona sobre fondos claros y oscuros.
 * Todas las copias comparten el mismo degradado (`cp-logo-fondo`), idéntico, así que repetir el id
 * en la página no cambia el resultado.
 * - `simbolo`: solo el arco y las ventanas, en color (`tono="claro"`) o en blanco (`tono="oscuro"`).
 */
export function Logo({
  tamano = 36,
  variante = 'icono',
  tono = 'claro',
  className,
}: {
  tamano?: number;
  variante?: 'icono' | 'simbolo';
  /** Fondo sobre el que se dibuja el símbolo. */
  tono?: 'claro' | 'oscuro';
  className?: string;
}) {
  // Logo oficial (PNG 359×369): se respeta su proporción con height derivado del ancho.
  const alto = (tamano * 369) / 359;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/marca/comunidad_protegida_logo.png"
      alt=""
      aria-hidden="true"
      width={tamano}
      height={alto}
      style={{ width: tamano, height: 'auto', objectFit: 'contain' }}
      className={[estilos.logo, className].filter(Boolean).join(' ')}
    />
  );
}

/** Logotipo completo: icono + nombre del producto (texto real, legible por lectores de pantalla). */
export function MarcaCompleta({
  tamano = 38,
  tono = 'claro',
  subtitulo,
  compactaEnMovil = false,
}: {
  tamano?: number;
  tono?: 'claro' | 'oscuro';
  subtitulo?: string;
  /** En pantallas muy estrechas deja solo el icono (el nombre sigue en el `aria-label` del enlace). */
  compactaEnMovil?: boolean;
}) {
  const clases = [
    estilos.marca,
    tono === 'oscuro' && estilos.oscuro,
    compactaEnMovil && estilos.compacta,
  ];
  return (
    <span className={clases.filter(Boolean).join(' ')}>
      <Logo tamano={tamano} />
      <span className={estilos.textos}>
        <span className={estilos.nombre}>Comunidad Protegida</span>
        {subtitulo && <span className={estilos.subtitulo}>{subtitulo}</span>}
      </span>
    </span>
  );
}
