'use client';

import { ElementoEscalonado, ListaEscalonada } from '@/components/movimiento/Escalonado';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Library, ShieldCheck, UserCog } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso, Boton, BotonEnlace, CargandoLista, EstadoError } from '@/components/ui';
import { ErrorApi, mensajeDeError } from '@/lib/api/cliente';
import {
  listarUsuariosDemo,
  NOMBRES_ROL,
  type SesionPublica,
  type UsuarioDemo,
} from '@/lib/api/sesion';
import comun from '../comun.module.css';
import { useSesion } from './ProveedorSesion';
import estilos from './SelectorAcceso.module.css';

/** Solo rutas internas: evita redirecciones abiertas a otros sitios. */
const rutaSegura = (ruta: string | null) =>
  ruta && ruta.startsWith('/') && !ruta.startsWith('//') ? ruta : null;

function destinoInicial(usuario: SesionPublica): string {
  if (usuario.comunidad) return '/comunidad';
  if (usuario.permisos.includes('revisar_reportes')) return '/panel';
  if (usuario.permisos.includes('gestionar_fuentes')) return '/gestion/fuentes';
  return '/perfil';
}

type Carga =
  | { estado: 'cargando' }
  | { estado: 'listo'; usuarios: UsuarioDemo[] }
  | { estado: 'deshabilitado' }
  | { estado: 'error'; mensaje: string };

export function SelectorAcceso() {
  const { usuario, entrar, salir } = useSesion();
  const router = useRouter();
  const siguiente = rutaSegura(useSearchParams().get('siguiente'));
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
  const [entrando, setEntrando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    listarUsuariosDemo()
      .then(({ usuarios }) => vigente && setCarga({ estado: 'listo', usuarios }))
      .catch((e: unknown) => {
        if (!vigente) return;
        setCarga(
          e instanceof ErrorApi && e.estado === 404
            ? { estado: 'deshabilitado' }
            : { estado: 'error', mensaje: mensajeDeError(e) },
        );
      });
    return () => {
      vigente = false;
    };
  }, []);

  async function entrarComo(codigo: string) {
    setEntrando(codigo);
    setError(null);
    try {
      const nuevo = await entrar(codigo);
      router.push(siguiente ?? destinoInicial(nuevo));
    } catch (e) {
      setError(mensajeDeError(e));
      setEntrando(null);
    }
  }

  const jovenes = carga.estado === 'listo' ? carga.usuarios.filter((u) => u.rol === 'usuario') : [];
  const personal =
    carga.estado === 'listo' ? carga.usuarios.filter((u) => u.rol !== 'usuario') : [];

  return (
    <div className={comun.paginaAncha}>
      <EncabezadoPagina antetitulo="Acceso de demostración" titulo="Elige un usuario de prueba">
        Cada usuario es sintético. Al entrar, el sistema te ubica en la comunidad de su rango de
        edad y solo verás ese espacio.
      </EncabezadoPagina>

      <Aviso tono="advertencia" titulo="Solo para la demostración del prototipo">
        No hay contraseñas ni cuentas reales, y el rango de edad viene del usuario de prueba: esto
        <strong> no es una verificación de edad</strong>. El mecanismo definitivo está pendiente.
      </Aviso>

      {usuario && (
        <Aviso tono="info" titulo={`Ya entraste como ${usuario.alias}`}>
          <div className={comun.fila}>
            <BotonEnlace href={siguiente ?? destinoInicial(usuario)} tamano="sm">
              Continuar
            </BotonEnlace>
            <Boton variante="secundario" tamano="sm" onClick={() => void salir('/acceso')}>
              Salir y elegir otro
            </Boton>
          </div>
        </Aviso>
      )}

      {error && <Aviso tono="peligro">{error}</Aviso>}
      {carga.estado === 'cargando' && (
        <CargandoLista filas={2} etiqueta="Cargando usuarios de prueba…" alto="5.5rem" />
      )}
      {carga.estado === 'error' && (
        <EstadoError alReintentar={() => window.location.reload()}>{carga.mensaje}</EstadoError>
      )}
      {carga.estado === 'deshabilitado' && (
        <Aviso tono="info">El acceso de demostración está deshabilitado en este entorno.</Aviso>
      )}

      {carga.estado === 'listo' && (
        <>
          <GrupoUsuarios
            titulo="Jóvenes"
            descripcion="Uno por cada comunidad. Cada piso es un rango de edad."
            usuarios={jovenes}
            entrando={entrando}
            alElegir={entrarComo}
          />
          <GrupoUsuarios
            titulo="Personal de la plataforma"
            descripcion="Sin comunidad propia: trabajan desde el panel."
            usuarios={personal}
            entrando={entrando}
            alElegir={entrarComo}
          />
        </>
      )}
    </div>
  );
}

const ICONO_ROL = {
  admin_plataforma: UserCog,
  moderador: ShieldCheck,
  gestor_fuentes: Library,
} as const;

function GrupoUsuarios({
  titulo,
  descripcion,
  usuarios,
  entrando,
  alElegir,
}: {
  titulo: string;
  descripcion: string;
  usuarios: UsuarioDemo[];
  entrando: string | null;
  alElegir: (codigo: string) => void;
}) {
  return (
    <section className={estilos.grupo} aria-label={titulo}>
      <div>
        <h2 className={estilos.tituloGrupo}>{titulo}</h2>
        <p className={estilos.detalle}>{descripcion}</p>
      </div>
      <ListaEscalonada className={estilos.usuarios}>
        {usuarios.map((u) => (
          <ElementoEscalonado key={u.codigo}>
            <button
              type="button"
              className={`${estilos.usuario} con-luz`}
              onClick={() => alElegir(u.codigo)}
              disabled={entrando !== null}
              aria-busy={entrando === u.codigo || undefined}
            >
              <span
                className={`${estilos.piso} ${u.comunidad ? estilos[`piso${u.comunidad.slice(-1)}`] : ''}`}
                aria-hidden="true"
              >
                {u.comunidad
                  ? u.comunidad.slice(-1)
                  : (() => {
                      const Icono = ICONO_ROL[u.rol as keyof typeof ICONO_ROL] ?? UserCog;
                      return <Icono size={22} />;
                    })()}
              </span>
              <span className={estilos.textos}>
                <span className={estilos.alias}>{u.alias}</span>
                <span className={estilos.detalle}>
                  {u.rango ? `${u.comunidad}, ${u.rango}` : NOMBRES_ROL[u.rol]}
                </span>
                <span className={estilos.codigo}>
                  {entrando === u.codigo ? 'Entrando…' : u.codigo}
                </span>
              </span>
              {entrando === u.codigo ? (
                <span className={estilos.indicador} aria-hidden="true" />
              ) : (
                <ArrowRight aria-hidden="true" size={20} className={estilos.flecha} />
              )}
            </button>
          </ElementoEscalonado>
        ))}
      </ListaEscalonada>
    </section>
  );
}
