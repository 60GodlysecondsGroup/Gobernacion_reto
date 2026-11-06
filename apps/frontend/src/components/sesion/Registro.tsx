'use client';

import { ArrowLeft, ArrowRight, Check, ChevronDown, PenLine, Plus } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ControlesPersonaje, EscenarioPersonaje } from '@/components/avatar/CreadorPersonaje';
import { avatarAlAzar } from '@/components/avatar/opciones';
import { Aviso, Boton, CampoTexto, CargandoLista, EstadoError } from '@/components/ui';
import { HOBBIES_SUGERIDOS, MAXIMO_HOBBIES } from '@/config/hobbies';
import type { Capa, ConfiguracionAvatar, ElementoAvatar } from '@/lib/api/avatar';
import { campoDelError, erroresPorCampo, ErrorApi, mensajeDeError } from '@/lib/api/cliente';
import {
  comprobarAlias,
  obtenerOpcionesRegistro,
  type CodigoRango,
  type RangoEdad,
  type SesionPublica,
} from '@/lib/api/sesion';
import { CampoContrasena, CasillaRecordar } from './PiezasAcceso';
import {
  hobbyEscrito,
  PASOS_REGISTRO,
  primerPasoConError,
  ULTIMO_PASO,
  validarPaso,
  validarRegistro,
  type ErroresRegistro,
  type IndicePaso,
} from './pasosRegistro';
import { useSesion } from './ProveedorSesion';
import estilos from './Registro.module.css';

/** Hobbies sugeridos que se ven sin desplegar «Ver más»: dos o tres filas en un móvil. */
const HOBBIES_A_LA_VISTA = 8;

type Opciones = { rangos: RangoEdad[]; catalogo: ElementoAvatar[] };

/**
 * Registro de «Iniciar con mi Avatar» en tres etapas: cuenta (nametag y contraseña), sobre ti
 * (rango de edad y hobbies) y el personaje. Todo vive en un solo formulario: avanzar o volver
 * no borra nada, y la cuenta se crea con una sola petición al final, igual que antes.
 */
export function FormularioRegistro({
  alEntrar,
  alTenerCuenta,
}: {
  alEntrar: (usuario: SesionPublica) => void;
  alTenerCuenta: () => void;
}) {
  const { registrarse } = useSesion();
  const [opciones, setOpciones] = useState<Opciones | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  const [paso, setPaso] = useState<IndicePaso>(0);
  /** La etapa más avanzada a la que se ha llegado: hasta ahí se puede saltar desde el progreso. */
  const [alcanzado, setAlcanzado] = useState<IndicePaso>(0);
  const [direccion, setDireccion] = useState<'adelante' | 'atras'>('adelante');
  const [capaActiva, setCapaActiva] = useState<Capa>('personaje');

  const [avatar, setAvatar] = useState<ConfiguracionAvatar | null>(null);
  const [alias, setAlias] = useState('');
  const [rango, setRango] = useState<CodigoRango | null>(null);
  const [intereses, setIntereses] = useState<string[]>([]);
  const [verTodos, setVerTodos] = useState(false);
  const [escribirOtro, setEscribirOtro] = useState(false);
  const [otro, setOtro] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [recordar, setRecordar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  /** Consultando si el nametag está libre, al salir de la etapa 1. */
  const [comprobando, setComprobando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<ErroresRegistro>({});

  const id = useId();
  const formulario = useRef<HTMLFormElement>(null);
  /** Tras cambiar de etapa: llevar el foco al primer error (true) o al título de la etapa. */
  const enfocarError = useRef(false);
  const primerRender = useRef(true);
  /** El nametag escrito ahora mismo, para descartar una consulta que llegue tras editarlo. */
  const aliasActual = useRef('');

  const quitarError = (campo: keyof ErroresRegistro) =>
    setErrores((actuales) => ({ ...actuales, [campo]: undefined }));

  useEffect(() => {
    let vigente = true;
    obtenerOpcionesRegistro()
      .then((datos) => {
        if (!vigente) return;
        setOpciones(datos);
        setAvatar((actual) => actual ?? avatarAlAzar(datos.catalogo));
        setErrorCarga(null);
      })
      .catch((e: unknown) => vigente && setErrorCarga(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, [intento]);

  // Al cambiar de etapa: el foco va al título (o al primer error) y la etapa queda a la vista.
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    const activa = formulario.current?.querySelector<HTMLElement>(`[data-paso="${paso}"]`);
    if (!activa) return;
    const destino = enfocarError.current
      ? activa.querySelector<HTMLElement>('[aria-invalid="true"], [data-con-error="true"] input')
      : null;
    enfocarError.current = false;
    (destino ?? activa.querySelector<HTMLElement>('h2'))?.focus({ preventScroll: true });
    // El encabezado flotante tapa el borde superior: `scroll-padding-top` dice cuánto.
    const tapado = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const arriba = formulario.current?.getBoundingClientRect().top ?? 0;
    if (arriba < tapado || arriba > window.innerHeight * 0.6) {
      const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      formulario.current?.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
    }
  }, [paso]);

  if (errorCarga) {
    return <EstadoError alReintentar={() => setIntento((n) => n + 1)}>{errorCarga}</EstadoError>;
  }
  if (!opciones || !avatar) return <CargandoLista filas={2} etiqueta="Preparando tu avatar…" />;
  const { rangos, catalogo } = opciones;
  const datos = { alias, contrasena, rango };

  /** Lleva el foco al primer campo con error de la etapa visible (tras pintarse). */
  function enfocarPrimerError() {
    requestAnimationFrame(() =>
      formulario.current
        ?.querySelector<HTMLElement>(
          `[data-paso="${paso}"] :is([aria-invalid="true"], [data-con-error="true"] input)`,
        )
        ?.focus(),
    );
  }

  /** Muestra una etapa. Si hay errores, `conError` lleva el foco al primero de ellos. */
  function mostrar(destino: IndicePaso, conError = false) {
    if (destino === paso) {
      if (conError) enfocarPrimerError();
      return;
    }
    enfocarError.current = conError;
    setDireccion(destino > paso ? 'adelante' : 'atras');
    setPaso(destino);
    setAlcanzado((actual) => (destino > actual ? destino : actual));
  }

  /**
   * Al salir de la etapa 1: pregunta al backend si el nametag está libre. Devuelve false (y
   * marca el campo) solo si el backend lo rechaza; si la consulta no llega a responder (red,
   * límite de intentos), se deja avanzar: el registro final vuelve a comprobarlo.
   */
  async function nametagDisponible(): Promise<boolean> {
    const consultado = alias.trim();
    setComprobando(true);
    try {
      await comprobarAlias(consultado);
      return true;
    } catch (e) {
      const rechazo =
        e instanceof ErrorApi &&
        (campoDelError(e) === 'alias' ? mensajeDeError(e) : erroresPorCampo(e).alias);
      if (!rechazo) return true;
      // Si lo editaron mientras se consultaba, el aviso ya no corresponde a lo escrito.
      if (aliasActual.current.trim() === consultado) {
        setErrores((actuales) => ({ ...actuales, alias: rechazo }));
      }
      return false;
    } finally {
      setComprobando(false);
    }
  }

  /** Ir a otra etapa. Hacia adelante, se validan las etapas que quedan atrás. */
  async function irA(destino: IndicePaso) {
    if (destino <= paso) {
      setError(null);
      mostrar(destino);
      return;
    }
    if (comprobando) return;
    const pendientes: ErroresRegistro = {};
    for (let p = paso; p < destino; p++)
      Object.assign(pendientes, validarPaso(p as IndicePaso, datos));
    const conError = primerPasoConError(pendientes);
    if (conError !== null) {
      setErrores((actuales) => ({ ...actuales, ...pendientes }));
      mostrar(conError, true);
      return;
    }
    if (paso === 0) {
      const consultado = alias;
      if (!(await nametagDisponible())) {
        mostrar(0, true);
        return;
      }
      // Cambió mientras se consultaba: no se avanza con un nametag sin comprobar.
      if (aliasActual.current !== consultado) return;
    }
    setError(null);
    mostrar(destino);
  }

  const alternarHobby = (hobby: string) => {
    quitarError('intereses');
    setIntereses((actuales) =>
      actuales.some((h) => h.toLowerCase() === hobby.toLowerCase())
        ? actuales.filter((h) => h.toLowerCase() !== hobby.toLowerCase())
        : actuales.length >= MAXIMO_HOBBIES
          ? actuales
          : [...actuales, hobby],
    );
  };

  function agregarOtro() {
    const hobby = hobbyEscrito(otro);
    if (!hobby) {
      setErrores((e) => ({ ...e, intereses: 'Cada hobby debe tener entre 2 y 30 caracteres.' }));
      return;
    }
    if (intereses.length >= MAXIMO_HOBBIES) {
      setErrores((e) => ({ ...e, intereses: `Puedes elegir hasta ${MAXIMO_HOBBIES} hobbies.` }));
      return;
    }
    if (!intereses.some((h) => h.toLowerCase() === hobby.toLowerCase())) alternarHobby(hobby);
    setOtro('');
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando || comprobando || !avatar) return;
    // Enter en una etapa intermedia equivale a «Continuar».
    if (paso < ULTIMO_PASO) {
      await irA((paso + 1) as IndicePaso);
      return;
    }

    const locales = validarRegistro(datos);
    const conError = primerPasoConError(locales);
    if (conError !== null) {
      setErrores(locales);
      setError('Revisa los campos marcados y vuelve a intentarlo.');
      mostrar(conError, true);
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      alEntrar(
        await registrarse({
          alias: alias.trim(),
          contrasena,
          rango: rango!,
          intereses,
          avatar,
          recordar,
        }),
      );
    } catch (e) {
      const porCampo: ErroresRegistro = {};
      if (e instanceof ErrorApi && e.codigo === 'AVATAR_INVALIDO') {
        porCampo.avatar = 'Ese avatar ya no está disponible. Elige otra combinación.';
      } else {
        Object.assign(porCampo, erroresPorCampo(e));
        const campo = campoDelError(e);
        if (campo) porCampo[campo as keyof ErroresRegistro] = mensajeDeError(e);
      }
      setErrores(porCampo);
      setEnviando(false);
      // El error del servidor se corrige en la etapa del campo (p. ej., un nametag ya tomado),
      // donde se muestra junto al campo; sin campo (límite de intentos, red), arriba.
      const destino = primerPasoConError(porCampo);
      setError(destino === null ? mensajeDeError(e) : null);
      mostrar(destino ?? paso, true);
    }
  }

  const sugeridos = [
    ...HOBBIES_SUGERIDOS,
    ...intereses.filter((h) => !HOBBIES_SUGERIDOS.some((s) => s.toLowerCase() === h.toLowerCase())),
  ];
  const elegido = (hobby: string) => intereses.some((h) => h.toLowerCase() === hobby.toLowerCase());
  // Plegados, se ven los primeros y además cualquiera que ya esté elegido.
  const visibles = verTodos
    ? sugeridos
    : sugeridos.filter((h, i) => i < HOBBIES_A_LA_VISTA || elegido(h));
  const ocultos = sugeridos.length - visibles.length;
  const titulo = (p: IndicePaso) => `${id}-titulo-${p}`;

  return (
    <form
      ref={formulario}
      className={estilos.registro}
      data-etapa={paso}
      data-direccion={direccion}
      onSubmit={enviar}
      noValidate
    >
      <ol className={estilos.progreso} aria-label="Etapas del registro">
        {PASOS_REGISTRO.map((p, i) => {
          const actual = i === paso;
          const hecha = i < paso;
          const disponible = i <= alcanzado && !actual && !enviando && !comprobando;
          const contenido = (
            <>
              <span className={estilos.punto} aria-hidden="true">
                {hecha ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <span className={estilos.textoEtapa}>{p.corto}</span>
              <span className="visualmente-oculto">
                {actual ? ' (etapa actual)' : hecha ? ' (completada)' : ''}
              </span>
            </>
          );
          return (
            <li
              key={p.id}
              className={estilos.etapa}
              data-estado={actual ? 'actual' : hecha ? 'hecha' : 'pendiente'}
              aria-current={actual ? 'step' : undefined}
            >
              {disponible ? (
                <button
                  type="button"
                  className={estilos.botonEtapa}
                  onClick={() => irA(i as IndicePaso)}
                >
                  {contenido}
                </button>
              ) : (
                <span className={estilos.botonEtapa}>{contenido}</span>
              )}
            </li>
          );
        })}
      </ol>

      <aside className={estilos.escenario} aria-label="Tu personaje">
        <EscenarioPersonaje
          configuracion={avatar}
          catalogo={catalogo}
          alias={alias}
          alSorprender={paso === ULTIMO_PASO ? () => setAvatar(avatarAlAzar(catalogo)) : undefined}
          deshabilitado={enviando}
        />
        {paso < ULTIMO_PASO && <p className={estilos.pista}>Lo personalizas en el último paso.</p>}
      </aside>

      <div className={estilos.panel}>
        {error && <Aviso tono="peligro">{error}</Aviso>}

        {/* ─── Etapa 1: cuenta ─────────────────────────────────────────────── */}
        <section
          className={estilos.paso}
          data-paso={0}
          hidden={paso !== 0}
          aria-labelledby={titulo(0)}
        >
          <header className={estilos.encabezadoPaso}>
            <h2 id={titulo(0)} tabIndex={-1}>
              Crea tu cuenta
            </h2>
            <p>Solo un nametag y una contraseña: nada de nombre real, correo ni teléfono.</p>
          </header>
          <CampoTexto
            etiqueta="Nametag"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={30}
            obligatorio
            enterKeyHint="next"
            ayuda="Tu nombre público en la comunidad. No uses tu nombre real."
            value={alias}
            onChange={(e) => {
              setAlias(e.target.value);
              aliasActual.current = e.target.value;
              quitarError('alias');
            }}
            error={errores.alias}
          />
          <CampoContrasena
            etiqueta="Contraseña"
            autoComplete="new-password"
            obligatorio
            ayuda="Mínimo 8 caracteres y sin tu nametag. Una frase corta es fácil de recordar."
            valor={contrasena}
            alCambiar={(valor) => {
              setContrasena(valor);
              quitarError('contrasena');
            }}
            error={errores.contrasena}
          />
          <CasillaRecordar marcada={recordar} alCambiar={setRecordar} />
        </section>

        {/* ─── Etapa 2: sobre ti ───────────────────────────────────────────── */}
        <section
          className={estilos.paso}
          data-paso={1}
          hidden={paso !== 1}
          aria-labelledby={titulo(1)}
        >
          <header className={estilos.encabezadoPaso}>
            <h2 id={titulo(1)} tabIndex={-1}>
              Cuéntanos de ti
            </h2>
            <p>Te ubicamos en la comunidad de tu edad.</p>
          </header>

          <fieldset
            className={estilos.grupo}
            data-con-error={errores.rango ? true : undefined}
            aria-describedby={[`${id}-rango-ayuda`, errores.rango && `${id}-rango-error`]
              .filter(Boolean)
              .join(' ')}
          >
            <legend className={estilos.leyenda}>
              Tu rango de edad <span className={estilos.marca}>Obligatorio</span>
            </legend>
            <div className={estilos.rangos}>
              {rangos.map((r) => (
                <label key={r.codigo} className={estilos.rango}>
                  <input
                    type="radio"
                    name={`${id}-rango`}
                    value={r.codigo}
                    checked={rango === r.codigo}
                    onChange={() => {
                      setRango(r.codigo);
                      quitarError('rango');
                    }}
                  />
                  {r.etiqueta}
                </label>
              ))}
            </div>
            <p id={`${id}-rango-ayuda`} className={estilos.ayuda}>
              Solo se guarda el rango, nunca tu edad exacta, y después no se puede cambiar.
            </p>
            {errores.rango && (
              <p id={`${id}-rango-error`} className={estilos.errorGrupo} role="alert">
                {errores.rango}
              </p>
            )}
          </fieldset>

          <fieldset className={estilos.grupo} data-con-error={errores.intereses ? true : undefined}>
            <legend className={estilos.leyenda}>
              Tus hobbies{' '}
              <span className={estilos.marca}>
                Opcional · {intereses.length}/{MAXIMO_HOBBIES}
              </span>
            </legend>
            <div className={estilos.chips}>
              {visibles.map((hobby) => {
                const activo = elegido(hobby);
                return (
                  <button
                    key={hobby}
                    type="button"
                    className={estilos.chip}
                    aria-pressed={activo}
                    disabled={!activo && intereses.length >= MAXIMO_HOBBIES}
                    onClick={() => alternarHobby(hobby)}
                  >
                    {activo ? (
                      <Check aria-hidden="true" size={14} />
                    ) : (
                      <Plus aria-hidden="true" size={14} />
                    )}
                    {hobby}
                  </button>
                );
              })}
              {ocultos > 0 && (
                <button
                  type="button"
                  className={`${estilos.chip} ${estilos.chipAccion}`}
                  aria-expanded={false}
                  onClick={() => setVerTodos(true)}
                >
                  <ChevronDown aria-hidden="true" size={14} />
                  Ver {ocultos} más
                </button>
              )}
              {!escribirOtro && (
                <button
                  type="button"
                  className={`${estilos.chip} ${estilos.chipAccion}`}
                  aria-expanded={false}
                  aria-controls={`${id}-otro`}
                  onClick={() => {
                    setEscribirOtro(true);
                    requestAnimationFrame(() => document.getElementById(`${id}-otro`)?.focus());
                  }}
                >
                  <PenLine aria-hidden="true" size={14} />
                  Otro
                </button>
              )}
            </div>
            {escribirOtro && (
              <div className={estilos.otro}>
                <CampoTexto
                  id={`${id}-otro`}
                  etiqueta="¿Otro hobby?"
                  maxLength={30}
                  enterKeyHint="done"
                  value={otro}
                  onChange={(e) => setOtro(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      agregarOtro();
                    }
                  }}
                />
                <Boton variante="secundario" onClick={agregarOtro} disabled={!otro.trim()}>
                  Agregar
                </Boton>
              </div>
            )}
            {errores.intereses && (
              <p className={estilos.errorGrupo} role="alert">
                {errores.intereses}
              </p>
            )}
          </fieldset>
        </section>

        {/* ─── Etapa 3: personaje ──────────────────────────────────────────── */}
        <section
          className={`${estilos.paso} ${estilos.pasoPersonaje}`}
          data-paso={2}
          hidden={paso !== 2}
          aria-labelledby={titulo(2)}
        >
          <header className={estilos.encabezadoPaso}>
            <h2 id={titulo(2)} tabIndex={-1}>
              Arma tu personaje
            </h2>
            <p>Usa las flechas para cambiar cada característica.</p>
          </header>
          <ControlesPersonaje
            configuracion={avatar}
            catalogo={catalogo}
            activa={capaActiva}
            alCambiarActiva={setCapaActiva}
            alElegir={(capa, valor) => {
              setAvatar({ ...avatar, [capa]: valor });
              quitarError('avatar');
            }}
            deshabilitado={enviando}
          />
          {errores.avatar && (
            <p className={estilos.errorGrupo} role="alert">
              {errores.avatar}
            </p>
          )}
        </section>

        <div className={estilos.navegacion}>
          {paso > 0 && (
            <Boton
              variante="secundario"
              tamano="lg"
              className={estilos.atras}
              disabled={enviando}
              onClick={() => irA((paso - 1) as IndicePaso)}
            >
              <ArrowLeft aria-hidden="true" size={18} />
              Atrás
            </Boton>
          )}
          {paso < ULTIMO_PASO ? (
            <Boton type="submit" tamano="lg" cargando={comprobando} className={estilos.continuar}>
              Continuar
              <ArrowRight aria-hidden="true" size={18} />
            </Boton>
          ) : (
            <Boton type="submit" tamano="lg" cargando={enviando} className={estilos.continuar}>
              Crear mi cuenta
              <ArrowRight aria-hidden="true" size={18} />
            </Boton>
          )}
        </div>

        {paso === 0 && (
          <p className={estilos.alterno}>
            ¿Ya tienes cuenta?{' '}
            <button type="button" className={estilos.enlaceTexto} onClick={alTenerCuenta}>
              Entra con tu nametag
            </button>
          </p>
        )}
      </div>
    </form>
  );
}
