'use client';

import { useCallback, useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso, Boton, CampoTexto, Insignia, Tarjeta, useNotificar } from '@/components/ui';
import {
  actualizarCategoria,
  actualizarComunidad,
  crearCategoria,
  listarCategorias,
  listarComunidades,
  type CategoriaAdministrada,
  type ComunidadAdministrada,
} from '@/lib/api/administracion';
import { erroresPorCampo, mensajeDeError } from '@/lib/api/cliente';
import estilos from './Panel.module.css';

/**
 * F27 y F28. Las comunidades se pueden renombrar, describir o desactivar; su rango de edad NO se
 * puede cambiar desde ninguna parte (no existe esa función). Las categorías definen qué foros y
 * salas pueden existir.
 */
export function GestionComunidades() {
  const [comunidades, setComunidades] = useState<ComunidadAdministrada[] | null>(null);
  const [categorias, setCategorias] = useState<CategoriaAdministrada[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const notificar = useNotificar();
  /** Las confirmaciones se muestran como notificación breve (se anuncian a lectores de pantalla). */
  const setAviso = useCallback(
    (texto: string | null) => {
      if (texto) notificar('exito', texto);
    },
    [notificar],
  );
  const [nueva, setNueva] = useState({ nombre: '', descripcion: '' });
  const [erroresNueva, setErroresNueva] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listarComunidades(), listarCategorias()])
      .then(([c, cat]) => {
        setComunidades(c.comunidades);
        setCategorias(cat.categorias);
      })
      .catch((e: unknown) => setError(mensajeDeError(e)));
  }, []);

  async function ejecutar(clave: string, trabajo: () => Promise<void>, mensaje: string) {
    setOcupado(clave);
    setError(null);
    setAviso(null);
    try {
      await trabajo();
      setAviso(mensaje);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <>
      <EncabezadoPagina antetitulo="Panel administrativo" titulo="Comunidades y categorías">
        Las cuatro comunidades corresponden a rangos de edad fijos. Desactivar una comunidad deja
        sin acceso a sus jóvenes; su rango nunca se puede cambiar.
      </EncabezadoPagina>
      {error && <Aviso tono="peligro">{error}</Aviso>}
      {!comunidades && !error && <span className="esqueleto" style={{ height: '16rem' }} />}

      {comunidades && (
        <div className={estilos.tablaContenedor}>
          <table className={estilos.tabla}>
            <caption className="visualmente-oculto">Comunidades</caption>
            <thead>
              <tr>
                <th scope="col">Comunidad</th>
                <th scope="col">Rango</th>
                <th scope="col" className={estilos.numerico}>
                  Jóvenes
                </th>
                <th scope="col" className={estilos.numerico}>
                  Hilos
                </th>
                <th scope="col" className={estilos.numerico}>
                  Salas abiertas
                </th>
                <th scope="col">Activa</th>
              </tr>
            </thead>
            <tbody>
              {comunidades.map((c) => (
                <tr key={c.id}>
                  <td className={estilos.enlaceFila}>{c.nombre}</td>
                  <td>{c.rango}</td>
                  <td className={estilos.numerico}>{c.jovenes}</td>
                  <td className={estilos.numerico}>{c.hilos}</td>
                  <td className={estilos.numerico}>{c.salasAbiertas}</td>
                  <td>
                    <button
                      type="button"
                      role="switch"
                      className={estilos.interruptor}
                      aria-checked={c.estado === 'activa'}
                      aria-label={`${c.nombre} activa`}
                      disabled={ocupado !== null}
                      onClick={() =>
                        void ejecutar(
                          c.id,
                          async () =>
                            setComunidades(
                              (
                                await actualizarComunidad(c.id, {
                                  estado: c.estado === 'activa' ? 'inactiva' : 'activa',
                                })
                              ).comunidades,
                            ),
                          c.estado === 'activa'
                            ? `${c.nombre} quedó inactiva: sus jóvenes no pueden entrar.`
                            : `${c.nombre} está activa de nuevo.`,
                        )
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {categorias && (
        <div className={estilos.dosColumnas}>
          <Tarjeta
            titulo="Categorías"
            descripcion="Se comparten entre comunidades; cada comunidad ve solo sus propios hilos y salas."
          >
            <ul className={estilos.listaSimple}>
              {categorias.map((cat) => (
                <li key={cat.id} className={estilos.itemLista}>
                  <span>
                    <strong>{cat.nombre}</strong>{' '}
                    {cat.estado === 'inactiva' && <Insignia tono="neutro">Inactiva</Insignia>}
                    <br />
                    <span className={estilos.detalleIndicador}>
                      {cat.hilos} hilos, {cat.salasAbiertas} salas abiertas
                    </span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    className={estilos.interruptor}
                    aria-checked={cat.estado === 'activa'}
                    aria-label={`Categoría ${cat.nombre} activa`}
                    disabled={ocupado !== null}
                    onClick={() =>
                      void ejecutar(
                        cat.id,
                        async () =>
                          setCategorias(
                            (
                              await actualizarCategoria(cat.id, {
                                estado: cat.estado === 'activa' ? 'inactiva' : 'activa',
                              })
                            ).categorias,
                          ),
                        cat.estado === 'activa'
                          ? `«${cat.nombre}» ya no admite hilos nuevos.`
                          : `«${cat.nombre}» está activa.`,
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          </Tarjeta>

          <Tarjeta
            titulo="Nueva categoría"
            descripcion="Después puedes habilitar su sala temática en cada comunidad desde Salas."
          >
            <form
              style={{ display: 'grid', gap: 'var(--espacio-4)' }}
              onSubmit={(e) => {
                e.preventDefault();
                setErroresNueva({});
                void ejecutar(
                  'nueva',
                  async () => {
                    try {
                      setCategorias((await crearCategoria(nueva)).categorias);
                      setNueva({ nombre: '', descripcion: '' });
                    } catch (err) {
                      setErroresNueva(erroresPorCampo(err));
                      throw err;
                    }
                  },
                  `Categoría «${nueva.nombre}» creada.`,
                );
              }}
            >
              <CampoTexto
                etiqueta="Nombre"
                value={nueva.nombre}
                onChange={(e) => setNueva((n) => ({ ...n, nombre: e.target.value }))}
                error={erroresNueva.nombre}
                required
                minLength={3}
                maxLength={60}
              />
              <CampoTexto
                etiqueta="Descripción"
                value={nueva.descripcion}
                onChange={(e) => setNueva((n) => ({ ...n, descripcion: e.target.value }))}
                maxLength={300}
              />
              <div>
                <Boton type="submit" cargando={ocupado === 'nueva'}>
                  Crear categoría
                </Boton>
              </div>
            </form>
          </Tarjeta>
        </div>
      )}
    </>
  );
}
