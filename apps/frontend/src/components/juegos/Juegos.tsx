'use client';

import { ArrowLeft, Clock, Gamepad2, ShieldCheck, Sparkles, Users, Zap } from 'lucide-react';
import { useState } from 'react';
import { Chigui } from '@/components/guia/Chigui';
import { Cocuyo } from '@/components/guia/Cocuyo';
import { JUEGOS, type Juego } from '@/config/juegos';
import estilos from './Juegos.module.css';
import { Minijuego } from './Minijuego';

const ICONOS: Record<Juego['id'], typeof Users> = {
  'que-harias': Users,
  'detecta-el-riesgo': ShieldCheck,
  'comunidad-segura': Sparkles,
  'retos-rapidos': Zap,
};

/** Centro de minijuegos: elegir un juego y jugarlo. Todo es opcional y no requiere sesión. */
export function Juegos() {
  const [elegido, setElegido] = useState<Juego['id'] | null>(null);
  const juego = JUEGOS.find((j) => j.id === elegido);

  if (juego) {
    return (
      <div className={estilos.pagina}>
        <button type="button" className={estilos.volver} onClick={() => setElegido(null)}>
          <ArrowLeft aria-hidden="true" size={16} />
          Todos los juegos
        </button>
        <header className={estilos.cabeceraJuego}>
          <p className={estilos.antetitulo}>{juego.tema}</p>
          <h1 className={estilos.tituloJuego}>{juego.titulo}</h1>
        </header>
        <Minijuego key={juego.id} juego={juego} alSalir={() => setElegido(null)} />
      </div>
    );
  }

  return (
    <div className={estilos.pagina}>
      <header className={estilos.portada}>
        <div className={estilos.textosPortada}>
          <p className={estilos.antetitulo}>
            <Gamepad2 aria-hidden="true" size={16} />
            Minijuegos
          </p>
          <h1 className={estilos.titulo}>Aprende jugando a cuidar tu comunidad</h1>
          <p className={estilos.entradilla}>
            Actividades cortas sobre convivencia y seguridad digital. Son opcionales, no piden datos
            y no guardan puntajes.
          </p>
        </div>
        <div className={estilos.escena} aria-hidden="true">
          <span className={estilos.personajeA}>
            <Cocuyo tamano={56} />
          </span>
          <span className={estilos.personajeB}>
            <Chigui tamano={84} />
          </span>
        </div>
      </header>

      <ul className={estilos.lista} aria-label="Juegos disponibles">
        {JUEGOS.map((j) => {
          const Icono = ICONOS[j.id];
          return (
            <li key={j.id}>
              <button
                type="button"
                className={`${estilos.tarjeta} con-luz`}
                onClick={() => setElegido(j.id)}
              >
                <span className={estilos.iconoTarjeta} aria-hidden="true">
                  <Icono size={24} strokeWidth={1.9} />
                </span>
                <span className={estilos.tituloTarjeta}>{j.titulo}</span>
                <span className={estilos.descripcionTarjeta}>{j.descripcion}</span>
                <span className={estilos.metaTarjeta}>
                  <span>{j.tema}</span>
                  <span>
                    <Clock aria-hidden="true" size={14} />
                    {j.minutos} min · {j.pasos.length} situaciones
                  </span>
                </span>
                <span className={estilos.jugar}>Jugar</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
