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
  const arco = 'M9.5 37V23.5a14.5 14.5 0 0 1 29 0V37';
  const ventanas =
    variante === 'simbolo' && tono === 'claro'
      ? ['#2f9be0', '#f2a623', '#17a97e', '#7c6cf2']
      : ['#8fd3ff', '#ffc857', '#7de3c3', '#c4bdff'];
  const colorArco = variante === 'simbolo' && tono === 'claro' ? '#2a2478' : '#fff';

  return (
    <svg
      width={tamano}
      height={variante === 'simbolo' ? (tamano * 33) / 38 : tamano}
      viewBox={variante === 'simbolo' ? '5 7 38 33' : '0 0 48 48'}
      aria-hidden="true"
      focusable="false"
      className={[estilos.logo, className].filter(Boolean).join(' ')}
    >
      {variante === 'icono' && (
        <>
          <defs>
            <linearGradient id="cp-logo-fondo" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#5b4fe8" />
              <stop offset="1" stopColor="#2a2478" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="13" fill="url(#cp-logo-fondo)" />
        </>
      )}
      <path
        d={arco}
        fill="none"
        stroke={colorArco}
        strokeWidth="4.2"
        strokeLinecap="round"
        className={estilos.arco}
      />
      <g className={estilos.ventanas}>
        <rect x="16.5" y="21" width="6.8" height="6.8" rx="2" fill={ventanas[0]} />
        <rect x="24.7" y="21" width="6.8" height="6.8" rx="2" fill={ventanas[1]} />
        <rect x="16.5" y="29.2" width="6.8" height="6.8" rx="2" fill={ventanas[2]} />
        <rect x="24.7" y="29.2" width="6.8" height="6.8" rx="2" fill={ventanas[3]} />
      </g>
    </svg>
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
