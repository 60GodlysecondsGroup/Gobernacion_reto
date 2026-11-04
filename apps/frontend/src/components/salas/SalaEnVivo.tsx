'use client';

import { useMemo, useState } from 'react';
import { Avatar } from '@/components/avatar/Avatar';
import { BotonReportar } from '@/components/comunidad/BotonReportar';
import { Boton } from '@/components/ui';
import type { Direccion, MensajeCliente, SalaDetalle } from '@/lib/api/salas';
import { ChatSala } from './ChatSala';
import { ControlesMovimiento } from './controles/ControlesMovimiento';
import { esPasoLibre } from './controles/direcciones';
import { useControlMovimiento } from './controles/useControlMovimiento';
import { useTeclasMovimiento } from './controles/useTeclasMovimiento';
import { Escenario2D, geometriaEscenario } from './Escenario2D';
import { PanelAyudaSala } from './PanelAyudaSala';
import { MundoSala } from './MundoSala';
import { VidaSala } from './VidaSala';
import estilos from './Salas.module.css';
import type { EstadoSalaEnVivo } from './useSalaEnVivo';

/** En la sala en vivo la pared es más alta: ahí están los objetos interactivos. */
const PARED_SALA = 34;

const ID_INSTRUCCIONES = 'instrucciones-movimiento';


const TEXTO_RECHAZO = {
  limite: 'Llegaste al borde de la sala.',
  obstaculo: 'Hay un mueble en esa dirección.',
  destino_invalido: 'No puedes ir a esa casilla: hay un mueble.',
  sin_camino: 'No hay un camino libre hasta esa casilla.',
};

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
  const { escenario, participantes, yo, rechazo } = estado;
  const propio = participantes.find((p) => p.id === yo);

  const ocupadas = useMemo(
    () => new Set(escenario?.obstaculos.map((o) => `${o.x},${o.y}`)),
    [escenario],
  );

  // Teclado, joystick y cruceta terminan en el mismo envío: el servidor decide cada paso.
  const control = useControlMovimiento({
    alPaso: (direccion: Direccion) => {
      setDestino(null);
      enviar({ tipo: 'mover', direccion });
    },
    puedeIr: (direccion) =>
      !escenario || !propio || esPasoLibre({ ...escenario, ocupadas }, propio, direccion),
    // Con una actividad abierta encima de la sala, el avatar no se mueve.
    habilitado: () => !document.querySelector('dialog[open]'),
  });
  useTeclasMovimiento((vector) => control.fijarEntrada('teclado', vector));

  // F40: el clic solo envía la casilla elegida; el servidor decide el camino y cada paso.
  const irA = (celda: { x: number; y: number }) => {
    setDestino({ ...celda, vez: rechazo?.vez ?? 0 });
    enviar({ tipo: 'ir', ...celda });
  };

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
  // El escenario conserva su proporción en cualquier pantalla: el CSS lo ajusta al alto disponible.
  const proporcion = escenario
    ? geometriaEscenario(escenario.ancho, escenario.alto, PARED_SALA).proporcion
    : undefined;

  return (
    <div className={estilos.enVivo}>
      <div className={estilos.columnaEscenario}>
        <div
          className={estilos.escenario}
          style={{ ['--proporcion' as string]: proporcion }}
          tabIndex={0}
          aria-describedby={ID_INSTRUCCIONES}
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
              pared={PARED_SALA}
              ventana={false}
            />
          )}
          {escenario && (
            <MundoSala
              sala={sala.nombre}
              ancho={escenario.ancho}
              alto={escenario.alto}
              obstaculos={escenario.obstaculos}
              pared={PARED_SALA}
              personas={participantes}
            />
          )}
          {escenario && (
            <VidaSala
              ancho={escenario.ancho}
              alto={escenario.alto}
              pared={PARED_SALA}
              participantes={participantes}
              chat={estado.chat}
              llegada={estado.llegada}
            />
          )}
          {/* Región estable: el espacio final alterno hace que se anuncie también un rechazo repetido. */}
          <p className={estilos.rechazo} role="status">
            {rechazo && (
              <span key={rechazo.vez} className={estilos.destello}>
                {TEXTO_RECHAZO[rechazo.motivo]}
                {rechazo.vez % 2 ? '' : ' '}
              </span>
            )}
          </p>
        </div>

        <ControlesMovimiento
          className={estilos.zonaControles}
          control={control}
          idInstrucciones={ID_INSTRUCCIONES}
        />
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
