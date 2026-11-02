'use client';

import { Check, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { useSesion } from '@/components/sesion/ProveedorSesion';
import { Aviso, Boton, CargandoLista, EnlaceVolver, useNotificar } from '@/components/ui';
import {
  guardarMiAvatar,
  obtenerMiAvatar,
  type Capa,
  type ConfiguracionAvatar,
  type ElementoAvatar,
} from '@/lib/api/avatar';
import { mensajeDeError } from '@/lib/api/cliente';
import { ControlesPersonaje, EscenarioPersonaje } from './CreadorPersonaje';
import { avatarAlAzar, configuracionAEditar, mismaConfiguracion } from './opciones';
import estilos from './EditorAvatar.module.css';

type Mensaje = { tono: 'exito' | 'peligro'; texto: string } | null;

/**
 * «Mi avatar» (F36): el mismo creador de personaje del registro, abierto con el personaje que ya
 * está guardado. Los cambios viven en un borrador hasta pulsar «Guardar»: deshacer o salir de la
 * página no toca el avatar guardado. Solo hay opciones del catálogo cerrado y gratuito: no
 * existe forma de subir una imagen ni de escribir texto en el avatar.
 */
export function EditorAvatar() {
  const { usuario, puede } = useSesion();
  const [catalogo, setCatalogo] = useState<ElementoAvatar[] | null>(null);
  const [guardada, setGuardada] = useState<ConfiguracionAvatar | null>(null);
  const [borrador, setBorrador] = useState<ConfiguracionAvatar | null>(null);
  const [capaActiva, setCapaActiva] = useState<Capa>('personaje');
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<Mensaje>(null);
  const notificar = useNotificar();

  useEffect(() => {
    let vigente = true;
    obtenerMiAvatar()
      .then(({ configuracion, catalogo }) => {
        if (!vigente) return;
        const inicial = configuracionAEditar(configuracion, catalogo);
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
  const hayCambios = !mismaConfiguracion(borrador, guardada);

  const cambiar = (configuracion: ConfiguracionAvatar) => {
    setBorrador(configuracion);
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
        Te representa junto a tu nametag en tu perfil, los hilos y las salas. Todo es gratis y se
        arma solo con estas opciones: no se pueden subir fotos ni escribir texto.
      </EncabezadoPagina>

      {!puedePersonalizar && (
        <Aviso tono="info">Tu rol puede ver su avatar, pero no personalizarlo.</Aviso>
      )}

      <div className={estilos.creador}>
        <aside className={estilos.escenario} aria-label="Tu personaje">
          <EscenarioPersonaje
            configuracion={borrador}
            catalogo={catalogo}
            alias={usuario?.alias ?? ''}
            alSorprender={puedePersonalizar ? () => cambiar(avatarAlAzar(catalogo)) : undefined}
            deshabilitado={guardando}
          />
          <p className={estilos.estado} aria-live="polite">
            {hayCambios
              ? 'Tienes cambios sin guardar.'
              : 'Si estás en una sala, el cambio se verá la próxima vez que entres.'}
          </p>
        </aside>

        <div className={estilos.panel}>
          {mensaje && <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>}
          <header className={estilos.encabezado}>
            <h2>Personaliza tu personaje</h2>
            <p>Usa las flechas para cambiar cada característica.</p>
          </header>
          <ControlesPersonaje
            configuracion={borrador}
            catalogo={catalogo}
            activa={capaActiva}
            alCambiarActiva={setCapaActiva}
            alElegir={(capa, valor) => cambiar({ ...borrador, [capa]: valor })}
            deshabilitado={!puedePersonalizar || guardando}
          />
          {puedePersonalizar && (
            <div className={estilos.acciones}>
              <Boton
                variante="secundario"
                tamano="lg"
                className={estilos.deshacer}
                onClick={() => cambiar(guardada)}
                disabled={!hayCambios || guardando}
              >
                <RotateCcw aria-hidden="true" size={18} />
                Deshacer
              </Boton>
              <Boton
                tamano="lg"
                className={estilos.guardar}
                onClick={guardar}
                cargando={guardando}
                disabled={!hayCambios}
              >
                <Check aria-hidden="true" size={18} />
                Guardar avatar
              </Boton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
