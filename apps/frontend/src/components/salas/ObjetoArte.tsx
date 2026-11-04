import type { IdObjetoSala } from '@/config/salas-mundo';

/** Objetos interactivos de la sala en pixel art original (cuadrícula de 24×24). */
export function ObjetoArte({ id }: { id: IdObjetoSala }) {
  return (
    <svg viewBox="0 0 24 24" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      {ARTE[id]}
    </svg>
  );
}

const SOMBRA = 'rgb(27 20 60 / 0.18)';

const ARTE: Record<IdObjetoSala, React.ReactNode> = {
  tablero: (
    <>
      <rect x="2" y="3" width="20" height="15" fill="#8a5f38" />
      <rect x="3" y="4" width="18" height="13" fill="#c99a62" />
      <rect x="4" y="5" width="5" height="4" fill="#ffe27a" />
      <rect x="10" y="6" width="5" height="4" fill="#9fe0c8" />
      <rect x="16" y="5" width="4" height="4" fill="#f4a3b4" />
      <rect x="5" y="11" width="5" height="4" fill="#b9a6f8" />
      <rect x="12" y="12" width="5" height="4" fill="#ffe27a" />
      <rect x="9" y="9" width="4" height="1" fill="#c93a2f" />
      <rect x="6" y="5" width="1" height="1" fill="#c93a2f" />
      <rect x="12" y="6" width="1" height="1" fill="#2f6fbf" />
      <rect x="4" y="18" width="2" height="4" fill="#6b4627" />
      <rect x="18" y="18" width="2" height="4" fill="#6b4627" />
      <rect x="3" y="22" width="18" height="1" fill={SOMBRA} />
    </>
  ),
  pizarra: (
    <>
      <rect x="1" y="3" width="22" height="14" fill="#a0703f" />
      <rect x="2" y="4" width="20" height="12" fill="#2f5d4c" />
      <rect x="4" y="6" width="7" height="1" fill="#e8f2ec" />
      <rect x="4" y="8" width="11" height="1" fill="#e8f2ec" opacity="0.8" />
      <rect x="4" y="10" width="9" height="1" fill="#e8f2ec" opacity="0.8" />
      <rect x="4" y="12" width="5" height="1" fill="#ffe27a" />
      <rect x="16" y="9" width="4" height="4" fill="none" stroke="#e8f2ec" strokeWidth="1" />
      <rect x="2" y="16" width="20" height="2" fill="#8a5f38" />
      <rect x="6" y="16" width="3" height="1" fill="#fff" />
      <rect x="4" y="18" width="2" height="4" fill="#6b4627" />
      <rect x="18" y="18" width="2" height="4" fill="#6b4627" />
      <rect x="3" y="22" width="18" height="1" fill={SOMBRA} />
    </>
  ),
  cafe: (
    <>
      <rect x="5" y="3" width="14" height="18" fill="#3a3352" />
      <rect x="5" y="3" width="14" height="2" fill="#544a78" />
      <rect x="7" y="6" width="10" height="4" fill="#9fd6ff" />
      <rect x="8" y="7" width="3" height="1" fill="#fff" />
      <rect x="15" y="7" width="1" height="2" fill="#7de3c3" />
      <rect x="7" y="11" width="10" height="7" fill="#251f38" />
      <rect x="10" y="11" width="4" height="2" fill="#6d6496" />
      <rect x="10" y="14" width="4" height="4" fill="#f6efe2" />
      <rect x="14" y="15" width="1" height="2" fill="#f6efe2" />
      <rect x="10" y="14" width="4" height="1" fill="#7a4a2a" />
      <rect x="11" y="9" width="1" height="1" fill="#fff" opacity="0.6" />
      <rect x="5" y="21" width="14" height="1" fill="#251f38" />
      <rect x="4" y="22" width="16" height="1" fill={SOMBRA} />
    </>
  ),
  encuentro: (
    <>
      <rect x="11" y="9" width="2" height="13" fill="#6b4627" />
      <rect x="3" y="3" width="18" height="8" fill="#7350ea" />
      <rect x="3" y="3" width="18" height="1" fill="#9579f3" />
      <rect x="5" y="5" width="6" height="4" fill="#fff" />
      <rect x="6" y="9" width="1" height="1" fill="#fff" />
      <rect x="13" y="5" width="6" height="4" fill="#ffe27a" />
      <rect x="17" y="9" width="1" height="1" fill="#ffe27a" />
      <rect x="6" y="6" width="4" height="1" fill="#7350ea" />
      <rect x="14" y="6" width="4" height="1" fill="#7a5a10" />
      <rect x="6" y="7" width="3" height="1" fill="#7350ea" />
      <rect x="8" y="21" width="8" height="1" fill={SOMBRA} />
    </>
  ),
  escritorio: (
    <>
      <rect x="17" y="5" width="1" height="7" fill="#544a78" />
      <rect x="15" y="4" width="5" height="2" fill="#ffc857" />
      <rect x="2" y="12" width="20" height="3" fill="#a0703f" />
      <rect x="2" y="12" width="20" height="1" fill="#bb8a55" />
      <rect x="4" y="8" width="7" height="4" fill="#f6efe2" />
      <rect x="5" y="9" width="5" height="1" fill="#9c8fd6" />
      <rect x="5" y="10" width="3" height="1" fill="#9c8fd6" />
      <rect x="12" y="10" width="3" height="2" fill="#7350ea" />
      <rect x="3" y="15" width="2" height="7" fill="#7a5230" />
      <rect x="19" y="15" width="2" height="7" fill="#7a5230" />
      <rect x="14" y="15" width="5" height="5" fill="#8a5f38" />
      <rect x="16" y="17" width="1" height="1" fill="#ffc857" />
      <rect x="2" y="22" width="20" height="1" fill={SOMBRA} />
    </>
  ),
  estanteria: (
    <>
      <rect x="3" y="1" width="18" height="21" fill="#8a5f38" />
      <rect x="4" y="2" width="16" height="6" fill="#5e3f22" />
      <rect x="4" y="9" width="16" height="6" fill="#5e3f22" />
      <rect x="4" y="16" width="16" height="5" fill="#5e3f22" />
      <rect x="5" y="3" width="2" height="5" fill="#d36b4f" />
      <rect x="7" y="4" width="2" height="4" fill="#4f8fbf" />
      <rect x="10" y="3" width="2" height="5" fill="#e3c25a" />
      <rect x="13" y="5" width="4" height="3" fill="#b07cc6" />
      <rect x="5" y="11" width="3" height="4" fill="#6aa86b" />
      <rect x="9" y="10" width="2" height="5" fill="#7350ea" />
      <rect x="12" y="11" width="2" height="4" fill="#f4a3b4" />
      <rect x="15" y="10" width="3" height="5" fill="#4f8fbf" />
      <rect x="6" y="18" width="5" height="3" fill="#ffc857" />
      <rect x="13" y="17" width="3" height="4" fill="#57a565" />
      <rect x="3" y="22" width="18" height="1" fill={SOMBRA} />
    </>
  ),
  // Rincón de juegos: una maquinita con pantalla de noche y una luciérnaga.
  arcade: (
    <>
      <rect x="5" y="2" width="14" height="20" fill="#3b3fa8" />
      <rect x="6" y="3" width="12" height="2" fill="#7c6cf2" />
      <rect x="7" y="6" width="10" height="7" fill="#1d1f52" />
      <rect x="8" y="11" width="8" height="2" fill="#2b6a3f" />
      <rect x="12" y="8" width="2" height="2" fill="#f9ff9e" />
      <rect x="11" y="9" width="1" height="1" fill="rgb(249 255 158 / 0.5)" />
      <rect x="7" y="15" width="10" height="3" fill="#2a2d7a" />
      <rect x="8" y="16" width="2" height="1" fill="#e5534b" />
      <rect x="11" y="16" width="1" height="1" fill="#f2a623" />
      <rect x="13" y="16" width="1" height="1" fill="#17a97e" />
      <rect x="15" y="16" width="1" height="1" fill="#2f9be0" />
      <rect x="6" y="19" width="12" height="2" fill="#2a2d7a" />
      <rect x="4" y="22" width="16" height="1" fill={SOMBRA} />
    </>
  ),
};
