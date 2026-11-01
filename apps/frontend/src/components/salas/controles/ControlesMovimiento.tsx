'use client';

import { Joystick } from '@/components/ui';
import estilos from './Controles.module.css';
import { Cruceta } from './Cruceta';
import { vectorDeJoystick } from './direcciones';
import type { ControlMovimiento } from './useControlMovimiento';

/**
 * Controles de movimiento en pantalla. Con ratón se ve la cruceta; en pantallas táctiles, el
 * joystick (lo decide el CSS según el tipo de puntero, sin depender de JavaScript). Ambos
 * alimentan el mismo controlador de movimiento que el teclado.
 */
export function ControlesMovimiento({
  control,
  idInstrucciones,
  className,
}: {
  control: ControlMovimiento;
  /** El escenario se describe con estas instrucciones. */
  idInstrucciones: string;
  /** Para ubicar los controles en la distribución de la sala. */
  className?: string;
}) {
  return (
    <div className={[estilos.controles, className].filter(Boolean).join(' ')}>
      <p id={idInstrucciones} className={estilos.instrucciones}>
        <span className={estilos.textoPuntero}>
          Muévete con <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> o con las flechas (dos a
          la vez para ir en diagonal), con estos botones o haciendo clic en una casilla libre.
        </span>
        <span className={estilos.textoTactil}>
          Arrastra el joystick para moverte, también en diagonal, o toca una casilla libre.
        </span>
      </p>
      <div className={estilos.mando}>
        <Cruceta alMover={control.pasoUnico} />
        <Joystick
          className={estilos.joystick}
          etiqueta="Mover tu avatar"
          aria-describedby={idInstrucciones}
          alMover={({ x, y }) => control.fijarEntrada('joystick', vectorDeJoystick(x, y))}
          alSoltar={() => control.fijarEntrada('joystick', null)}
        />
      </div>
    </div>
  );
}
