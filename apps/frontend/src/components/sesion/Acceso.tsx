'use client';

import { ArrowRight, Check, Plus, Shuffle } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Avatar } from '@/components/avatar/Avatar';
import { aparienciaDe, CATEGORIAS, SelectorCapa } from '@/components/avatar/EditorAvatar';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso, Boton, CampoTexto, CargandoLista, EstadoError } from '@/components/ui';
import { HOBBIES_SUGERIDOS, MAXIMO_HOBBIES } from '@/config/hobbies';
import type { ConfiguracionAvatar, ElementoAvatar, TipoElemento } from '@/lib/api/avatar';
import { campoDelError, erroresPorCampo, ErrorApi, mensajeDeError } from '@/lib/api/cliente';
import {
  obtenerOpcionesRegistro,
  type CodigoRango,
  type RangoEdad,
  type SesionPublica,
} from '@/lib/api/sesion';
import {
  CampoContrasena,
  CasillaRecordar,
  destinoInicial,
  rutaSegura,
  SesionYaAbierta,
} from './PiezasAcceso';
import { useSesion } from './ProveedorSesion';
import estilos from './Acceso.module.css';

type Modo = 'entrar' | 'registro';

/*
 * Este navegador ya tuvo una cuenta: entonces se abre en «Ya tengo cuenta»; si no, en «Soy nuevo».
 * Solo es una preferencia de interfaz (un «1»), nunca un dato de sesión.
 */
const CLAVE_TIENE_CUENTA = 'comunidad:tiene-cuenta';
const sinSuscripcion = () => () => {};
function leerTieneCuenta(): boolean {
  try {
    return localStorage.getItem(CLAVE_TIENE_CUENTA) === '1';
  } catch {
    return false;
  }
}
function recordarQueTieneCuenta() {
  try {
    localStorage.setItem(CLAVE_TIENE_CUENTA, '1');
  } catch {
    // Sin almacenamiento (modo privado): solo cambia la pestaña con que abre la próxima vez.
  }
}

/**
 * «Iniciar con mi Avatar»: una sola pantalla para entrar con una cuenta existente o crear una
 * nueva. Con sesión activa, ofrece continuar sin pedir nada.
 */
export function Acceso() {
  const { cargando, usuario, salir } = useSesion();
  const router = useRouter();
  const parametros = useSearchParams();
  const siguiente = rutaSegura(parametros.get('siguiente'));
  const modoPedido = parametros.get('modo');
  const tieneCuenta = useSyncExternalStore(sinSuscripcion, leerTieneCuenta, () => null);
  const [modoElegido, setModoElegido] = useState<Modo | null>(
    modoPedido === 'registro' || modoPedido === 'entrar' ? modoPedido : null,
  );
  const modo: Modo | null =
    modoElegido ?? (tieneCuenta === null ? null : tieneCuenta ? 'entrar' : 'registro');
  const idPestanas = useId();

  function alEntrar(nuevo: SesionPublica) {
    recordarQueTieneCuenta();
    router.push(siguiente ?? destinoInicial(nuevo));
  }

  if (cargando || modo === null) {
    return <CargandoLista filas={2} alto="6rem" etiqueta="Comprobando tu sesión…" />;
  }

  // Caso A: ya hay sesión. No se piden credenciales de nuevo.
  if (usuario) {
    return (
      <SesionYaAbierta
        antetitulo="Iniciar con mi Avatar"
        usuario={usuario}
        destino={siguiente ?? destinoInicial(usuario)}
        alSalir={() => void salir('/acceso')}
      />
    );
  }

  const pestanas: { modo: Modo; texto: string }[] = [
    { modo: 'registro', texto: 'Soy nuevo' },
    { modo: 'entrar', texto: 'Ya tengo cuenta' },
  ];

  return (
    <div className={estilos.pagina}>
      <EncabezadoPagina
        antetitulo="Iniciar con mi Avatar"
        titulo={modo === 'registro' ? 'Crea tu avatar y entra' : 'Entra con tu avatar'}
      >
        {modo === 'registro'
          ? 'Toma un minuto. Solo pedimos un nametag, tu rango de edad y una contraseña: nada de nombre real, correo ni teléfono.'
          : 'Escribe tu nametag y tu contraseña.'}
      </EncabezadoPagina>

      <div
        className={estilos.pestanas}
        role="tablist"
        aria-label="¿Ya tienes cuenta?"
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          const otro = modo === 'entrar' ? 'registro' : 'entrar';
          setModoElegido(otro);
          document.getElementById(`${idPestanas}-${otro}`)?.focus();
        }}
      >
        {pestanas.map((p) => (
          <button
            key={p.modo}
            id={`${idPestanas}-${p.modo}`}
            type="button"
            role="tab"
            aria-selected={modo === p.modo}
            aria-controls={`${idPestanas}-panel`}
            tabIndex={modo === p.modo ? 0 : -1}
            className={estilos.pestana}
            onClick={() => setModoElegido(p.modo)}
          >
            {p.texto}
          </button>
        ))}
      </div>

      <div id={`${idPestanas}-panel`} role="tabpanel" aria-labelledby={`${idPestanas}-${modo}`}>
        {modo === 'entrar' ? (
          <FormularioEntrar alEntrar={alEntrar} alCrearCuenta={() => setModoElegido('registro')} />
        ) : (
          <FormularioRegistro alEntrar={alEntrar} alTenerCuenta={() => setModoElegido('entrar')} />
        )}
      </div>

      <p className={estilos.nota}>
        ¿Eres del equipo de moderación o de gestión de fuentes?{' '}
        <Link
          className={estilos.enlaceTexto}
          href={`/acceso/personal${siguiente ? `?siguiente=${encodeURIComponent(siguiente)}` : ''}`}
        >
          Entra con tu correo
        </Link>
      </p>
    </div>
  );
}

// ─── Caso B: cuenta existente ────────────────────────────────────────────────

function FormularioEntrar({
  alEntrar,
  alCrearCuenta,
}: {
  alEntrar: (usuario: SesionPublica) => void;
  alCrearCuenta: () => void;
}) {
  const { entrar } = useSesion();
  const [alias, setAlias] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [recordar, setRecordar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faltan, setFaltan] = useState<{ alias?: string; contrasena?: string }>({});

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando) return;
    const pendientes = {
      alias: alias.trim() ? undefined : 'Escribe tu nametag.',
      contrasena: contrasena ? undefined : 'Escribe tu contraseña.',
    };
    setFaltan(pendientes);
    if (pendientes.alias || pendientes.contrasena) return;

    setEnviando(true);
    setError(null);
    try {
      alEntrar(await entrar({ alias: alias.trim(), contrasena, recordar }));
    } catch (e) {
      setError(mensajeDeError(e));
      setContrasena('');
      setEnviando(false);
    }
  }

  return (
    <form className={estilos.formularioCorto} onSubmit={enviar} noValidate>
      {error && <Aviso tono="peligro">{error}</Aviso>}
      <CampoTexto
        etiqueta="Nametag"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={60}
        value={alias}
        onChange={(e) => setAlias(e.target.value)}
        error={faltan.alias}
      />
      <CampoContrasena
        etiqueta="Contraseña"
        autoComplete="current-password"
        valor={contrasena}
        alCambiar={setContrasena}
        error={faltan.contrasena}
      />
      <CasillaRecordar marcada={recordar} alCambiar={setRecordar} />
      <Boton type="submit" tamano="lg" cargando={enviando} className={estilos.enviar}>
        Entrar
        <ArrowRight aria-hidden="true" size={18} />
      </Boton>
      <p className={estilos.alterno}>
        ¿Primera vez aquí?{' '}
        <button type="button" className={estilos.enlaceTexto} onClick={alCrearCuenta}>
          Crea tu avatar
        </button>
      </p>
      <p className={estilos.nota}>
        ¿Olvidaste tu contraseña? Como no pedimos correo ni teléfono, no se puede recuperar en
        línea: pide ayuda a quien administra la plataforma.
      </p>
    </form>
  );
}

// ─── Caso C: cuenta nueva ────────────────────────────────────────────────────

const PATRON_ALIAS = /^[\p{L}\p{N}_.-]+$/u;

type ErroresRegistro = Partial<
  Record<'alias' | 'rango' | 'intereses' | 'contrasena' | 'avatar', string>
>;

function validarRegistro(datos: {
  alias: string;
  rango: CodigoRango | null;
  contrasena: string;
}): ErroresRegistro {
  const errores: ErroresRegistro = {};
  const alias = datos.alias.trim();
  if (alias.length < 3) errores.alias = 'Usa al menos 3 caracteres.';
  else if (alias.length > 30) errores.alias = 'Usa máximo 30 caracteres.';
  else if (!PATRON_ALIAS.test(alias)) {
    errores.alias = 'Usa solo letras, números, punto, guion o guion bajo, sin espacios.';
  }
  if (!datos.rango) errores.rango = 'Elige tu rango de edad.';
  if (datos.contrasena.length < 8) errores.contrasena = 'Usa al menos 8 caracteres.';
  else if (datos.contrasena.length > 128) errores.contrasena = 'Usa máximo 128 caracteres.';
  else if (alias && datos.contrasena.toLowerCase().includes(alias.toLowerCase())) {
    errores.contrasena = 'Tu contraseña no puede contener tu nametag.';
  }
  return errores;
}

/** Una combinación al azar del catálogo, para empezar con un avatar ya armado. */
function avatarAlAzar(catalogo: ElementoAvatar[]): ConfiguracionAvatar {
  const alAzar = (tipo: TipoElemento, opcional = false) => {
    const opciones: (string | null)[] = catalogo.filter((e) => e.tipo === tipo).map((e) => e.id);
    if (opcional) opciones.push(null);
    return opciones[Math.floor(Math.random() * opciones.length)] ?? null;
  };
  return {
    personaje: alAzar('personaje') ?? '',
    cabello: alAzar('cabello', true),
    rasgos: alAzar('rasgo'),
    prenda: alAzar('prenda'),
    accesorio: alAzar('accesorio', true),
  };
}

type Opciones = { rangos: RangoEdad[]; catalogo: ElementoAvatar[] };

function FormularioRegistro({
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

  const [avatar, setAvatar] = useState<ConfiguracionAvatar | null>(null);
  const [alias, setAlias] = useState('');
  const [rango, setRango] = useState<CodigoRango | null>(null);
  const [intereses, setIntereses] = useState<string[]>([]);
  const [otro, setOtro] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [recordar, setRecordar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<ErroresRegistro>({});
  const idRango = useId();
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

  if (errorCarga) {
    return <EstadoError alReintentar={() => setIntento((n) => n + 1)}>{errorCarga}</EstadoError>;
  }
  if (!opciones || !avatar) return <CargandoLista filas={2} etiqueta="Preparando tu avatar…" />;
  const { rangos, catalogo } = opciones;

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
    const hobby = otro.trim().replace(/\s+/g, ' ');
    if (hobby.length < 2 || hobby.length > 30) {
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

  /** Lleva el foco al primer campo con error (tras pintarse), para no buscarlo a ciegas. */
  function enfocarPrimerError(formulario: HTMLFormElement) {
    requestAnimationFrame(() =>
      formulario
        .querySelector<HTMLElement>('[aria-invalid="true"], [data-con-error="true"] input')
        ?.focus(),
    );
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando || !avatar) return;
    const formulario = evento.currentTarget;
    const locales = validarRegistro({ alias, rango, contrasena });
    setErrores(locales);
    if (Object.keys(locales).length > 0) {
      setError('Revisa los campos marcados y vuelve a intentarlo.');
      enfocarPrimerError(formulario);
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
      setError(mensajeDeError(e));
      setEnviando(false);
      enfocarPrimerError(formulario);
    }
  }

  const sugeridos = [
    ...HOBBIES_SUGERIDOS,
    ...intereses.filter((h) => !HOBBIES_SUGERIDOS.some((s) => s.toLowerCase() === h.toLowerCase())),
  ];
  const personalizacion = CATEGORIAS.filter((c) => c.capa !== 'personaje' && c.capa !== 'cabello');

  return (
    <form className={estilos.registro} onSubmit={enviar} noValidate>
      <section className={estilos.vistaPrevia} aria-labelledby="titulo-tu-avatar">
        <h2 id="titulo-tu-avatar" className={estilos.tituloPaso}>
          Tu avatar
        </h2>
        <div className={estilos.lienzo}>
          <Avatar
            apariencia={aparienciaDe(avatar, catalogo)}
            tamano={112}
            etiqueta="Vista previa de tu avatar"
          />
        </div>
        <strong className={estilos.nombre}>{alias.trim() || 'Tu nametag'}</strong>
        <Boton variante="secundario" tamano="sm" onClick={() => setAvatar(avatarAlAzar(catalogo))}>
          <Shuffle aria-hidden="true" size={16} />
          Sorpréndeme
        </Boton>
        {errores.avatar && (
          <p className={estilos.errorGrupo} role="alert">
            {errores.avatar}
          </p>
        )}
      </section>

      <div className={estilos.pasos}>
        {error && <Aviso tono="peligro">{error}</Aviso>}

        <div className={estilos.capas}>
          {CATEGORIAS.filter((c) => c.capa === 'personaje' || c.capa === 'cabello').map((c) => (
            <SelectorCapa
              key={c.capa}
              {...c}
              opciones={catalogo.filter((e) => e.tipo === c.tipo)}
              borrador={avatar}
              catalogo={catalogo}
              deshabilitado={enviando}
              alElegir={(id) => setAvatar({ ...avatar, [c.capa]: id })}
            />
          ))}
          <details className={estilos.masDetalles}>
            <summary>Más detalles: rasgos, prenda y accesorio</summary>
            <div className={estilos.capas}>
              {personalizacion.map((c) => (
                <SelectorCapa
                  key={c.capa}
                  {...c}
                  opciones={catalogo.filter((e) => e.tipo === c.tipo)}
                  borrador={avatar}
                  catalogo={catalogo}
                  deshabilitado={enviando}
                  alElegir={(id) => setAvatar({ ...avatar, [c.capa]: id })}
                />
              ))}
            </div>
          </details>
        </div>

        <div className={estilos.grupo}>
          <CampoTexto
            etiqueta="Nametag"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={30}
            obligatorio
            ayuda="Es tu nombre público en la comunidad. No uses tu nombre real ni datos de contacto."
            value={alias}
            onChange={(e) => {
              setAlias(e.target.value);
              quitarError('alias');
            }}
            error={errores.alias}
          />
        </div>

        <fieldset
          className={estilos.grupo}
          data-con-error={errores.rango ? true : undefined}
          aria-describedby={[`${idRango}-ayuda`, errores.rango && `${idRango}-error`]
            .filter(Boolean)
            .join(' ')}
        >
          <legend className={estilos.leyenda}>
            Tu rango de edad <span className={estilos.marca}>Obligatorio</span>
          </legend>
          <p id={`${idRango}-ayuda`} className={estilos.ayuda}>
            Te ubica en la comunidad de tu edad. Solo se guarda el rango, nunca tu edad exacta, y
            después no se puede cambiar.
          </p>
          <div className={estilos.rangos}>
            {rangos.map((r) => (
              <label key={r.codigo} className={estilos.rango}>
                <input
                  type="radio"
                  name={idRango}
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
          {errores.rango && (
            <p id={`${idRango}-error`} className={estilos.errorGrupo} role="alert">
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
            {sugeridos.map((hobby) => {
              const elegido = intereses.some((h) => h.toLowerCase() === hobby.toLowerCase());
              return (
                <button
                  key={hobby}
                  type="button"
                  className={estilos.chip}
                  aria-pressed={elegido}
                  disabled={!elegido && intereses.length >= MAXIMO_HOBBIES}
                  onClick={() => alternarHobby(hobby)}
                >
                  {elegido ? (
                    <Check aria-hidden="true" size={14} />
                  ) : (
                    <Plus aria-hidden="true" size={14} />
                  )}
                  {hobby}
                </button>
              );
            })}
          </div>
          <div className={estilos.otro}>
            <CampoTexto
              etiqueta="¿Otro hobby?"
              maxLength={30}
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
          {errores.intereses && (
            <p className={estilos.errorGrupo} role="alert">
              {errores.intereses}
            </p>
          )}
        </fieldset>

        <div className={estilos.grupo}>
          <CampoContrasena
            etiqueta="Contraseña"
            autoComplete="new-password"
            obligatorio
            ayuda="Mínimo 8 caracteres y que no contenga tu nametag. Una frase corta es fácil de recordar."
            valor={contrasena}
            alCambiar={(valor) => {
              setContrasena(valor);
              quitarError('contrasena');
            }}
            error={errores.contrasena}
          />
          <CasillaRecordar marcada={recordar} alCambiar={setRecordar} />
        </div>

        <Boton type="submit" tamano="lg" cargando={enviando} className={estilos.enviar}>
          Crear mi cuenta y entrar
          <ArrowRight aria-hidden="true" size={18} />
        </Boton>
        <p className={estilos.alterno}>
          ¿Ya tienes cuenta?{' '}
          <button type="button" className={estilos.enlaceTexto} onClick={alTenerCuenta}>
            Entra con tu nametag
          </button>
        </p>
      </div>
    </form>
  );
}
