'use client';

import { useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { useSesion } from '@/components/sesion/ProveedorSesion';
import { Aviso, Tarjeta } from '@/components/ui';
import {
  cambiarEstadoCategoriaDlp,
  cambiarEstadoRegla,
  listarReglasDlp,
  type CategoriaDlp,
} from '@/lib/api/administracion';
import { mensajeDeError } from '@/lib/api/cliente';
import estilos from './Panel.module.css';
import propio from './GestionReglasDlp.module.css';

/**
 * F31: reglas DLP por categoría. La moderación consulta; solo la administración activa o
 * desactiva, y cada cambio queda registrado. Las reglas se aplican sin reiniciar nada.
 */
export function GestionReglasDlp() {
  const { puede } = useSesion();
  const editable = puede('gestionar_reglas_dlp');
  const [categorias, setCategorias] = useState<CategoriaDlp[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  useEffect(() => {
    listarReglasDlp()
      .then((r) => setCategorias(r.categorias))
      .catch((e: unknown) => setError(mensajeDeError(e)));
  }, []);

  async function ejecutar(clave: string, trabajo: () => Promise<{ categorias: CategoriaDlp[] }>) {
    setOcupado(clave);
    setError(null);
    try {
      setCategorias((await trabajo()).categorias);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <>
      <EncabezadoPagina antetitulo="Panel administrativo" titulo="Reglas DLP">
        Patrones que el filtro revisa antes de publicar. Desactivar una regla deja pasar ese tipo de
        información: hazlo solo para corregir falsos positivos.
        {!editable && ' Tu rol puede consultarlas, pero no cambiarlas.'}
      </EncabezadoPagina>

      {error && <Aviso tono="peligro">{error}</Aviso>}
      {!categorias && !error && <span className="esqueleto" style={{ height: '20rem' }} />}

      {categorias?.map((categoria) => {
        const activas = categoria.reglas.filter((r) => r.estado === 'activa').length;
        const todas = activas === categoria.reglas.length;
        return (
          <Tarjeta key={categoria.codigo}>
            <div className={propio.cabecera}>
              <div>
                <h2 className={propio.titulo}>{categoria.nombre}</h2>
                <p className={estilos.detalleIndicador}>{categoria.descripcion}</p>
              </div>
              <label className={propio.interruptorCategoria}>
                <span>
                  {activas} de {categoria.reglas.length} activas
                </span>
                <button
                  type="button"
                  role="switch"
                  className={estilos.interruptor}
                  aria-checked={todas}
                  aria-label={`Todas las reglas de ${categoria.nombre}`}
                  disabled={!editable || ocupado !== null}
                  onClick={() =>
                    void ejecutar(categoria.codigo, () =>
                      cambiarEstadoCategoriaDlp(categoria.codigo, todas ? 'inactiva' : 'activa'),
                    )
                  }
                />
              </label>
            </div>
            {activas === 0 && (
              <Aviso tono="advertencia">
                Esta categoría no tiene reglas activas: el filtro no la está revisando.
              </Aviso>
            )}
            <ul className={estilos.listaSimple}>
              {categoria.reglas.map((regla) => (
                <li key={regla.id} className={estilos.itemLista}>
                  <span className={propio.regla}>
                    <code>{regla.codigo}</code>
                    <span className={estilos.detalleIndicador}>
                      {regla.descripcion}
                      {regla.bloqueos30d > 0 &&
                        ` Bloqueó ${regla.bloqueos30d} en los últimos 30 días.`}
                    </span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    className={estilos.interruptor}
                    aria-checked={regla.estado === 'activa'}
                    aria-label={`Regla ${regla.codigo}`}
                    disabled={!editable || ocupado !== null}
                    onClick={() =>
                      void ejecutar(regla.id, () =>
                        cambiarEstadoRegla(
                          regla.id,
                          regla.estado === 'activa' ? 'inactiva' : 'activa',
                        ),
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          </Tarjeta>
        );
      })}
    </>
  );
}
