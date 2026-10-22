'use client';

import { Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { useSesion } from '@/components/sesion/ProveedorSesion';
import { Aviso, Boton, Insignia, useNotificar } from '@/components/ui';
import campo from '@/components/ui/CampoTexto.module.css';
import {
  cambiarEstadoUsuario,
  listarUsuarios,
  NOMBRE_ESTADO_USUARIO,
  type EstadoUsuario,
  type UsuarioAdministrado,
} from '@/lib/api/administracion';
import { mensajeDeError } from '@/lib/api/cliente';
import { NOMBRES_ROL } from '@/lib/api/sesion';
import estilos from './Panel.module.css';

const TONO: Record<EstadoUsuario, 'exito' | 'advertencia' | 'peligro'> = {
  activo: 'exito',
  suspendido: 'advertencia',
  bloqueado: 'peligro',
};

/**
 * F26: cuentas con datos mínimos (alias, rol, comunidad, estado e indicadores). La moderación
 * solo aplica medidas a cuentas de jóvenes; la administración, a cualquiera menos la propia.
 */
export function GestionUsuarios() {
  const { usuario: yo } = useSesion();
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState({ buscar: '', estado: '', rol: '' });
  const [usuarios, setUsuarios] = useState<UsuarioAdministrado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const notificar = useNotificar();
  /** Las confirmaciones se muestran como notificación breve (se anuncian a lectores de pantalla). */
  const setAviso = useCallback(
    (texto: string | null) => {
      if (texto) notificar('exito', texto);
    },
    [notificar],
  );
  const [ocupado, setOcupado] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    listarUsuarios({
      buscar: filtro.buscar.length >= 2 ? filtro.buscar : undefined,
      estado: filtro.estado || undefined,
      rol: filtro.rol || undefined,
    })
      .then((r) => vigente && setUsuarios(r.usuarios))
      .catch((e: unknown) => vigente && setError(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, [filtro]);

  const aplicarFiltro = (cambio: (f: typeof filtro) => typeof filtro) => {
    setUsuarios(null);
    setError(null);
    setFiltro(cambio);
  };

  const puedeActuar = (u: UsuarioAdministrado) =>
    u.id !== yo?.id && (yo?.rol === 'admin_plataforma' || u.rol === 'usuario');

  async function cambiar(u: UsuarioAdministrado, estado: EstadoUsuario) {
    setOcupado(u.id);
    setError(null);
    setAviso(null);
    try {
      await cambiarEstadoUsuario(u.id, estado);
      setUsuarios((lista) => lista?.map((x) => (x.id === u.id ? { ...x, estado } : x)) ?? null);
      setAviso(
        estado === 'activo'
          ? `La cuenta de ${u.alias} está activa de nuevo.`
          : `La cuenta de ${u.alias} quedó ${NOMBRE_ESTADO_USUARIO[estado].toLowerCase()}: perdió el acceso de inmediato.`,
      );
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <>
      <EncabezadoPagina antetitulo="Panel administrativo" titulo="Usuarios">
        Solo lo necesario para moderar: alias, rol, comunidad, estado de la cuenta y cuántos
        reportes y bloqueos acumula. Nunca la edad, los intereses ni datos de contacto.
      </EncabezadoPagina>

      <form
        className={estilos.filtros}
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          aplicarFiltro((f) => ({ ...f, buscar: buscar.trim() }));
        }}
      >
        <label className="visualmente-oculto" htmlFor="buscar-usuario">
          Buscar por alias
        </label>
        <input
          id="buscar-usuario"
          className={campo.control}
          style={{ maxWidth: '16rem' }}
          placeholder="Buscar por alias"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        <Boton type="submit" variante="secundario">
          <Search aria-hidden="true" size={18} />
          Buscar
        </Boton>
        <label className="visualmente-oculto" htmlFor="filtro-estado">
          Estado
        </label>
        <select
          id="filtro-estado"
          className={campo.control}
          style={{ maxWidth: '12rem' }}
          value={filtro.estado}
          onChange={(e) => aplicarFiltro((f) => ({ ...f, estado: e.target.value }))}
        >
          <option value="">Todos los estados</option>
          <option value="activo">Activas</option>
          <option value="suspendido">Suspendidas</option>
          <option value="bloqueado">Bloqueadas</option>
        </select>
        <label className="visualmente-oculto" htmlFor="filtro-rol">
          Rol
        </label>
        <select
          id="filtro-rol"
          className={campo.control}
          style={{ maxWidth: '12rem' }}
          value={filtro.rol}
          onChange={(e) => aplicarFiltro((f) => ({ ...f, rol: e.target.value }))}
        >
          <option value="">Todos los roles</option>
          {Object.entries(NOMBRES_ROL).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </form>
      {error && <Aviso tono="peligro">{error}</Aviso>}
      {!usuarios && !error && <span className="esqueleto" style={{ height: '16rem' }} />}

      {usuarios && usuarios.length === 0 && (
        <div className={estilos.vacio}>
          <strong>Ninguna cuenta coincide.</strong>
          Cambia el filtro o busca otro alias.
        </div>
      )}

      {usuarios && usuarios.length > 0 && (
        <div className={estilos.tablaContenedor}>
          <table className={estilos.tabla}>
            <thead>
              <tr>
                <th scope="col">Alias</th>
                <th scope="col">Rol</th>
                <th scope="col">Comunidad</th>
                <th scope="col" className={estilos.numerico}>
                  Reportes abiertos
                </th>
                <th scope="col" className={estilos.numerico}>
                  Bloqueos DLP (30 días)
                </th>
                <th scope="col">Cuenta</th>
                <th scope="col">Medida</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td className={estilos.enlaceFila}>{u.alias}</td>
                  <td>{NOMBRES_ROL[u.rol]}</td>
                  <td>{u.comunidad ?? 'Sin comunidad'}</td>
                  <td className={estilos.numerico}>{u.reportesAbiertos}</td>
                  <td className={estilos.numerico}>{u.bloqueosDlp30d}</td>
                  <td>
                    <Insignia tono={TONO[u.estado]}>{NOMBRE_ESTADO_USUARIO[u.estado]}</Insignia>
                  </td>
                  <td>
                    {puedeActuar(u) ? (
                      u.estado === 'activo' ? (
                        <Boton
                          tamano="sm"
                          variante="secundario"
                          cargando={ocupado === u.id}
                          onClick={() => void cambiar(u, 'suspendido')}
                        >
                          Suspender
                        </Boton>
                      ) : (
                        <Boton
                          tamano="sm"
                          variante="secundario"
                          cargando={ocupado === u.id}
                          onClick={() => void cambiar(u, 'activo')}
                        >
                          Reactivar
                        </Boton>
                      )
                    ) : (
                      <span className={estilos.detalleIndicador}>
                        {u.id === yo?.id ? 'Tu cuenta' : 'Solo administración'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
