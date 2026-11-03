'use client';

import { UserPlus } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { CampoContrasena } from '@/components/sesion/PiezasAcceso';
import {
  Aviso,
  Boton,
  CampoTexto,
  ConfirmarAccion,
  Insignia,
  Tarjeta,
  useNotificar,
} from '@/components/ui';
import campo from '@/components/ui/CampoTexto.module.css';
import {
  cambiarEstadoUsuario,
  cambiarRolPersonal,
  crearCuentaPersonal,
  listarPersonal,
  NOMBRE_ESTADO_USUARIO,
  type CuentaPersonal,
  type DatosCuentaPersonal,
  type EstadoUsuario,
  type RolPersonal,
} from '@/lib/api/administracion';
import { campoDelError, erroresPorCampo, mensajeDeError } from '@/lib/api/cliente';
import { NOMBRES_ROL } from '@/lib/api/sesion';
import propios from './GestionPersonal.module.css';
import {
  enfocarPrimerError,
  problemaCorreo,
  problemaNombre,
  problemasContrasena,
} from './validacionCuentas';
import estilos from './Panel.module.css';

const TONO: Record<EstadoUsuario, 'exito' | 'advertencia' | 'peligro'> = {
  activo: 'exito',
  suspendido: 'advertencia',
  bloqueado: 'peligro',
};

/** Lo que puede hacer cada rol (matriz A.2), para elegirlo sabiendo qué se asigna. */
const ROLES: { rol: RolPersonal; descripcion: string }[] = [
  {
    rol: 'moderador',
    descripcion:
      'Revisa reportes e incidencias del DLP, responde hilos, entra a las salas y aplica medidas sobre cuentas de jóvenes.',
  },
  {
    rol: 'gestor_fuentes',
    descripcion:
      'Crea, verifica y actualiza las fuentes institucionales que se muestran en Orientación.',
  },
];

type Formulario = Omit<DatosCuentaPersonal, 'rol'> & { rol: RolPersonal | null };
type ErroresCuenta = Partial<Record<keyof DatosCuentaPersonal, string>>;

const VACIO: Formulario = { nombre: '', correo: '', contrasena: '', confirmacion: '', rol: null };

/** Las mismas reglas que el backend, para avisar antes de enviar. El backend vuelve a validar. */
function validarCuenta(datos: Formulario): ErroresCuenta {
  const errores: ErroresCuenta = {
    nombre: problemaNombre(datos.nombre),
    correo: problemaCorreo(datos.correo),
    ...problemasContrasena(datos.contrasena, datos.confirmacion, datos.nombre),
    rol: datos.rol ? undefined : 'Elige el rol: moderación o gestión de fuentes.',
  };
  return Object.fromEntries(
    Object.entries(errores).filter(([, mensaje]) => mensaje),
  ) as ErroresCuenta;
}

type Confirmacion =
  | { tipo: 'rol'; cuenta: CuentaPersonal; rol: RolPersonal }
  | { tipo: 'desactivar'; cuenta: CuentaPersonal };

/**
 * Cuentas de personal (solo administración, `gestionar_personal`): crearlas con correo,
 * contraseña y rol, cambiarles el rol y desactivarlas o reactivarlas. El backend vuelve a
 * comprobar el permiso y las reglas en cada llamada.
 */
export function GestionPersonal() {
  const [cuentas, setCuentas] = useState<CuentaPersonal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<Confirmacion | null>(null);
  const [creando, setCreando] = useState(false);
  const notificar = useNotificar();

  useEffect(() => {
    let vigente = true;
    listarPersonal()
      .then((r) => vigente && setCuentas(r.cuentas))
      .catch((e: unknown) => vigente && setError(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, []);

  const reemplazar = (id: string, cambio: Partial<CuentaPersonal>) =>
    setCuentas((lista) => lista?.map((c) => (c.id === id ? { ...c, ...cambio } : c)) ?? null);

  async function ejecutar(id: string, trabajo: () => Promise<string>) {
    setOcupado(id);
    setError(null);
    try {
      notificar('exito', await trabajo());
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(null);
      setConfirmar(null);
    }
  }

  const cambiarRol = (cuenta: CuentaPersonal, rol: RolPersonal) =>
    ejecutar(cuenta.id, async () => {
      await cambiarRolPersonal(cuenta.id, rol);
      reemplazar(cuenta.id, { rol });
      return `${cuenta.nombre} ahora es ${NOMBRES_ROL[rol].toLowerCase()}. El cambio rige de inmediato.`;
    });

  const cambiarEstado = (cuenta: CuentaPersonal, estado: EstadoUsuario) =>
    ejecutar(cuenta.id, async () => {
      await cambiarEstadoUsuario(cuenta.id, estado);
      reemplazar(cuenta.id, { estado });
      return estado === 'activo'
        ? `La cuenta de ${cuenta.nombre} está activa de nuevo: tendrá que volver a entrar.`
        : `La cuenta de ${cuenta.nombre} quedó desactivada y se cerraron sus sesiones.`;
    });

  return (
    <>
      <EncabezadoPagina
        antetitulo="Panel administrativo"
        titulo="Cuentas de personal"
        acciones={
          <Boton onClick={() => setCreando(true)} aria-expanded={creando}>
            <UserPlus aria-hidden="true" size={18} />
            Nueva cuenta
          </Boton>
        }
      >
        Moderación y gestión de fuentes. Estas cuentas entran con su correo y contraseña en «Acceso
        del equipo», nunca con avatar. Solo la administración las crea y les cambia el rol.
      </EncabezadoPagina>

      {error && <Aviso tono="peligro">{error}</Aviso>}

      {creando && (
        <FormularioCuentaNueva
          alCerrar={() => setCreando(false)}
          alCrear={(cuenta) => {
            setCuentas((lista) => [cuenta, ...(lista ?? [])]);
            setCreando(false);
            notificar(
              'exito',
              `Cuenta de ${cuenta.nombre} creada. Ya puede entrar con su correo en «Acceso del equipo».`,
            );
          }}
        />
      )}

      {!cuentas && !error && <span className="esqueleto" style={{ height: '12rem' }} />}

      {cuentas && cuentas.length === 0 && (
        <div className={estilos.vacio}>
          <strong>Todavía no hay cuentas de personal.</strong>
          Crea la primera con «Nueva cuenta».
        </div>
      )}

      {cuentas && cuentas.length > 0 && (
        <div className={estilos.tablaContenedor}>
          <table className={estilos.tabla}>
            <caption className="visualmente-oculto">Cuentas de personal</caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Correo</th>
                <th scope="col">Rol</th>
                <th scope="col">Cuenta</th>
                <th scope="col">Acceso</th>
              </tr>
            </thead>
            <tbody>
              {cuentas.map((c) => (
                <tr key={c.id}>
                  <td className={estilos.enlaceFila}>{c.nombre}</td>
                  <td className={propios.correo}>
                    {c.correo ?? (
                      <span className={propios.sinCorreo}>Sin correo: no puede entrar</span>
                    )}
                  </td>
                  <td>
                    <label className="visualmente-oculto" htmlFor={`rol-${c.id}`}>
                      Rol de {c.nombre}
                    </label>
                    <select
                      id={`rol-${c.id}`}
                      className={campo.control}
                      style={{ maxWidth: '13rem' }}
                      value={c.rol}
                      disabled={ocupado !== null}
                      onChange={(e) =>
                        setConfirmar({ tipo: 'rol', cuenta: c, rol: e.target.value as RolPersonal })
                      }
                    >
                      {ROLES.map(({ rol }) => (
                        <option key={rol} value={rol}>
                          {NOMBRES_ROL[rol]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <Insignia tono={TONO[c.estado]}>{NOMBRE_ESTADO_USUARIO[c.estado]}</Insignia>
                  </td>
                  <td>
                    {c.estado === 'activo' ? (
                      <Boton
                        tamano="sm"
                        variante="secundario"
                        cargando={ocupado === c.id}
                        disabled={ocupado !== null}
                        onClick={() => setConfirmar({ tipo: 'desactivar', cuenta: c })}
                      >
                        Desactivar
                      </Boton>
                    ) : (
                      <Boton
                        tamano="sm"
                        variante="secundario"
                        cargando={ocupado === c.id}
                        disabled={ocupado !== null}
                        onClick={() => void cambiarEstado(c, 'activo')}
                      >
                        Reactivar
                      </Boton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmarAccion
        abierto={confirmar?.tipo === 'rol'}
        alCerrar={() => setConfirmar(null)}
        peligro={false}
        titulo="¿Cambiar el rol?"
        descripcion={
          confirmar?.tipo === 'rol' &&
          `${confirmar.cuenta.nombre} pasará a ${NOMBRES_ROL[confirmar.rol].toLowerCase()} y perderá de inmediato los permisos de ${NOMBRES_ROL[confirmar.cuenta.rol].toLowerCase()}.`
        }
        textoConfirmar="Cambiar rol"
        cargando={confirmar !== null && ocupado === confirmar.cuenta.id}
        alConfirmar={() => {
          if (confirmar?.tipo === 'rol') void cambiarRol(confirmar.cuenta, confirmar.rol);
        }}
      />

      <ConfirmarAccion
        abierto={confirmar?.tipo === 'desactivar'}
        alCerrar={() => setConfirmar(null)}
        titulo="¿Desactivar la cuenta?"
        descripcion={
          confirmar?.tipo === 'desactivar' &&
          `${confirmar.cuenta.nombre} perderá el acceso de inmediato y se cerrarán sus sesiones abiertas. Puedes reactivarla cuando quieras.`
        }
        textoConfirmar="Desactivar"
        cargando={confirmar !== null && ocupado === confirmar.cuenta.id}
        alConfirmar={() => {
          if (confirmar?.tipo === 'desactivar') void cambiarEstado(confirmar.cuenta, 'suspendido');
        }}
      />
    </>
  );
}

/** Alta de una cuenta de personal, en una tarjeta dentro de la página (como «Nueva categoría»). */
function FormularioCuentaNueva({
  alCerrar,
  alCrear,
}: {
  alCerrar: () => void;
  alCrear: (cuenta: CuentaPersonal) => void;
}) {
  const [datos, setDatos] = useState<Formulario>(VACIO);
  const [errores, setErrores] = useState<ErroresCuenta>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);
  const idRol = useId();

  // Al abrirse, el foco va al primer campo: no hay que buscar el formulario.
  useEffect(() => {
    formulario.current?.querySelector('input')?.focus();
  }, []);

  const cambiar = (clave: keyof Formulario, valor: string) => {
    setDatos((actual) => ({ ...actual, [clave]: valor }));
    setErrores((actuales) => ({ ...actuales, [clave]: undefined }));
  };

  function cerrar() {
    if (!enviando) alCerrar();
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;
    const locales = validarCuenta(datos);
    setErrores(locales);
    if (Object.keys(locales).length > 0 || !datos.rol) {
      setError('Revisa los campos marcados y vuelve a intentarlo.');
      // Lleva el foco al primer campo con error, como el registro de jóvenes.
      enfocarPrimerError(formulario.current);
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      const { cuenta } = await crearCuentaPersonal({
        ...datos,
        nombre: datos.nombre.trim(),
        correo: datos.correo.trim(),
        rol: datos.rol,
      });
      alCrear(cuenta);
    } catch (e) {
      const porCampo: ErroresCuenta = erroresPorCampo(e);
      const campoConflicto = campoDelError(e);
      if (campoConflicto) porCampo[campoConflicto as keyof ErroresCuenta] = mensajeDeError(e);
      setErrores(porCampo);
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tarjeta
      titulo="Nueva cuenta de personal"
      descripcion="Entrará con este correo y esta contraseña en «Acceso del equipo». Compártela por un canal seguro: después no se vuelve a mostrar."
    >
      <form ref={formulario} className={propios.formulario} onSubmit={enviar} noValidate>
        {error && <Aviso tono="peligro">{error}</Aviso>}
        <CampoTexto
          etiqueta="Nombre"
          obligatorio
          maxLength={30}
          autoComplete="off"
          ayuda="Es el nombre visible de la cuenta en el panel y en sus respuestas en la comunidad."
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
          className={propios.roles}
          aria-invalid={errores.rol ? true : undefined}
          aria-describedby={errores.rol ? `${idRol}-error` : undefined}
        >
          <legend className={propios.leyenda}>
            Rol <span className={propios.marca}>Obligatorio</span>
          </legend>
          {ROLES.map(({ rol, descripcion }) => (
            <label key={rol} className={propios.rol}>
              <input
                type="radio"
                name={idRol}
                value={rol}
                checked={datos.rol === rol}
                onChange={() => cambiar('rol', rol)}
              />
              <span className={propios.nombreRol}>{NOMBRES_ROL[rol]}</span>
              <span className={propios.descripcionRol}>{descripcion}</span>
            </label>
          ))}
          {errores.rol && (
            <p id={`${idRol}-error`} className={propios.errorGrupo} role="alert">
              {errores.rol}
            </p>
          )}
        </fieldset>
        <div className={propios.acciones}>
          <Boton type="submit" cargando={enviando}>
            Crear cuenta
          </Boton>
          <Boton variante="secundario" onClick={cerrar} disabled={enviando}>
            Cancelar
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
