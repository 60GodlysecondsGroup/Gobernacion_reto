'use client';

import { Blocks, Check, Layers, ScanSearch, Signpost, X, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PersonajeAcompanante } from '@/components/guia/MensajeContextual';
import { Minijuego } from '@/components/juegos/Minijuego';
import { ModalFicha } from '@/components/orientacion/ModalFicha';
import { ACOMPANANTES } from '@/config/acompanantes';
import { ACTIVIDADES_SALA, JUEGOS, type IdActividad } from '@/config/juegos';
import { MENSAJES_SALA, mundoDeSala } from '@/config/salas-mundo';
import estilos from './Rincon.module.css';
import { RetosRapidos } from './RetosRapidos';

const OBJETOS: Record<IdActividad, { icono: LucideIcon; nombre: string }> = {
  'que-harias': { icono: Signpost, nombre: 'Cruce de caminos' },
  'detecta-el-riesgo': { icono: ScanSearch, nombre: 'Lupa del riesgo' },
  'comunidad-segura': { icono: Blocks, nombre: 'Mesa de construcción' },
  'retos-rapidos': { icono: Layers, nombre: 'Baraja de retos' },
};

const ESPERA_BIENVENIDA_MS = 900;
const DURACION_MENSAJE_MS = 14000;

type Mensaje = { texto: string; detalle?: string; tono: 'saludo' | 'presenta' | 'logro' | 'consejo' };

/**
 * Rincón de actividades de una sala: el personaje de la sala y sus objetos interactivos. Cada
 * objeto abre una actividad en un panel encima de la sala, que sigue abierta detrás (no se pierde
 * la conexión ni el chat). Los resultados no se guardan ni se comparten.
 */
export function RinconActividades({ sala }: { sala: string }) {
  const mundo = mundoDeSala(sala);
  const guia = ACOMPANANTES[mundo.personaje];
  const [activa, setActiva] = useState<IdActividad | null>(null);
  const [completadas, setCompletadas] = useState<IdActividad[]>([]);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const [reaccion, setReaccion] = useState(0);
  const [consejo, setConsejo] = useState(0);
  // Si la persona cierra el globo, el personaje solo vuelve a hablar cuando ella lo pide o termina
  // una actividad: no interrumpe.
  const silenciado = useRef(false);
  const enUso = useRef(false);
  const temporizadores = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ultimoResultado = useRef<{ aciertos: number; total: number } | null>(null);
  // Al cerrar una actividad el foco vuelve a su objeto: eso no debe tapar la reacción del personaje.
  const ignorarFoco = useRef(false);
  const temporizadorFoco = useRef<ReturnType<typeof setTimeout>>(undefined);

  const programar = (fn: () => void, ms: number) => {
    temporizadores.current.push(setTimeout(fn, ms));
  };
  const limpiar = () => {
    temporizadores.current.forEach(clearTimeout);
    temporizadores.current = [];
  };

  const decir = (nuevo: Mensaje, { reaccionar = false } = {}) => {
    limpiar();
    setMensaje(nuevo);
    if (reaccionar) setReaccion((n) => n + 1);
    const ocultar = () => {
      if (enUso.current) programar(ocultar, 3000);
      else setMensaje(null);
    };
    programar(ocultar, DURACION_MENSAJE_MS);
  };

  useEffect(() => {
    const t = setTimeout(
      () =>
        decir(
          { texto: MENSAJES_SALA.bienvenida(sala), detalle: mundo.frase, tono: 'saludo' },
          { reaccionar: true },
        ),
      ESPERA_BIENVENIDA_MS,
    );
    return () => {
      clearTimeout(t);
      clearTimeout(temporizadorFoco.current);
      limpiar();
    };
    // Solo al entrar a la sala.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const presentar = (id: IdActividad) => {
    if (silenciado.current || activa || ignorarFoco.current) return;
    const act = ACTIVIDADES_SALA.find((a) => a.id === id)!;
    decir({ texto: act.titulo, detalle: act.descripcion, tono: 'presenta' });
  };

  const pedirConsejo = () => {
    silenciado.current = false;
    decir(
      { texto: MENSAJES_SALA.consejos[consejo % MENSAJES_SALA.consejos.length]!, tono: 'consejo' },
      { reaccionar: true },
    );
    setConsejo((n) => n + 1);
  };

  const cerrarGlobo = () => {
    silenciado.current = true;
    limpiar();
    setMensaje(null);
  };

  const completar = (id: IdActividad, resultado: { aciertos: number; total: number }) => {
    ultimoResultado.current = resultado;
    setCompletadas((lista) => (lista.includes(id) ? lista : [...lista, id]));
  };

  const cerrarActividad = () => {
    const terminada = ultimoResultado.current;
    ignorarFoco.current = true;
    clearTimeout(temporizadorFoco.current);
    temporizadorFoco.current = setTimeout(() => (ignorarFoco.current = false), 1500);
    setActiva(null);
    ultimoResultado.current = null;
    if (!terminada) return;
    silenciado.current = false;
    const perfecto = terminada.aciertos === terminada.total;
    decir(
      {
        texto: perfecto ? MENSAJES_SALA.perfecto : MENSAJES_SALA.completado,
        tono: 'logro',
      },
      { reaccionar: true },
    );
    programar(() => decir({ texto: MENSAJES_SALA.otro, tono: 'presenta' }), 5000);
  };

  const juego = JUEGOS.find((j) => j.id === activa);
  const actividad = ACTIVIDADES_SALA.find((a) => a.id === activa);
  const Icono = activa ? OBJETOS[activa].icono : Layers;

  return (
    <section
      className={estilos.rincon}
      style={{ ['--acento' as string]: mundo.acento }}
      data-ambiente={mundo.ambiente}
      aria-labelledby="titulo-rincon"
    >
      <header className={estilos.cabecera}>
        <h2 id="titulo-rincon" className={estilos.titulo}>
          Rincón de actividades
        </h2>
        <p className={estilos.subtitulo}>
          Opcional: juega cuando quieras, la sala sigue abierta detrás.
        </p>
      </header>

      <div className={estilos.escena}>
        <span className={estilos.ambiente} aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <i key={i} style={{ ['--i' as string]: i }} />
          ))}
        </span>

        <div
          className={estilos.guia}
          onMouseEnter={() => (enUso.current = true)}
          onMouseLeave={() => (enUso.current = false)}
          onFocus={() => (enUso.current = true)}
          onBlur={() => (enUso.current = false)}
        >
          {mensaje && (
            <div className={estilos.globo} data-tono={mensaje.tono}>
              <p className={estilos.quien}>
                <strong>{guia.nombre}</strong>
                <span>Asistente virtual · mensaje automático</span>
              </p>
              <div role="status">
                <p className={estilos.textoGlobo}>{mensaje.texto}</p>
                {mensaje.detalle && <p className={estilos.detalleGlobo}>{mensaje.detalle}</p>}
              </div>
              <button
                type="button"
                className={estilos.cerrarGlobo}
                aria-label={`Cerrar el mensaje de ${guia.nombre}`}
                onClick={cerrarGlobo}
              >
                <X aria-hidden="true" size={16} />
              </button>
            </div>
          )}
          <button
            type="button"
            className={estilos.personaje}
            onClick={pedirConsejo}
            aria-label={`${guia.nombre}, ${guia.papel.toLowerCase()}: ver un consejo de convivencia`}
          >
            <span key={reaccion} className={estilos.salto}>
              <PersonajeAcompanante id={mundo.personaje} tamano={56} />
            </span>
            <span className={estilos.placaGuia}>{guia.nombre}</span>
          </button>
        </div>

        <ul className={estilos.objetos}>
          {ACTIVIDADES_SALA.map((act) => {
            const { icono: IconoObjeto, nombre } = OBJETOS[act.id];
            const hecha = completadas.includes(act.id);
            return (
              <li key={act.id}>
                <button
                  type="button"
                  className={estilos.objeto}
                  data-recomendada={act.id === mundo.recomendada || undefined}
                  onClick={() => setActiva(act.id)}
                  onMouseEnter={() => presentar(act.id)}
                  onFocus={() => presentar(act.id)}
                >
                  <span className={estilos.pieza} aria-hidden="true">
                    <IconoObjeto size={26} strokeWidth={1.8} />
                    {hecha && (
                      <span className={estilos.hecha}>
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className={estilos.placa}>
                    <span className={estilos.nombreActividad}>{act.titulo}</span>
                    <span className={estilos.nombreObjeto}>
                      {hecha ? 'Completada' : act.id === mundo.recomendada ? 'Recomendada' : nombre}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <ModalFicha
        abierto={activa !== null}
        alCerrar={cerrarActividad}
        icono={<Icono size={22} />}
        antetitulo={`Actividad de la sala · ${sala}`}
        titulo={actividad?.titulo ?? ''}
      >
        {activa === 'retos-rapidos' ? (
          <RetosRapidos
            key={activa}
            alSalir={cerrarActividad}
            alCompletar={(r) => completar('retos-rapidos', r)}
          />
        ) : juego ? (
          <Minijuego
            key={juego.id}
            juego={juego}
            alSalir={cerrarActividad}
            alCompletar={(r) => completar(juego.id, r)}
            textoSalir="Volver a la sala"
          />
        ) : null}
      </ModalFicha>
    </section>
  );
}
