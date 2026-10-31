/**
 * Chigüi, guía de convivencia: un chigüiro (capibara) del llano en pixel art, dibujado por código
 * (recurso original). Es un personaje ilustrado, no una persona ni una institución.
 */
export function Chigui({ tamano = 40 }: { tamano?: number }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {/* Orejas */}
      <rect x="9" y="2" width="2" height="2" fill="#6b3f22" />
      <rect x="13" y="3" width="1" height="1" fill="#6b3f22" />
      {/* Cabeza */}
      <rect x="8" y="3" width="6" height="5" fill="#a86b3c" />
      <rect x="13" y="5" width="2" height="3" fill="#a86b3c" />
      <rect x="14" y="6" width="1" height="1" fill="#3a2414" />
      <rect x="11" y="4" width="1" height="1" fill="#1a0f45" />
      {/* Mejilla */}
      <rect x="12" y="6" width="1" height="1" fill="#e89a8a" />
      {/* Cuerpo */}
      <rect x="2" y="6" width="10" height="6" fill="#a86b3c" />
      <rect x="1" y="7" width="2" height="4" fill="#a86b3c" />
      <rect x="3" y="6" width="7" height="1" fill="#c48552" />
      {/* Pañoleta morada de la plataforma */}
      <rect x="8" y="8" width="4" height="2" fill="#7350ea" />
      <rect x="9" y="10" width="2" height="1" fill="#5b35d5" />
      {/* Patas */}
      <rect x="3" y="12" width="2" height="2" fill="#6b3f22" />
      <rect x="9" y="12" width="2" height="2" fill="#6b3f22" />
      {/* Sombra */}
      <rect x="2" y="14" width="11" height="1" fill="#1a0f45" opacity="0.2" />
    </svg>
  );
}
