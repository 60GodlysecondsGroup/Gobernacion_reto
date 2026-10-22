'use client';

import { useEffect, useId, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { useSesion } from '@/components/sesion/ProveedorSesion';
import { Aviso, Boton, CargandoLista, EnlaceVolver, useNotificar } from '@/components/ui';
import {
  guardarMiAvatar,
  obtenerMiAvatar,
  type Apariencia,
  type Capa,
  type ConfiguracionAvatar,
  type ElementoAvatar,
  type TipoElemento,
} from '@/lib/api/avatar';
import { mensajeDeError } from '@/lib/api/cliente';
import comun from '../comun.module.css';
import { Avatar } from './Avatar';
import estilos from './EditorAvatar.module.css';

/** Las cinco capas que se eligen, en orden. Cabello y accesorio admiten «ninguno». */
const CATEGORIAS: { capa: Capa; tipo: TipoElemento; titulo: string; ninguno?: string }[] = [
  { capa: 'personaje', tipo: 'personaje', titulo: 'Personaje base' },
  { capa: 'cabello', tipo: 'cabello', titulo: 'Cabello', ninguno: 'Sin cabello' },
  { capa: 'rasgos', tipo: 'rasgo', titulo: 'Rasgos' },
  { capa: 'prenda', tipo: 'prenda', titulo: 'Prenda' },
  { capa: 'accesorio', tipo: 'accesorio', titulo: 'Accesorio', ninguno: 'Ninguno' },
];

/** Traduce identificadores del catálogo a los recursos que se dibujan. */
function aparienciaDe(configuracion: ConfiguracionAvatar, catalogo: ElementoAvatar[]): Apariencia {
  const recurso = (id: string | null) =>
    id === null ? null : (catalogo.find((elemento) => elemento.id === id)?.recurso ?? null);
  return {
    personaje: recurso(configuracion.personaje) ?? '',
    cabello: recurso(configuracion.cabello),
    rasgos: recurso(configuracion.rasgos),
    prenda: recurso(configuracion.prenda),
    accesorio: recurso(configuracion.accesorio),
  };
}

/** Sin avatar guardado se parte del primer elemento de cada capa obligatoria. */
function configuracionInicial(catalogo: ElementoAvatar[]): ConfiguracionAvatar {
  const primero = (tipo: TipoElemento) => catalogo.find((e) => e.tipo === tipo)?.id ?? null;
  return {
    personaje: primero('personaje') ?? '',
    cabello: primero('cabello'),
    rasgos: primero('rasgo'),
    prenda: primero('prenda'),
    accesorio: null,
  };
}

const iguales = (a: ConfiguracionAvatar, b: ConfiguracionAvatar) =>
  CATEGORIAS.every(({ capa }) => a[capa] === b[capa]);

type Mensaje = { tono: 'exito' | 'peligro'; texto: string } | null;

/**
 * «Mi avatar» (F36): elegir personaje base, cabello, rasgos, prenda y accesorio de un catálogo
 * cerrado y gratuito, con vista previa en vivo. Solo hay opciones del catálogo: no existe forma
 * de subir una imagen ni de escribir texto en el avatar.
 */
export function EditorAvatar() {
  const { usuario, puede } = useSesion();
  const [catalogo, setCatalogo] = useState<ElementoAvatar[] | null>(null);
  const [guardada, setGuardada] = useState<ConfiguracionAvatar | null>(null);
  const [borrador, setBorrador] = useState<ConfiguracionAvatar | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<Mensaje>(null);
  const notificar = useNotificar();

  useEffect(() => {
    let vigente = true;
    obtenerMiAvatar()
      .then(({ configuracion, catalogo }) => {
        if (!vigente) return;
        const inicial = configuracion ?? configuracionInicial(catalogo);
        setCatalogo(catalogo);
        setGuardada(inicial);
        setBorrador(inicial);
      })
      .catch((e: unknown) => vigente && setErrorCarga(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, []);

  if (errorCarga) return <Aviso tono="peligro">{errorCarga}</Aviso>;
  if (!catalogo || !guardada || !borrador) {
    return <CargandoLista etiqueta="Cargando tu avatar…" />;
  }

  const puedePersonalizar = puede('personalizar_avatar_propio');
  const hayCambios = !iguales(borrador, guardada);

  const elegir = (capa: Capa, id: string | null) => {
    setBorrador({ ...borrador, [capa]: id });
    setMensaje(null);
  };

  async function guardar() {
    if (!borrador) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const { configuracion } = await guardarMiAvatar(borrador);
      setGuardada(configuracion);
      setBorrador(configuracion);
      notificar('exito', 'Avatar guardado', 'Se verá en tus hilos y al entrar a una sala.');
    } catch (e) {
      setMensaje({ tono: 'peligro', texto: mensajeDeError(e) });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className={estilos.pagina}>
      <nav aria-label="Ruta">
        <EnlaceVolver href="/perfil">Volver a mi perfil</EnlaceVolver>
      </nav>
      <EncabezadoPagina antetitulo="Identidad protegida" titulo="Mi avatar">
        Tu avatar te representa junto a tu alias en tu perfil, en los hilos, en las respuestas y en
        las salas. Todo es gratis y se arma solo con estas opciones: no se pueden subir fotos ni
        escribir texto en el avatar.
      </EncabezadoPagina>

      {!puedePersonalizar && (
        <Aviso tono="info">Tu rol puede ver su avatar, pero no personalizarlo.</Aviso>
      )}

      <div className={estilos.distribucion}>
        <section className={estilos.vistaPrevia} aria-labelledby="titulo-vista-previa">
          <h2 id="titulo-vista-previa" className={estilos.tituloSeccion}>
            Vista previa
          </h2>
          <div className={estilos.lienzo}>
            <Avatar
              apariencia={aparienciaDe(borrador, catalogo)}
              tamano={128}
              etiqueta="Vista previa de tu avatar"
            />
          </div>
          <strong className={estilos.alias}>{usuario?.alias}</strong>
          {mensaje && <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>}
          {puedePersonalizar && (
            <div className={estilos.acciones}>
              <Boton onClick={guardar} cargando={guardando} disabled={!hayCambios}>
                Guardar avatar
              </Boton>
              <Boton
                variante="fantasma"
                onClick={() => {
                  setBorrador(guardada);
                  setMensaje(null);
                }}
                disabled={!hayCambios || guardando}
              >
                Deshacer cambios
              </Boton>
            </div>
          )}
          <p className={comun.suave}>
            {hayCambios
              ? 'Tienes cambios sin guardar.'
              : 'Si estás en una sala, el cambio se verá la próxima vez que entres.'}
          </p>
        </section>

        <div className={estilos.categorias}>
          {CATEGORIAS.map((categoria) => (
            <SelectorCapa
              key={categoria.capa}
              {...categoria}
              opciones={catalogo.filter((elemento) => elemento.tipo === categoria.tipo)}
              borrador={borrador}
              catalogo={catalogo}
              deshabilitado={!puedePersonalizar}
              alElegir={(id) => elegir(categoria.capa, id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Una capa: cada opción muestra el avatar actual con esa opción aplicada. */
function SelectorCapa({
  capa,
  titulo,
  ninguno,
  opciones,
  borrador,
  catalogo,
  deshabilitado,
  alElegir,
}: {
  capa: Capa;
  titulo: string;
  ninguno?: string;
  opciones: ElementoAvatar[];
  borrador: ConfiguracionAvatar;
  catalogo: ElementoAvatar[];
  deshabilitado: boolean;
  alElegir: (id: string | null) => void;
}) {
  const grupo = useId();
  const valores: { id: string | null; nombre: string }[] = [
    ...(ninguno ? [{ id: null, nombre: ninguno }] : []),
    ...opciones,
  ];

  return (
    <fieldset className={estilos.capa} disabled={deshabilitado}>
      <legend className={estilos.tituloSeccion}>{titulo}</legend>
      <div className={estilos.opciones}>
        {valores.map((valor) => (
          <label key={valor.id ?? 'ninguno'} className={estilos.opcion}>
            <input
              type="radio"
              name={grupo}
              checked={borrador[capa] === valor.id}
              onChange={() => alElegir(valor.id)}
            />
            <Avatar
              apariencia={aparienciaDe(
                // Las opciones de cabello se muestran sin accesorio: una gorra las taparía.
                { ...borrador, [capa]: valor.id, ...(capa === 'cabello' && { accesorio: null }) },
                catalogo,
              )}
              tamano={44}
            />
            <span>{valor.nombre}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
