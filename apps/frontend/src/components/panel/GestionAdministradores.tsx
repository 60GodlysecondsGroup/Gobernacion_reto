'use client';

import { KeyRound, Pencil, ShieldUser, UserPlus } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { CampoContrasena } from '@/components/sesion/PiezasAcceso';
import { useSesion } from '@/components/sesion/ProveedorSesion';
import {
  Aviso,
  Boton,
  CampoTexto,
  ConfirmarAccion,
  Dialogo,
  Insignia,
  Tarjeta,
  useNotificar,
} from '@/components/ui';
import {
  NOMBRE_ESTADO_USUARIO,
  type EstadoUsuario,
  type RolPersonal,
} from '@/lib/api/administracion';
import { campoDelError, erroresPorCampo, mensajeDeError } from '@/lib/api/cliente';
import { NOMBRES_ROL } from '@/lib/api/sesion';
import {
  cambiarEstadoAdministrador,
  cambiarRolAdministrador,
  crearAdministrador,
  listarAdministradores,
  restablecerContrasenaAdministrador,
  actualizarAdministrador,
  type CuentaAdministracion,
  type DatosCuentaAdministracion,
  type RolAdministracion,
} from '@/lib/api/superadmin';
import { formatearFechaHora } from '@/lib/fechas';
import propios from './GestionAdministradores.module.css';
import personal from './GestionPersonal.module.css';
import estilos from './Panel.module.css';
import { RegistroAcciones } from './RegistroAcciones';
import {
  enfocarPrimerError,
  problemaCorreo,
  problemaNombre,
  problemasContrasena,
} from './validacionCuentas';

const TONO: Record<EstadoUsuario, 'exito' | 'advertencia' | 'peligro'> = {
  activo: 'exito',
  suspendido: 'advertencia',
  bloqueado: 'peligro',
};

/** Lo que puede hacer cada rol, para elegirlo sabiendo qué se asigna. */
const ROLES_ADMINISTRACION: { rol: RolAdministracion; descripcion: string }[] = [
  {
    rol: 'admin_plataforma',
    descripcion:
      'Panel completo: usuarios, cuentas de personal, salas, comunidades, reglas DLP y registro. No gestiona cuentas de administración.',
  },
  {
    rol: 'superadmin',
    descripcion:
      'Todo lo anterior y, además, esta sección: crea, edita, activa, desactiva y cambia el rol de las cuentas de administración.',
  },
];

/** Revocar la administración sin borrar la cuenta: pasa a un rol de personal. */
const ROLES_REVOCACION: { rol: RolPersonal; descripcion: string }[] = [
  {
    rol: 'moderador',
    descripcion: 'Pierde la administración y queda como moderación (Cuentas de personal).',
  },
  {
    rol: 'gestor_fuentes',
    descripcion: 'Pierde la administración y queda como gestión de fuentes (Cuentas de personal).',
  },
];

const NIVEL: Record<RolAdministracion | RolPersonal, number> = {
  superadmin: 3,
  admin_plataforma: 2,
  moderador: 1,
  gestor_fuentes: 1,
};

type Formulario = Omit<DatosCuentaAdministracion, 'rol'> & { rol: RolAdministracion | null };
type ErroresCuenta = Partial<Record<keyof DatosCuentaAdministracion, string>>;

const VACIO: Formulario = { nombre: '', correo: '', contrasena: '', confirmacion: '', rol: null };

/** Quita las claves sin mensaje: así «hay errores» es «hay claves». */
const soloConMensaje = <T extends Record<string, string | undefined>>(errores: T) =>
  Object.fromEntries(Object.entries(errores).filter(([, mensaje]) => mensaje)) as Partial<T>;

type Ventana =
  | { tipo: 'editar'; cuenta: CuentaAdministracion }
  | { tipo: 'contrasena'; cuenta: CuentaAdministracion }
  | { tipo: 'rol'; cuenta: CuentaAdministracion }
  | { tipo: 'desactivar'; cuenta: CuentaAdministracion };

/**
 * Sección Superadmin (`gestionar_administradores`): cuentas de administración de la plataforma.
 * Ocultarla en la interfaz es solo comodidad: el backend comprueba el permiso, la identidad, el
 * estado de quien actúa y que nunca falte un superadministrador activo en cada llamada.
 */
export function GestionAdministradores() {
  const { usuario: yo } = useSesion();
  const [cuentas, setCuentas] = useState<CuentaAdministracion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [ventana, setVentana] = useState<Ventana | null>(null);
  const [creando, setCreando] = useState(false);
  // Al cambiar algo, el registro de cambios se vuelve a montar para mostrarlo.
  const [version, setVersion] = useState(0);
  const notificar = useNotificar();

  useEffect(() => {
    let vigente = true;
    listarAdministradores()
      .then((r) => vigente && setCuentas(r.cuentas))
      .catch((e: unknown) => vigente && setError(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, []);

  /** Reemplaza la cuenta en la lista (o la quita si ya no es de administración). */
  const reemplazar = (id: string, cuenta: CuentaAdministracion | null) => {
    setCuentas(
      (lista) => lista?.flatMap((c) => (c.id !== id ? [c] : cuenta ? [cuenta] : [])) ?? null,
    );
    setVersion((v) => v + 1);
  };

  async function ejecutar(id: string, trabajo: () => Promise<string>) {
    setOcupado(id);
    setError(null);
    try {
      notificar('exito', await trabajo());
      setVentana(null);
    } catch (e) {
      setError(mensajeDeError(e));
      setVentana(null);
    } finally {
      setOcupado(null);
    }
  }

  const cambiarEstado = (cuenta: CuentaAdministracion, estado: 'activo' | 'suspendido') =>
    ejecutar(cuenta.id, async () => {
      const r = await cambiarEstadoAdministrador(cuenta.id, estado);
      reemplazar(cuenta.id, r.cuenta);
      return estado === 'activo'
        ? `La cuenta de ${cuenta.nombre} está activa de nuevo: tendrá que volver a entrar.`
        : `La cuenta de ${cuenta.nombre} quedó desactivada y se cerraron sus sesiones.`;
    });

  const sinCorreo = cuentas?.filter((c) => !c.correo) ?? [];

  return (
    <>
      <EncabezadoPagina
        antetitulo="Superadministración"
        titulo="Cuentas de administración"
        acciones={
          <Boton onClick={() => setCreando(true)} aria-expanded={creando}>
            <UserPlus aria-hidden="true" size={18} />
            Nueva cuenta
          </Boton>
        }
      >
        Solo la superadministración ve esta sección. Estas cuentas entran con su correo y contraseña
        en «Acceso del equipo». Nadie puede cambiar su propia cuenta desde aquí y la plataforma
        siempre conserva al menos un superadministrador activo.
      </EncabezadoPagina>

      {error && <Aviso tono="peligro">{error}</Aviso>}

      {sinCorreo.length > 0 && (
        <Aviso tono="advertencia" titulo="Cuentas por regularizar">
          {sinCorreo.map((c) => c.nombre).join(', ')}{' '}
          {sinCorreo.length === 1 ? 'no tiene' : 'no tienen'} correo: solo{' '}
          {sinCorreo.length === 1 ? 'entra' : 'entran'} con su nametag. Usa «Editar» para asignar un
          correo y «Contraseña» para definir una nueva; desde entonces entrará por «Acceso del
          equipo».
        </Aviso>
      )}

      {creando && (
        <FormularioCuentaNueva
          alCerrar={() => setCreando(false)}
          alCrear={(cuenta) => {
            setCuentas((lista) => [cuenta, ...(lista ?? [])]);
            setVersion((v) => v + 1);
            setCreando(false);
            notificar(
              'exito',
              `Cuenta de ${cuenta.nombre} creada. Ya puede entrar con su correo en «Acceso del equipo».`,
            );
          }}
        />
      )}

      {!cuentas && !error && <span className="esqueleto" style={{ height: '12rem' }} />}

      {cuentas && cuentas.length > 0 && (
        <div className={estilos.tablaContenedor}>
          <table className={estilos.tabla}>
            <caption className="visualmente-oculto">Cuentas de administración</caption>
            <thead>
              <tr>
                <th scope="col">Cuenta</th>
                <th scope="col">Rol</th>
                <th scope="col">Estado</th>
                <th scope="col">Acceso</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cuentas.map((c) => {
                const propia = c.id === yo?.id;
                const bloqueado = ocupado !== null;
                return (
                  <tr key={c.id}>
                    <td className={propios.cuenta}>
                      <span className={estilos.enlaceFila}>
                        {c.nombre}
                        {propia && (
                          <span className={propios.tu}>
                            <Insignia tono="info">Tú</Insignia>
                          </span>
                        )}
                      </span>
                      <span className={personal.correo}>
                        {c.correo ?? <span className={personal.sinCorreo}>Sin correo</span>}
                      </span>
                    </td>
                    <td>
                      <Insignia tono={c.rol === 'superadmin' ? 'info' : 'neutro'}>
                        {NOMBRES_ROL[c.rol]}
                      </Insignia>
                    </td>
                    <td>
                      <Insignia tono={TONO[c.estado]}>{NOMBRE_ESTADO_USUARIO[c.estado]}</Insignia>
                    </td>
                    <td className={propios.acceso}>
                      {c.ultimoAcceso ? formatearFechaHora(c.ultimoAcceso) : 'Sin accesos'}
                      <span>
                        {c.sesionesAbiertas === 1
                          ? '1 sesión abierta'
                          : `${c.sesionesAbiertas} sesiones abiertas`}
                      </span>
                      {!c.tieneContrasena && <span>Sin contraseña: no puede entrar</span>}
                    </td>
                    <td>
                      {propia ? (
                        <span className={personal.sinCorreo}>
                          Tu cuenta: la gestiona otra persona con superadministración.
                        </span>
                      ) : (
                        <div className={propios.accionesFila}>
                          <Boton
                            tamano="sm"
                            variante="secundario"
                            disabled={bloqueado}
                            onClick={() => setVentana({ tipo: 'editar', cuenta: c })}
                          >
                            <Pencil aria-hidden="true" size={16} />
                            Editar
                            <span className="visualmente-oculto"> {c.nombre}</span>
                          </Boton>
                          <Boton
                            tamano="sm"
                            variante="secundario"
                            disabled={bloqueado}
                            onClick={() => setVentana({ tipo: 'contrasena', cuenta: c })}
                          >
                            <KeyRound aria-hidden="true" size={16} />
                            Contraseña
                            <span className="visualmente-oculto"> de {c.nombre}</span>
                          </Boton>
                          <Boton
                            tamano="sm"
                            variante="secundario"
                            disabled={bloqueado}
                            onClick={() => setVentana({ tipo: 'rol', cuenta: c })}
                          >
                            <ShieldUser aria-hidden="true" size={16} />
                            Rol
                            <span className="visualmente-oculto"> de {c.nombre}</span>
                          </Boton>
                          {c.estado === 'activo' ? (
                            <Boton
                              tamano="sm"
                              variante="secundario"
                              cargando={ocupado === c.id}
                              disabled={bloqueado}
                              onClick={() => setVentana({ tipo: 'desactivar', cuenta: c })}
                            >
                              Desactivar
                              <span className="visualmente-oculto"> {c.nombre}</span>
                            </Boton>
                          ) : (
                            <Boton
                              tamano="sm"
                              variante="secundario"
                              cargando={ocupado === c.id}
                              disabled={bloqueado}
                              onClick={() => void cambiarEstado(c, 'activo')}
                            >
                              Reactivar
                              <span className="visualmente-oculto"> {c.nombre}</span>
                            </Boton>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmarAccion
        abierto={ventana?.tipo === 'desactivar'}
        alCerrar={() => setVentana(null)}
        titulo="¿Desactivar la cuenta?"
        descripcion={
          ventana?.tipo === 'desactivar' &&
          `${ventana.cuenta.nombre} perderá el acceso de inmediato y se cerrarán sus sesiones abiertas. Puedes reactivarla cuando quieras.`
        }
        textoConfirmar="Desactivar"
        cargando={ventana !== null && ocupado === ventana.cuenta.id}
        alConfirmar={() => {
          if (ventana?.tipo === 'desactivar') void cambiarEstado(ventana.cuenta, 'suspendido');
        }}
      />

      {ventana?.tipo === 'editar' && (
        <DialogoEditar
          cuenta={ventana.cuenta}
          alCerrar={() => setVentana(null)}
          alGuardar={(cuenta) => {
            reemplazar(cuenta.id, cuenta);
            setVentana(null);
            notificar('exito', `Datos de ${cuenta.nombre} actualizados.`);
          }}
        />
      )}

      {ventana?.tipo === 'contrasena' && (
        <DialogoContrasena
          cuenta={ventana.cuenta}
          alCerrar={() => setVentana(null)}
          alGuardar={(cuenta) => {
            reemplazar(cuenta.id, cuenta);
            setVentana(null);
            notificar(
              'exito',
              `Contraseña de ${cuenta.nombre} restablecida y sus sesiones cerradas. Compártela por un canal seguro.`,
            );
          }}
        />
      )}

      {ventana?.tipo === 'rol' && (
        <DialogoRol
          cuenta={ventana.cuenta}
          alCerrar={() => setVentana(null)}
          alCambiar={(id, cuenta, mensaje) => {
            reemplazar(id, cuenta);
            setVentana(null);
            notificar('exito', mensaje);
          }}
        />
      )}

      <RegistroAcciones key={version} entidad="cuenta_administracion" incrustado />
    </>
  );
}

/** Errores del backend por campo (validación y conflictos) y su mensaje general. */
function erroresDeRespuesta<T extends string>(e: unknown) {
  const porCampo = erroresPorCampo(e) as Partial<Record<T, string>>;
  const campo = campoDelError(e);
  if (campo) porCampo[campo as T] = mensajeDeError(e);
  return porCampo;
}

/** Alta de una cuenta de administración, en una tarjeta dentro de la página. */
function FormularioCuentaNueva({
  alCerrar,
  alCrear,
}: {
  alCerrar: () => void;
  alCrear: (cuenta: CuentaAdministracion) => void;
}) {
  const [datos, setDatos] = useState<Formulario>(VACIO);
  const [errores, setErrores] = useState<ErroresCuenta>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);
  const idRol = useId();

  useEffect(() => {
    formulario.current?.querySelector('input')?.focus();
  }, []);

  const cambiar = (clave: keyof Formulario, valor: string) => {
    setDatos((actual) => ({ ...actual, [clave]: valor }));
    setErrores((actuales) => ({ ...actuales, [clave]: undefined }));
  };

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;
    const locales: ErroresCuenta = soloConMensaje({
      nombre: problemaNombre(datos.nombre),
      correo: problemaCorreo(datos.correo),
      ...problemasContrasena(datos.contrasena, datos.confirmacion, datos.nombre),
      rol: datos.rol ? undefined : 'Elige el rol: administración o superadministración.',
    });
    setErrores(locales);
    if (Object.keys(locales).length > 0 || !datos.rol) {
      setError('Revisa los campos marcados y vuelve a intentarlo.');
      enfocarPrimerError(formulario.current);
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      const { cuenta } = await crearAdministrador({
        ...datos,
        nombre: datos.nombre.trim(),
        correo: datos.correo.trim(),
        rol: datos.rol,
      });
      alCrear(cuenta);
    } catch (e) {
      setErrores(erroresDeRespuesta<keyof DatosCuentaAdministracion>(e));
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tarjeta
      titulo="Nueva cuenta de administración"
      descripcion="Entrará con este correo y esta contraseña en «Acceso del equipo». Compártela por un canal seguro: después no se vuelve a mostrar."
    >
      <form ref={formulario} className={personal.formulario} onSubmit={enviar} noValidate>
        {error && <Aviso tono="peligro">{error}</Aviso>}
        <CampoTexto
          etiqueta="Nombre"
          obligatorio
          maxLength={30}
          autoComplete="off"
          ayuda="Nombre visible de la cuenta en el panel y en sus respuestas en la comunidad."
          value={datos.nombre}
          onChange={(e) => cambiar('nombre', e.target.value)}
          error={errores.nombre}
        />
        <CampoTexto
          etiqueta="Correo"
          type="email"
          obligatorio
          maxLength={254}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={datos.correo}
          onChange={(e) => cambiar('correo', e.target.value)}
          error={errores.correo}
        />
        <CampoContrasena
          etiqueta="Contraseña"
          autoComplete="new-password"
          obligatorio
          ayuda="Mínimo 8 caracteres y sin el nombre de la cuenta."
          valor={datos.contrasena}
          alCambiar={(valor) => cambiar('contrasena', valor)}
          error={errores.contrasena}
        />
        <CampoContrasena
          etiqueta="Confirmar contraseña"
          autoComplete="new-password"
          obligatorio
          valor={datos.confirmacion}
          alCambiar={(valor) => cambiar('confirmacion', valor)}
          error={errores.confirmacion}
        />
        <fieldset
          className={personal.roles}
          aria-invalid={errores.rol ? true : undefined}
          aria-describedby={errores.rol ? `${idRol}-error` : undefined}
        >
          <legend className={personal.leyenda}>
            Rol <span className={personal.marca}>Obligatorio</span>
          </legend>
          {ROLES_ADMINISTRACION.map(({ rol, descripcion }) => (
            <label key={rol} className={personal.rol}>
              <input
                type="radio"
                name={idRol}
                value={rol}
                checked={datos.rol === rol}
                onChange={() => cambiar('rol', rol)}
              />
              <span className={personal.nombreRol}>{NOMBRES_ROL[rol]}</span>
              <span className={personal.descripcionRol}>{descripcion}</span>
            </label>
          ))}
          {errores.rol && (
            <p id={`${idRol}-error`} className={personal.errorGrupo} role="alert">
              {errores.rol}
            </p>
          )}
        </fieldset>
        <div className={personal.acciones}>
          <Boton type="submit" cargando={enviando}>
            Crear cuenta
          </Boton>
          <Boton variante="secundario" onClick={() => !enviando && alCerrar()} disabled={enviando}>
            Cancelar
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

/** Nombre y correo. Asignar un correo regulariza una cuenta antigua que no lo tenía. */
function DialogoEditar({
  cuenta,
  alCerrar,
  alGuardar,
}: {
  cuenta: CuentaAdministracion;
  alCerrar: () => void;
  alGuardar: (cuenta: CuentaAdministracion) => void;
}) {
  const [nombre, setNombre] = useState(cuenta.nombre);
  const [correo, setCorreo] = useState(cuenta.correo ?? '');
  const [errores, setErrores] = useState<{ nombre?: string; correo?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const idFormulario = useId();

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;
    const cambios = {
      ...(nombre.trim() !== cuenta.nombre && { nombre: nombre.trim() }),
      ...(correo.trim().toLowerCase() !== (cuenta.correo ?? '') && { correo: correo.trim() }),
    };
    const locales = soloConMensaje({
      nombre: 'nombre' in cambios ? problemaNombre(nombre) : undefined,
      correo: 'correo' in cambios ? problemaCorreo(correo) : undefined,
    });
    setErrores(locales);
    if (Object.keys(locales).length > 0) return;
    if (Object.keys(cambios).length === 0) return alCerrar();

    setEnviando(true);
    setError(null);
    try {
      const r = await actualizarAdministrador(cuenta.id, cambios);
      alGuardar(r.cuenta);
    } catch (e) {
      setErrores(erroresDeRespuesta<'nombre' | 'correo'>(e));
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo
      abierto
      alCerrar={() => !enviando && alCerrar()}
      titulo={`Editar ${cuenta.nombre}`}
      descripcion={
        cuenta.correo
          ? 'Si cambias el correo, desde ahora entrará con el nuevo.'
          : 'Esta cuenta no tiene correo. Al asignarle uno dejará de entrar con su nametag y entrará por «Acceso del equipo».'
      }
      acciones={
        <>
          <Boton variante="secundario" onClick={alCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton type="submit" form={idFormulario} cargando={enviando}>
            Guardar
          </Boton>
        </>
      }
    >
      <form id={idFormulario} className={personal.formulario} onSubmit={enviar} noValidate>
        {error && <Aviso tono="peligro">{error}</Aviso>}
        <CampoTexto
          etiqueta="Nombre"
          obligatorio
          maxLength={30}
          autoComplete="off"
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value);
            setErrores((x) => ({ ...x, nombre: undefined }));
          }}
          error={errores.nombre}
        />
        <CampoTexto
          etiqueta="Correo"
          type="email"
          obligatorio
          maxLength={254}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={correo}
          onChange={(e) => {
            setCorreo(e.target.value);
            setErrores((x) => ({ ...x, correo: undefined }));
          }}
          error={errores.correo}
        />
      </form>
    </Dialogo>
  );
}

/** Contraseña nueva asignada por la superadministración: cierra todas las sesiones de la cuenta. */
function DialogoContrasena({
  cuenta,
  alCerrar,
  alGuardar,
}: {
  cuenta: CuentaAdministracion;
  alCerrar: () => void;
  alGuardar: (cuenta: CuentaAdministracion) => void;
}) {
  const [contrasena, setContrasena] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [errores, setErrores] = useState<{ contrasena?: string; confirmacion?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const idFormulario = useId();

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;
    const locales = problemasContrasena(contrasena, confirmacion, cuenta.nombre);
    setErrores(locales);
    if (Object.keys(locales).length > 0) return;

    setEnviando(true);
    setError(null);
    try {
      const r = await restablecerContrasenaAdministrador(cuenta.id, { contrasena, confirmacion });
      alGuardar(r.cuenta);
    } catch (e) {
      setErrores(erroresDeRespuesta<'contrasena' | 'confirmacion'>(e));
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo
      abierto
      alCerrar={() => !enviando && alCerrar()}
      titulo={`Restablecer la contraseña de ${cuenta.nombre}`}
      descripcion="La contraseña anterior deja de servir y se cierran todas sus sesiones. Compártela por un canal seguro: después no se vuelve a mostrar."
      acciones={
        <>
          <Boton variante="secundario" onClick={alCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton type="submit" form={idFormulario} cargando={enviando}>
            Restablecer
          </Boton>
        </>
      }
    >
      <form id={idFormulario} className={personal.formulario} onSubmit={enviar} noValidate>
        {error && <Aviso tono="peligro">{error}</Aviso>}
        <CampoContrasena
          etiqueta="Contraseña nueva"
          autoComplete="new-password"
          obligatorio
          ayuda="Mínimo 8 caracteres y sin el nombre de la cuenta."
          valor={contrasena}
          alCambiar={(valor) => {
            setContrasena(valor);
            setErrores((x) => ({ ...x, contrasena: undefined }));
          }}
          error={errores.contrasena}
        />
        <CampoContrasena
          etiqueta="Confirmar contraseña"
          autoComplete="new-password"
          obligatorio
          valor={confirmacion}
          alCambiar={(valor) => {
            setConfirmacion(valor);
            setErrores((x) => ({ ...x, confirmacion: undefined }));
          }}
          error={errores.confirmacion}
        />
      </form>
    </Dialogo>
  );
}

/** Subir, bajar o revocar el rol de administración, eligiendo con la descripción de cada uno. */
function DialogoRol({
  cuenta,
  alCerrar,
  alCambiar,
}: {
  cuenta: CuentaAdministracion;
  alCerrar: () => void;
  alCambiar: (id: string, cuenta: CuentaAdministracion | null, mensaje: string) => void;
}) {
  const [rol, setRol] = useState<RolAdministracion | RolPersonal>(cuenta.rol);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const idRol = useId();
  const baja = NIVEL[rol] < NIVEL[cuenta.rol];
  const revoca = rol === 'moderador' || rol === 'gestor_fuentes';

  async function confirmar() {
    if (enviando || rol === cuenta.rol) return alCerrar();
    setEnviando(true);
    setError(null);
    try {
      const r = await cambiarRolAdministrador(cuenta.id, rol);
      alCambiar(
        cuenta.id,
        r.cuenta,
        revoca
          ? `${cuenta.nombre} ya no tiene administración: ahora está en «Cuentas de personal» como ${NOMBRES_ROL[rol].toLowerCase()}.`
          : `${cuenta.nombre} ahora es ${NOMBRES_ROL[rol].toLowerCase()}. El cambio rige de inmediato.`,
      );
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  const opcion = ({
    rol: valor,
    descripcion,
  }: {
    rol: RolAdministracion | RolPersonal;
    descripcion: string;
  }) => (
    <label key={valor} className={personal.rol}>
      <input
        type="radio"
        name={idRol}
        value={valor}
        checked={rol === valor}
        disabled={valor === 'superadmin' && !cuenta.correo}
        onChange={() => setRol(valor)}
      />
      <span className={personal.nombreRol}>
        {NOMBRES_ROL[valor]}
        {valor === cuenta.rol && <span className={personal.marca}> · rol actual</span>}
      </span>
      <span className={personal.descripcionRol}>
        {valor === 'superadmin' && !cuenta.correo
          ? 'Asigna primero un correo: la superadministración solo entra con correo.'
          : descripcion}
      </span>
    </label>
  );

  return (
    <Dialogo
      abierto
      alCerrar={() => !enviando && alCerrar()}
      titulo={`Rol de ${cuenta.nombre}`}
      tono={baja ? 'peligro' : 'normal'}
      descripcion="El cambio rige en la siguiente solicitud de la cuenta. Bajar de nivel o revocar la administración cierra todas sus sesiones."
      acciones={
        <>
          <Boton variante="secundario" onClick={alCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton
            variante={baja ? 'peligro' : 'primario'}
            cargando={enviando}
            disabled={rol === cuenta.rol}
            onClick={() => void confirmar()}
          >
            {revoca ? 'Revocar administración' : 'Cambiar rol'}
          </Boton>
        </>
      }
    >
      <div className={personal.formulario}>
        {error && <Aviso tono="peligro">{error}</Aviso>}
        <fieldset className={personal.roles}>
          <legend className={personal.leyenda}>Administración</legend>
          {ROLES_ADMINISTRACION.map(opcion)}
        </fieldset>
        <fieldset className={personal.roles}>
          <legend className={personal.leyenda}>Revocar la administración</legend>
          {ROLES_REVOCACION.map(opcion)}
        </fieldset>
      </div>
    </Dialogo>
  );
}
