import { Boton } from '@/components/ui';
import type { Direccion } from '@/lib/api/salas';
import estilos from './Controles.module.css';

const BOTONES: { direccion: Direccion; flecha: string; texto: string }[] = [
  { direccion: 'arriba', flecha: '▲', texto: 'Mover arriba' },
  { direccion: 'izquierda', flecha: '◀', texto: 'Mover a la izquierda' },
  { direccion: 'abajo', flecha: '▼', texto: 'Mover abajo' },
  { direccion: 'derecha', flecha: '▶', texto: 'Mover a la derecha' },
];

/** Cruceta: un paso por pulsación. Es el control en pantalla con ratón; en táctil, el joystick. */
export function Cruceta({ alMover }: { alMover: (direccion: Direccion) => void }) {
  return (
    <div className={estilos.cruceta} role="group" aria-label="Mover tu avatar">
      {BOTONES.map(({ direccion, flecha, texto }) => (
        <Boton
          key={direccion}
          variante="secundario"
          tamano="sm"
          className={estilos[direccion]}
          onClick={() => alMover(direccion)}
        >
          <span aria-hidden="true">{flecha}</span>
          <span className="visualmente-oculto">{texto}</span>
        </Boton>
      ))}
    </div>
  );
}
