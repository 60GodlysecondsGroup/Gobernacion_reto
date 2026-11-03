'use client';

import { Keyboard, MapPin, Pencil, Search, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { MapaUbicacion } from '@/components/mapas/MapaUbicacion';
import { Aviso, Boton, CampoTexto } from '@/components/ui';
import { mensajeDeError } from '@/lib/api/cliente';
import {
  buscarLugares,
  busquedaLugaresDisponible,
  obtenerLugar,
  type SugerenciaLugar,
} from '@/lib/api/fuentes';
import { validarUbicacionManual, type BorradorUbicacion } from '@/lib/fuentes-validacion';
import {
  formatearCoordenadas,
  leerCoordenadas,
  urlVerEnMapa,
  type UbicacionFuente,
} from '@/lib/mapas';
import comun from '../comun.module.css';
import estilos from './SelectorUbicacion.module.css';

type Props = {
  ubicacion: UbicacionFuente | null;
  alCambiar: (ubicacion: UbicacionFuente | null) => void;
  /** Error del servidor para el campo `ubicacion`. */
  error?: string;
  /** Nombre del servicio, para los textos accesibles del mapa. */
  lugar: string;
};

type Modo = 'vacio' | 'vista' | 'buscar' | 'manual';

/** Token de una sesión de búsqueda: agrupa sugerencias y detalle (Google cobra por sesión). */
function nuevaSesion(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

/**
 * Ubicación de una fuente en el mapa (panel de fuentes). Opcional: pensada para la atención
 * presencial, también sirve para fuentes híbridas, que conservan sus canales virtuales.
 *
 * - Buscar: dirección o establecimiento con Google Places (a través del backend, que guarda la
 *   clave). Al elegir, se guarda el punto, su place_id y la dirección de ese punto.
 * - A mano: coordenadas copiadas de Google Maps y su dirección (si la búsqueda no está
 *   configurada o no encuentra el lugar). Nunca se calculan coordenadas a partir de un texto.
 * - Ver, cambiar o quitar la ubicación: los cambios se guardan con «Guardar cambios».
 *
 * Solo busca lugares de instituciones: no usa ni pide la ubicación de quien la registra.
 */
export function SelectorUbicacion({ ubicacion, alCambiar, error, lugar }: Props) {
  const [modo, setModo] = useState<Modo>(ubicacion ? 'vista' : 'vacio');
  const [disponible, setDisponible] = useState<boolean | null>(null);
  const resumen = useRef<HTMLParagraphElement>(null);
  const agregar = useRef<HTMLButtonElement>(null);
  const [enfocar, setEnfocar] = useState<'resumen' | 'agregar' | null>(null);

  useEffect(() => {
    let vigente = true;
    busquedaLugaresDisponible()
      .then((r) => vigente && setDisponible(r.disponible))
      .catch(() => vigente && setDisponible(false));
    return () => {
      vigente = false;
    };
  }, []);

  // Tras elegir o quitar, el foco va al resultado para que se anuncie y no se pierda.
  useEffect(() => {
    if (enfocar === 'resumen') resumen.current?.focus();
    if (enfocar === 'agregar') agregar.current?.focus();
  }, [enfocar, modo]);

  const elegir = (nueva: UbicacionFuente) => {
    alCambiar(nueva);
    setModo('vista');
    setEnfocar('resumen');
  };
  const quitar = () => {
    alCambiar(null);
    setModo('vacio');
    setEnfocar('agregar');
  };
  const cancelar = () => {
    setModo(ubicacion ? 'vista' : 'vacio');
    setEnfocar(null);
  };
  const editar = () => {
    setEnfocar(null);
    setModo(disponible === false ? 'manual' : 'buscar');
  };

  return (
    <div className={estilos.selector}>
      {error && (
        <p className={estilos.error} role="alert">
          {error}
        </p>
      )}

      {modo === 'vacio' && (
        <div className={estilos.vacio}>
          <p className={comun.suave}>Sin ubicación en el mapa.</p>
          <Boton ref={agregar} variante="secundario" tamano="sm" onClick={editar}>
            <MapPin aria-hidden="true" size={16} />
            Agregar ubicación
          </Boton>
        </div>
      )}

      {modo === 'vista' && ubicacion && (
        <div className={estilos.vista}>
          <MapaUbicacion ubicacion={ubicacion} lugar={lugar} enlace={urlVerEnMapa(ubicacion)} />
          <div className={estilos.datosVista}>
            <p ref={resumen} tabIndex={-1} className={estilos.resumen}>
              <span className="visualmente-oculto">Ubicación seleccionada: </span>
              {ubicacion.direccion}
            </p>
            <p className={comun.suave}>
              {formatearCoordenadas(ubicacion)} ·{' '}
              {ubicacion.placeId ? 'Lugar elegido en Google Maps' : 'Ubicación ingresada a mano'}
            </p>
            <div className={comun.fila}>
              <Boton variante="secundario" tamano="sm" onClick={editar}>
                <Pencil aria-hidden="true" size={16} />
                Cambiar ubicación
              </Boton>
              <Boton variante="fantasma" tamano="sm" onClick={quitar}>
                <Trash2 aria-hidden="true" size={16} />
                Quitar ubicación
              </Boton>
            </div>
          </div>
        </div>
      )}

      {modo === 'buscar' && (
        <Buscador
          disponible={disponible}
          alElegir={elegir}
          alCancelar={cancelar}
          alIrAManual={() => setModo('manual')}
        />
      )}

      {modo === 'manual' && (
        <UbicacionManual
          inicial={ubicacion}
          lugar={lugar}
          busquedaDisponible={disponible === true}
          alUsar={elegir}
          alCancelar={cancelar}
          alIrABuscar={() => setModo('buscar')}
        />
      )}
    </div>
  );
}

// ── Búsqueda con autocompletado (patrón combobox de ARIA 1.2) ─────────────────────────────────

const ESPERA_MS = 350;
const MINIMO = 3;

function Buscador({
  disponible,
  alElegir,
  alCancelar,
  alIrAManual,
}: {
  disponible: boolean | null;
  alElegir: (ubicacion: UbicacionFuente) => void;
  alCancelar: () => void;
  alIrAManual: () => void;
}) {
  const id = useId();
  const idLista = `${id}-lista`;
  const idAyuda = `${id}-ayuda`;
  const [texto, setTexto] = useState('');
  const [sugerencias, setSugerencias] = useState<SugerenciaLugar[]>([]);
  const [activa, setActiva] = useState(-1);
  const [estado, setEstado] = useState<'inicio' | 'buscando' | 'listo' | 'eligiendo'>('inicio');
  const [error, setError] = useState<string | null>(null);
  const sesion = useRef(nuevaSesion());
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (disponible) entrada.current?.focus();
  }, [disponible]);

  // Sugerencias con espera entre teclas; una consulta nueva cancela la anterior.
  useEffect(() => {
    const consulta = texto.trim();
    if (!disponible || consulta.length < MINIMO) return;
    const control = new AbortController();
    const temporizador = setTimeout(() => {
      setEstado('buscando');
      setError(null);
      buscarLugares(consulta, sesion.current, control.signal)
        .then((r) => {
          setSugerencias(r.sugerencias);
          setActiva(-1);
          setEstado('listo');
        })
        .catch((e: unknown) => {
          if (control.signal.aborted) return;
          setSugerencias([]);
          setError(mensajeDeError(e));
          setEstado('listo');
        });
    }, ESPERA_MS);
    return () => {
      clearTimeout(temporizador);
      control.abort();
    };
  }, [texto, disponible]);

  async function elegir(sugerencia: SugerenciaLugar) {
    setEstado('eligiendo');
    setError(null);
    try {
      const { lugar } = await obtenerLugar(sugerencia.placeId, sesion.current);
      sesion.current = nuevaSesion();
      alElegir({
        latitud: lugar.latitud,
        longitud: lugar.longitud,
        placeId: lugar.placeId,
        direccion: lugar.direccion,
      });
    } catch (e) {
      setError(mensajeDeError(e));
      setEstado('listo');
    }
  }

  const abierta = texto.trim().length >= MINIMO && estado === 'listo' && sugerencias.length > 0;

  function alTeclear(evento: KeyboardEvent<HTMLInputElement>) {
    // Enter nunca envía el formulario de la fuente desde este campo.
    if (evento.key === 'Enter') {
      evento.preventDefault();
      const elegida = sugerencias[activa];
      if (abierta && elegida) void elegir(elegida);
      return;
    }
    if (evento.key === 'Escape') {
      if (abierta) {
        evento.preventDefault();
        setSugerencias([]);
      }
      return;
    }
    if (!abierta) return;
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      setActiva((i) => (i + 1) % sugerencias.length);
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      setActiva((i) => (i <= 0 ? sugerencias.length - 1 : i - 1));
    }
  }

  if (disponible === null) return <p className={comun.suave}>Preparando la búsqueda…</p>;

  if (!disponible) {
    return (
      <div className={estilos.panel}>
        <Aviso tono="info" titulo="Búsqueda de Google Maps no configurada">
          En este entorno no está activa la búsqueda de lugares. Puedes ingresar la ubicación a mano
          con las coordenadas que muestra Google Maps.
        </Aviso>
        <div className={comun.fila}>
          <Boton variante="secundario" tamano="sm" onClick={alIrAManual}>
            <Keyboard aria-hidden="true" size={16} />
            Ingresar a mano
          </Boton>
          <Boton variante="fantasma" tamano="sm" onClick={alCancelar}>
            Cancelar
          </Boton>
        </div>
      </div>
    );
  }

  const mensajeEstado =
    estado === 'buscando'
      ? 'Buscando…'
      : estado === 'eligiendo'
        ? 'Obteniendo la ubicación…'
        : estado === 'listo' && !error && texto.trim().length >= MINIMO
          ? sugerencias.length === 0
            ? 'Sin resultados. Prueba con otra dirección o ingrésala a mano.'
            : `${sugerencias.length} ${sugerencias.length === 1 ? 'resultado' : 'resultados'}. Usa las flechas para elegir.`
          : '';

  return (
    <div className={estilos.panel}>
      <div className={estilos.campoBusqueda}>
        <label htmlFor={`${id}-entrada`} className={estilos.etiqueta}>
          Buscar dirección o establecimiento
        </label>
        <div className={estilos.contenedorEntrada}>
          <Search aria-hidden="true" size={18} className={estilos.iconoBusqueda} />
          <input
            ref={entrada}
            id={`${id}-entrada`}
            className={estilos.entrada}
            type="text"
            role="combobox"
            aria-expanded={abierta}
            aria-controls={idLista}
            aria-autocomplete="list"
            aria-activedescendant={abierta && activa >= 0 ? `${id}-opcion-${activa}` : undefined}
            aria-describedby={idAyuda}
            autoComplete="off"
            spellCheck={false}
            maxLength={120}
            placeholder="Ej.: Gobernación del Meta, Calle 38 # 30-25"
            value={texto}
            disabled={estado === 'eligiendo'}
            onChange={(e) => {
              setTexto(e.target.value);
              if (e.target.value.trim().length < MINIMO) {
                setSugerencias([]);
                setEstado('inicio');
              }
            }}
            onKeyDown={alTeclear}
          />
        </div>
        <p id={idAyuda} className={estilos.ayuda}>
          Escribe al menos {MINIMO} caracteres. Los resultados se limitan a Colombia.
        </p>
        <ul
          id={idLista}
          role="listbox"
          aria-label="Lugares encontrados"
          className={estilos.lista}
          hidden={!abierta}
        >
          {sugerencias.map((sugerencia, i) => (
            <li
              key={sugerencia.placeId}
              id={`${id}-opcion-${i}`}
              role="option"
              aria-selected={i === activa}
              className={estilos.opcion}
              // mousedown: elegir antes de que el campo pierda el foco.
              onMouseDown={(e) => {
                e.preventDefault();
                void elegir(sugerencia);
              }}
              onMouseEnter={() => setActiva(i)}
            >
              <MapPin aria-hidden="true" size={16} className={estilos.iconoOpcion} />
              <span>
                <span className={estilos.principal}>{sugerencia.principal}</span>
                {sugerencia.secundario && (
                  <span className={estilos.secundario}>{sugerencia.secundario}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className={estilos.estado} role="status" aria-live="polite">
        {mensajeEstado}
      </p>
      {error && (
        <p className={estilos.error} role="alert">
          {error}
        </p>
      )}

      <div className={comun.fila}>
        <Boton variante="fantasma" tamano="sm" onClick={alIrAManual}>
          <Keyboard aria-hidden="true" size={16} />
          Ingresar a mano
        </Boton>
        <Boton variante="fantasma" tamano="sm" onClick={alCancelar}>
          Cancelar
        </Boton>
      </div>
      <p className={estilos.atribucion}>Resultados de Google Maps</p>
    </div>
  );
}

// ── Ubicación a mano ──────────────────────────────────────────────────────────────────────────

function UbicacionManual({
  inicial,
  lugar,
  busquedaDisponible,
  alUsar,
  alCancelar,
  alIrABuscar,
}: {
  inicial: UbicacionFuente | null;
  lugar: string;
  busquedaDisponible: boolean;
  alUsar: (ubicacion: UbicacionFuente) => void;
  alCancelar: () => void;
  alIrABuscar: () => void;
}) {
  const [borrador, setBorrador] = useState<BorradorUbicacion>({
    coordenadas: inicial ? formatearCoordenadas(inicial) : '',
    direccion: inicial?.direccion ?? '',
  });
  const [intentado, setIntentado] = useState(false);
  const errores = validarUbicacionManual(borrador, leerCoordenadas);
  const punto = leerCoordenadas(borrador.coordenadas);
  const mismoPunto =
    inicial && punto && punto.latitud === inicial.latitud && punto.longitud === inicial.longitud;

  function usar() {
    setIntentado(true);
    if (!punto || Object.keys(errores).length > 0) return;
    alUsar({
      ...punto,
      // El place_id solo se conserva si el punto es el mismo que se eligió en Google.
      placeId: mismoPunto ? inicial.placeId : null,
      direccion: borrador.direccion.trim(),
    });
  }

  const alTeclear = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      usar();
    }
  };

  return (
    <div className={estilos.panel}>
      {!busquedaDisponible && (
        <p className={comun.suave}>
          La búsqueda de Google Maps no está configurada en este entorno: ingresa el punto con las
          coordenadas que muestra Google Maps.
        </p>
      )}
      <div className={estilos.dosColumnas}>
        <CampoTexto
          etiqueta="Coordenadas (latitud, longitud)"
          obligatorio
          ayuda="En Google Maps, haz clic derecho sobre el lugar y luego clic en las coordenadas para copiarlas."
          placeholder="4.14201, -73.62660"
          inputMode="decimal"
          autoComplete="off"
          value={borrador.coordenadas}
          onChange={(e) => setBorrador((b) => ({ ...b, coordenadas: e.target.value }))}
          onKeyDown={alTeclear}
          error={intentado ? errores.coordenadas : undefined}
        />
        <CampoTexto
          etiqueta="Dirección de ese punto"
          obligatorio
          ayuda="La que se mostrará junto al mapa."
          maxLength={300}
          autoComplete="off"
          value={borrador.direccion}
          onChange={(e) => setBorrador((b) => ({ ...b, direccion: e.target.value }))}
          onKeyDown={alTeclear}
          error={intentado ? errores.direccion : undefined}
        />
      </div>
      {punto && (
        <MapaUbicacion
          ubicacion={{ ...punto, placeId: null, direccion: borrador.direccion || lugar }}
          lugar={lugar}
          enlace={urlVerEnMapa({ ...punto, placeId: null, direccion: borrador.direccion })}
        />
      )}
      <div className={comun.fila}>
        <Boton tamano="sm" onClick={usar}>
          Usar esta ubicación
        </Boton>
        {busquedaDisponible && (
          <Boton variante="fantasma" tamano="sm" onClick={alIrABuscar}>
            <Search aria-hidden="true" size={16} />
            Buscar en Google Maps
          </Boton>
        )}
        <Boton variante="fantasma" tamano="sm" onClick={alCancelar}>
          Cancelar
        </Boton>
      </div>
    </div>
  );
}
