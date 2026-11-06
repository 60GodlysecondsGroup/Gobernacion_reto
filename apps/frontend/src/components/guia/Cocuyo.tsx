import estilos from './Cocuyo.module.css';

/** Expresiones opcionales: sin ellas, Cocuyo se dibuja exactamente igual que siempre. */
export type ExpresionCocuyo = 'feliz' | 'triste' | 'tapado' | 'cerrado';

/**
 * Cocuyo, la guía virtual del proyecto: una luciérnaga del llano en pixel art, dibujada por código
 * (recurso original, RF28). No representa a la Gobernación del Meta ni a ninguna institución.
 * `mira` desplaza los ojos un píxel hacia un lado; `expresion` cambia unos pocos píxeles (sonrisa,
 * lágrima, alas sobre los ojos u ojos cerrados) sin cambiar el personaje.
 */
export function Cocuyo({
  tamano = 40,
  encendido = true,
  mira,
  expresion,
  movimientoEnSitio = false,
}: {
  tamano?: number;
  encendido?: boolean;
  mira?: 'izquierda' | 'derecha';
  expresion?: ExpresionCocuyo;
  movimientoEnSitio?: boolean;
}) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className={estilos.cocuyo}
      data-encendido={encendido || undefined}
      data-movimiento-en-sitio={movimientoEnSitio || undefined}
    >
      {/* Antenas */}
      <rect x="5" y="1" width="1" height="2" fill="#1e2152" />
      <rect x="10" y="1" width="1" height="2" fill="#1e2152" />
      {movimientoEnSitio && (
        <>
          <rect
            x="2"
            y="3"
            width="1"
            height="1"
            fill="#f7c96f"
            className={estilos.destelloIzquierdo}
          />
          <rect
            x="13"
            y="2"
            width="1"
            height="1"
            fill="#f7c96f"
            className={estilos.destelloDerecho}
          />
        </>
      )}
      {/* Cabeza */}
      <rect x="5" y="3" width="6" height="3" fill="#1e2152" />
      <g
        transform={
          mira === 'izquierda'
            ? 'translate(-1 0)'
            : mira === 'derecha'
              ? 'translate(1 0)'
              : undefined
        }
      >
        {expresion === 'cerrado' ? (
          // Ojos cerrados: los párpados, sin el brillo blanco.
          <>
            <rect x="6" y="4" width="1" height="1" fill="#6b6fc4" />
            <rect x="9" y="4" width="1" height="1" fill="#6b6fc4" />
          </>
        ) : (
          <g className={estilos.ojos}>
            <rect x="6" y="4" width="1" height="1" fill="#fff" />
            <rect x="9" y="4" width="1" height="1" fill="#fff" />
          </g>
        )}
      </g>
      {expresion === 'feliz' && <rect x="7" y="5" width="2" height="1" fill="#f4a3b4" />}
      {expresion === 'triste' && <rect x="7" y="5" width="2" height="1" fill="#8a8fd6" />}
      {/* Alas */}
      <g className={`${estilos.ala} ${estilos.alaIzquierda}`}>
        <rect x="1" y="5" width="4" height="4" fill="#c7cbf5" />
        <rect x="2" y="6" width="2" height="2" fill="#e7e8fa" />
      </g>
      <g className={`${estilos.ala} ${estilos.alaDerecha}`}>
        <rect x="11" y="5" width="4" height="4" fill="#c7cbf5" />
        <rect x="12" y="6" width="2" height="2" fill="#e7e8fa" />
      </g>
      {/* Cuerpo */}
      <rect x="5" y="6" width="6" height="4" fill="#3b3fa8" />
      {/* Triste: una lágrima bajo el ojo, sobre el cuerpo. */}
      {expresion === 'triste' && <rect x="6" y="6" width="1" height="1" fill="#9fd3ff" />}
      {/* Tapado: las puntas de las alas suben a cubrir los ojos. */}
      {expresion === 'tapado' && (
        <>
          <rect x="4" y="4" width="3" height="2" fill="#c7cbf5" />
          <rect x="9" y="4" width="3" height="2" fill="#c7cbf5" />
          <rect x="5" y="4" width="1" height="1" fill="#e7e8fa" />
          <rect x="10" y="4" width="1" height="1" fill="#e7e8fa" />
        </>
      )}
      {/* Luz */}
      {encendido && (
        <rect
          x="3"
          y="9"
          width="10"
          height="7"
          fill="#f2a93b"
          opacity="0.25"
          className={estilos.halo}
        />
      )}
      <rect x="5" y="10" width="6" height="4" fill={encendido ? '#f2a93b' : '#8a7a5a'} />
      <rect x="6" y="14" width="4" height="1" fill={encendido ? '#f7c96f' : '#8a7a5a'} />
    </svg>
  );
}
