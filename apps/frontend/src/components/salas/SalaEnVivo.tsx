'use client';

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type KeyboardEvent as EventoTeclado,
} from 'react';
import { Avatar } from '@/components/avatar/Avatar';
import { BotonReportar } from '@/components/comunidad/BotonReportar';
import { Boton } from '@/components/ui';
import type { Direccion, MensajeCliente, SalaDetalle } from '@/lib/api/salas';
import { ChatSala } from './ChatSala';
import { Escenario2D } from './Escenario2D';
import { PanelAyudaSala } from './PanelAyudaSala';
import estilos from './Salas.module.css';
import type { EstadoSalaEnVivo } from './useSalaEnVivo';

const TECLAS: Record<string, Direccion> = { w: 'arriba', a: 'izquierda', s: 'abajo', d: 'derecha' };
const FLECHAS: Record<string, Direccion> = {
  ArrowUp: 'arriba',
  ArrowLeft: 'izquierda',
  ArrowDown: 'abajo',
  ArrowRight: 'derecha',
};

/** Mínimo entre dos movimientos enviados (el servidor también limita). */
const INTERVALO_MOVIMIENTO_MS = 110;

const TEXTO_RECHAZO = {
  limite: 'Llegaste al borde de la sala.',
  obstaculo: 'Hay un mueble en esa dirección.',
  destino_invalido: 'No puedes ir a esa casilla: hay un mueble.',
  sin_camino: 'No hay un camino libre hasta esa casilla.',
};

/** Mientras se escribe o se usa un control de formulario, las teclas no mueven el avatar. */
function esControlEditable(destino: EventTarget | null) {
  if (!(destino instanceof HTMLElement)) return false;
  return (
    destino.isContentEditable ||
    destino.closest('input, textarea, select, [contenteditable="true"]') !== null
  );
}

export function SalaEnVivo({
  sala,
  estado,
  enviar,
  salir,
  limpiarAvisosChat,
}: {
  sala: SalaDetalle;
  estado: EstadoSalaEnVivo;
  enviar: (mensaje: MensajeCliente) => void;
  salir: () => void;
  limpiarAvisosChat: () => void;
}) {
  const [ayudaAbierta, setAyudaAbierta] = useState(false);
  // Casilla elegida con un clic y el número del último rechazo en ese momento: si llega un
  // rechazo nuevo, el destino deja de mostrarse.
  const [destino, setDestino] = useState<{ x: number; y: number; vez: number } | null>(null);
  const ultimoMovimiento = useRef(0);
  const { escenario, participantes, yo, rechazo } = estado;

  const mover = (direccion: Direccion) => {
    const ahora = performance.now();
    if (ahora - ultimoMovimiento.current < INTERVALO_MOVIMIENTO_MS) return;
    ultimoMovimiento.current = ahora;
    setDestino(null);
    enviar({ tipo: 'mover', direccion });
  };

  // F40: el clic solo envía la casilla elegida; el servidor decide el camino y cada paso.
  const irA = (celda: { x: number; y: number }) => {
    setDestino({ ...celda, vez: rechazo?.vez ?? 0 });
    enviar({ tipo: 'ir', ...celda });
  };
  const alPulsarTecla = useEffectEvent((evento: KeyboardEvent) => {
    if (evento.ctrlKey || evento.metaKey || evento.altKey) return;
    if (esControlEditable(evento.target)) return;
    const direccion = TECLAS[evento.key.toLowerCase()];
    if (!direccion) return;
    evento.preventDefault();
    mover(direccion);
  });

  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => alPulsarTecla(evento);
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, []);

  // Las flechas solo mueven con el foco en el escenario, para no impedir el desplazamiento de la página.
  const alPulsarEnEscenario = (evento: EventoTeclado<HTMLDivElement>) => {
    const direccion = FLECHAS[evento.key];
    if (!direccion || evento.ctrlKey || evento.metaKey || evento.altKey) return;
    evento.preventDefault();
    mover(direccion);
  };

  const propio = participantes.find((p) => p.id === yo);
  const destinoVigente =
    destino &&
    destino.vez === (rechazo?.vez ?? 0) &&
    !(propio && propio.x === destino.x && propio.y === destino.y)
      ? destino
      : null;
  const ocupacion = `${estado.ocupacion}/${estado.capacidad}`;
  const descripcion = propio
    ? `Escenario de la sala ${sala.nombre}, ${ocupacion} personas. Tu avatar está en la columna ${propio.x + 1} y la fila ${propio.y + 1}.`
    : `Escenario de la sala ${sala.nombre}.`;

  return (
    <div className={estilos.enVivo}>
      <div className={estilos.columnaEscenario}>
        <div
          className={estilos.escenario}
          tabIndex={0}
          onKeyDown={alPulsarEnEscenario}
          aria-describedby="instrucciones-movimiento"
        >
          {escenario && (
            <Escenario2D
              tema={sala.nombre}
              ancho={escenario.ancho}
              alto={escenario.alto}
              obstaculos={escenario.obstaculos}
              participantes={participantes}
              yo={yo}
              descripcion={descripcion}
              destino={destinoVigente}
              onElegirCelda={irA}
            />
          )}
        </div>

        <div className={estilos.controles}>
          <p id="instrucciones-movimiento" className={estilos.instrucciones}>
            Muévete con las teclas <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>, con las
            flechas si el escenario tiene el foco, con estos botones o haciendo clic en una casilla
            libre.
          </p>
          <div className={estilos.cruceta} role="group" aria-label="Mover tu avatar">
            <Boton
              variante="secundario"
              tamano="sm"
              className={estilos.arriba}
              onClick={() => mover('arriba')}
            >
              <span aria-hidden="true">▲</span>
              <span className="visualmente-oculto">Mover arriba</span>
            </Boton>
            <Boton
              variante="secundario"
              tamano="sm"
              className={estilos.izquierda}
              onClick={() => mover('izquierda')}
            >
              <span aria-hidden="true">◀</span>
              <span className="visualmente-oculto">Mover a la izquierda</span>
            </Boton>
            <Boton
              variante="secundario"
              tamano="sm"
              className={estilos.abajo}
              onClick={() => mover('abajo')}
            >
              <span aria-hidden="true">▼</span>
              <span className="visualmente-oculto">Mover abajo</span>
            </Boton>
            <Boton
              variante="secundario"
              tamano="sm"
              className={estilos.derecha}
              onClick={() => mover('derecha')}
            >
              <span aria-hidden="true">▶</span>
              <span className="visualmente-oculto">Mover a la derecha</span>
            </Boton>
          </div>
          {/* Región estable: el espacio final alterno hace que se anuncie también un rechazo repetido. */}
          <p className={estilos.rechazo} role="status">
            {rechazo && (
              <span key={rechazo.vez} className={estilos.destello}>
                {TEXTO_RECHAZO[rechazo.motivo]}
                {rechazo.vez % 2 ? '' : '\u00a0'}
              </span>
            )}
          </p>
        </div>
      </div>

      <aside className={estilos.columnaLateral} aria-label="Personas, acciones y chat">
        <section className={estilos.panel} aria-labelledby="titulo-personas">
          <h2 id="titulo-personas" className={estilos.tituloPanel}>
            Personas en la sala <span className={estilos.ocupacion}>{ocupacion}</span>
          </h2>
          <ul className={estilos.personas}>
            {participantes.map((p) => (
              <li key={p.id} className={estilos.persona}>
                <Avatar apariencia={p.avatar} tamano={20} />
                <span>{p.id === yo ? `${p.alias} (tú)` : p.alias}</span>
              </li>
            ))}
          </ul>
          <div className={estilos.accionesSala}>
            <Boton variante="secundario" tamano="sm" onClick={salir}>
              Salir de la sala
            </Boton>
            <Boton
              variante="ayuda"
              tamano="sm"
              aria-expanded={ayudaAbierta}
              onClick={() => setAyudaAbierta((abierta) => !abierta)}
            >
              Necesito ayuda
            </Boton>
            <BotonReportar tipoContenido="sala" idContenido={sala.id} />
          </div>
          {ayudaAbierta && <PanelAyudaSala />}
        </section>

        <ChatSala
          chat={estado.chat}
          yo={yo}
          bloqueo={estado.bloqueo}
          error={estado.errorChat}
          publicados={estado.publicados}
          alEnviar={(texto) => enviar({ tipo: 'mensaje', texto })}
          alEditar={limpiarAvisosChat}
        />
      </aside>
    </div>
  );
}
