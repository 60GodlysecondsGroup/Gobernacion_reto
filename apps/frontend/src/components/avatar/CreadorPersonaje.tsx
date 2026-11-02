'use client';

import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Glasses,
  Palette,
  Scissors,
  Shirt,
  Shuffle,
  Smile,
  type LucideIcon,
} from 'lucide-react';
import { useId, useRef, type KeyboardEvent } from 'react';
import type { Capa, ConfiguracionAvatar, ElementoAvatar } from '@/lib/api/avatar';
import { Avatar } from './Avatar';
import { aparienciaDe, CATEGORIAS, indiceDeValor, valorAdyacente, valoresDeCapa } from './opciones';
import estilos from './CreadorPersonaje.module.css';

/*
 * Creador de personaje al estilo de un videojuego: el personaje en un escenario y, debajo, una
 * característica a la vez con flechas para recorrer sus opciones. Es el único creador: lo usan
 * el registro (personaje nuevo) y «Mi avatar» (personaje guardado). Ambos le pasan la
 * configuración y reciben cada cambio; el creador no guarda ni inventa valores por su cuenta.
 */

/** Nombre corto e ícono de cada característica, para las pestañas. */
const PRESENTACION: Record<Capa, { corto: string; icono: LucideIcon }> = {
  personaje: { corto: 'Tono', icono: Palette },
  cabello: { corto: 'Cabello', icono: Scissors },
  rasgos: { corto: 'Rostro', icono: Smile },
  prenda: { corto: 'Ropa', icono: Shirt },
  accesorio: { corto: 'Accesorio', icono: Glasses },
};

/** El personaje en su escenario, con su nametag debajo como en la pantalla de un juego. */
export function EscenarioPersonaje({
  configuracion,
  catalogo,
  alias,
  alSorprender,
  deshabilitado,
  className,
}: {
  configuracion: ConfiguracionAvatar;
  catalogo: ElementoAvatar[];
  alias: string;
  /** Sin esta función no se muestra «Sorpréndeme». */
  alSorprender?: () => void;
  deshabilitado?: boolean;
  className?: string;
}) {
  // La clave cambia con cada combinación: el personaje «salta» al cambiar algo.
  const clave = CATEGORIAS.map(({ capa }) => configuracion[capa] ?? '-').join('|');
  return (
    <div className={[estilos.escenario, className].filter(Boolean).join(' ')}>
      <div className={estilos.lienzo}>
        <div key={clave} className={estilos.personaje}>
          <Avatar
            apariencia={aparienciaDe(configuracion, catalogo)}
            tamano={160}
            etiqueta="Vista previa de tu personaje"
          />
        </div>
        <span className={estilos.sombra} aria-hidden="true" />
        {alSorprender && (
          <button
            type="button"
            className={estilos.sorpresa}
            onClick={alSorprender}
            disabled={deshabilitado}
          >
            <Shuffle aria-hidden="true" size={16} />
            Sorpréndeme
          </button>
        )}
      </div>
      <strong className={estilos.placa} data-vacia={alias.trim() ? undefined : true}>
        {alias.trim() || 'Tu nametag'}
      </strong>
    </div>
  );
}

/**
 * Los controles del creador: pestañas de características, flechas ‹ › para recorrer las opciones
 * de la característica activa y una tira de miniaturas para elegir directamente.
 */
export function ControlesPersonaje({
  configuracion,
  catalogo,
  activa,
  alCambiarActiva,
  alElegir,
  deshabilitado,
}: {
  configuracion: ConfiguracionAvatar;
  catalogo: ElementoAvatar[];
  activa: Capa;
  alCambiarActiva: (capa: Capa) => void;
  alElegir: (capa: Capa, id: string | null) => void;
  deshabilitado?: boolean;
}) {
  const id = useId();
  const miniaturas = useRef<HTMLDivElement>(null);
  const indiceCategoria = Math.max(
    0,
    CATEGORIAS.findIndex((c) => c.capa === activa),
  );
  const categoria = CATEGORIAS[indiceCategoria];
  const siguiente = CATEGORIAS[indiceCategoria + 1];
  const valores = valoresDeCapa(catalogo, categoria.tipo, categoria.ninguno);
  const actual = indiceDeValor(valores, configuracion[activa]);
  const corto = PRESENTACION[activa].corto.toLowerCase();

  const mover = (direccion: -1 | 1) => {
    const valor = valorAdyacente(valores, configuracion[activa], direccion);
    if (valor) alElegir(activa, valor.id);
  };

  /** Flechas del teclado en las pestañas: cambian de característica (patrón de pestañas). */
  function alTeclaPestanas(evento: KeyboardEvent) {
    if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') return;
    evento.preventDefault();
    const total = CATEGORIAS.length;
    const destino =
      CATEGORIAS[(indiceCategoria + (evento.key === 'ArrowRight' ? 1 : -1) + total) % total];
    alCambiarActiva(destino.capa);
    document.getElementById(`${id}-pestana-${destino.capa}`)?.focus();
  }

  /** Flechas del teclado en las miniaturas: recorren las opciones (patrón de grupo de radio). */
  function alTeclaMiniaturas(evento: KeyboardEvent) {
    const direccion = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[evento.key];
    if (!direccion) return;
    evento.preventDefault();
    const valor = valorAdyacente(valores, configuracion[activa], direccion as -1 | 1);
    if (!valor) return;
    alElegir(activa, valor.id);
    requestAnimationFrame(() =>
      miniaturas.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus(),
    );
  }

  return (
    <div className={estilos.controles}>
      <div
        className={estilos.pestanas}
        role="tablist"
        aria-label="Características del personaje"
        onKeyDown={alTeclaPestanas}
      >
        {CATEGORIAS.map(({ capa, titulo }) => {
          const { corto: texto, icono: Icono } = PRESENTACION[capa];
          const seleccionada = capa === activa;
          return (
            <button
              key={capa}
              id={`${id}-pestana-${capa}`}
              type="button"
              role="tab"
              aria-selected={seleccionada}
              aria-controls={`${id}-panel`}
              tabIndex={seleccionada ? 0 : -1}
              title={titulo}
              className={estilos.pestana}
              onClick={() => alCambiarActiva(capa)}
            >
              <Icono aria-hidden="true" size={20} />
              <span>{texto}</span>
            </button>
          );
        })}
      </div>

      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-pestana-${activa}`}
        className={estilos.panel}
      >
        <div className={estilos.selector}>
          <button
            type="button"
            className={estilos.flecha}
            onClick={() => mover(-1)}
            disabled={deshabilitado || valores.length < 2}
            aria-label={`${categoria.titulo}: opción anterior`}
          >
            <ChevronLeft aria-hidden="true" size={28} />
          </button>
          <p className={estilos.valor} aria-live="polite">
            <span className={estilos.categoria}>{categoria.titulo}</span>
            <strong key={valores[actual]?.id ?? 'ninguno'} className={estilos.nombreValor}>
              {valores[actual]?.nombre}
            </strong>
            <span className={estilos.cuenta}>
              {actual + 1} de {valores.length}
            </span>
          </p>
          <button
            type="button"
            className={estilos.flecha}
            onClick={() => mover(1)}
            disabled={deshabilitado || valores.length < 2}
            aria-label={`${categoria.titulo}: opción siguiente`}
          >
            <ChevronRight aria-hidden="true" size={28} />
          </button>
        </div>

        <div
          ref={miniaturas}
          className={estilos.miniaturas}
          role="radiogroup"
          aria-label={`Opciones de ${corto}`}
          onKeyDown={alTeclaMiniaturas}
        >
          {valores.map((valor, i) => {
            const elegida = i === actual;
            return (
              <button
                key={valor.id ?? 'ninguno'}
                type="button"
                role="radio"
                aria-checked={elegida}
                aria-label={valor.nombre}
                title={valor.nombre}
                tabIndex={elegida ? 0 : -1}
                disabled={deshabilitado}
                className={estilos.miniatura}
                onClick={() => alElegir(activa, valor.id)}
              >
                <Avatar
                  apariencia={aparienciaDe(
                    // Las opciones de cabello se ven sin accesorio: una gorra las taparía.
                    {
                      ...configuracion,
                      [activa]: valor.id,
                      ...(activa === 'cabello' && { accesorio: null }),
                    },
                    catalogo,
                  )}
                  tamano={36}
                />
              </button>
            );
          })}
        </div>
      </div>

      {siguiente && (
        <button
          type="button"
          className={estilos.siguienteCategoria}
          onClick={() => alCambiarActiva(siguiente.capa)}
        >
          Siguiente: {PRESENTACION[siguiente.capa].corto}
          <ArrowRight aria-hidden="true" size={16} />
        </button>
      )}
    </div>
  );
}
