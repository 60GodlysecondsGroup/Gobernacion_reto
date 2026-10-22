'use client';

import { Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso, Boton, Insignia, useNotificar } from '@/components/ui';
import campo from '@/components/ui/CampoTexto.module.css';
import {
  actualizarEscenarioAdmin,
  actualizarSalaAdmin,
  crearSalaAdmin,
  listarCategorias,
  listarSalasAdmin,
  type CategoriaAdministrada,
  type SalaAdministrada,
} from '@/lib/api/administracion';
import { mensajeDeError } from '@/lib/api/cliente';
import { EditorEscenario } from './EditorEscenario';
import estilos from './Panel.module.css';
import propio from './GestionSalas.module.css';

const COMUNIDADES = [
  { codigo: 'A', etiqueta: 'Comunidad A', rango: '10 a 12' },
  { codigo: 'B', etiqueta: 'Comunidad B', rango: '13 a 15' },
  { codigo: 'C', etiqueta: 'Comunidad C', rango: '16 a 17' },
  { codigo: 'D', etiqueta: 'Comunidad D', rango: '18 a 22' },
];

const ESTADO_SALA: Record<string, string> = {
  disponible: 'Con gente',
  llena: 'Llena',
  vacia: 'Vacía',
};

/**
 * F29: salas temáticas por comunidad. Activar o desactivar, capacidad (máximo 10), ocupación y
 * escenario. Las salas siempre llevan el nombre de su categoría: no hay salas con nombre libre.
 */
export function GestionSalas() {
  const [comunidad, setComunidad] = useState('B');
  const [salas, setSalas] = useState<SalaAdministrada[] | null>(null);
  const [categorias, setCategorias] = useState<CategoriaAdministrada[]>([]);
  const [editando, setEditando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorEscenario, setErrorEscenario] = useState<string | null>(null);
  const notificar = useNotificar();
  /** Las confirmaciones se muestran como notificación breve (se anuncian a lectores de pantalla). */
  const setAviso = useCallback(
    (texto: string | null) => {
      if (texto) notificar('exito', texto);
    },
    [notificar],
  );
  const [nuevaCategoria, setNuevaCategoria] = useState('');

  const cargar = useCallback(async (codigo: string) => {
    const [respuesta, cats] = await Promise.all([listarSalasAdmin(codigo), listarCategorias()]);
    setSalas(respuesta.salas);
    setCategorias(cats.categorias);
  }, []);

  useEffect(() => {
    let vigente = true;
    Promise.all([listarSalasAdmin(comunidad), listarCategorias()])
      .then(([respuesta, cats]) => {
        if (!vigente) return;
        setSalas(respuesta.salas);
        setCategorias(cats.categorias);
      })
      .catch((e: unknown) => vigente && setError(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, [comunidad]);

  const elegirComunidad = (codigo: string) => {
    setSalas(null);
    setEditando(null);
    setComunidad(codigo);
  };

  const reemplazar = (sala: SalaAdministrada) =>
    setSalas((lista) => lista?.map((s) => (s.id === sala.id ? sala : s)) ?? null);

  async function actualizar(
    sala: SalaAdministrada,
    datos: Parameters<typeof actualizarSalaAdmin>[1],
    mensaje: string,
  ) {
    setOcupado(sala.id);
    setError(null);
    setAviso(null);
    try {
      reemplazar((await actualizarSalaAdmin(sala.id, datos)).sala);
      setAviso(mensaje);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(null);
    }
  }

  const sinSala = categorias.filter(
    (c) => c.estado === 'activa' && !salas?.some((s) => s.categoria.codigo === c.codigo),
  );

  return (
    <>
      <EncabezadoPagina antetitulo="Panel administrativo" titulo="Salas temáticas">
        Cada comunidad tiene sus propias salas. La capacidad nunca pasa de 10 personas y una sala
        vacía se cierra sola a los 3 minutos (se abre otra del mismo tema).
      </EncabezadoPagina>

      <div className={estilos.filtros} role="group" aria-label="Comunidad">
        {COMUNIDADES.map(({ codigo, etiqueta, rango }) => (
          <button
            key={codigo}
            type="button"
            className={estilos.filtro}
            aria-pressed={comunidad === codigo}
            onClick={() => elegirComunidad(codigo)}
          >
            {etiqueta}
            <span className={estilos.cuentaFiltro}>{rango}</span>
          </button>
        ))}
      </div>
      {error && <Aviso tono="peligro">{error}</Aviso>}
      {!salas && !error && <span className="esqueleto" style={{ height: '20rem' }} />}

      {salas && (
        <ul className={propio.salas}>
          {salas.map((sala) => (
            <li key={sala.id} className={propio.sala} data-deshabilitada={!sala.habilitada}>
              <div className={propio.fila}>
                <div className={propio.identidad}>
                  <h2 className={propio.nombre}>{sala.nombre}</h2>
                  <p className={estilos.detalleIndicador}>{sala.descripcion}</p>
                </div>
                <div
                  className={propio.ocupacion}
                  aria-label={`${sala.ocupacion} de ${sala.capacidad} personas`}
                >
                  <Users aria-hidden="true" size={18} />
                  <span>
                    {sala.ocupacion}/{sala.capacidad}
                  </span>
                  <Insignia
                    tono={sala.habilitada ? (sala.ocupacion > 0 ? 'info' : 'neutro') : 'peligro'}
                  >
                    {sala.habilitada ? (ESTADO_SALA[sala.estado] ?? sala.estado) : 'Deshabilitada'}
                  </Insignia>
                </div>
              </div>
              <div className={propio.controles}>
                <label className={propio.control}>
                  <button
                    type="button"
                    role="switch"
                    className={estilos.interruptor}
                    aria-checked={sala.habilitada}
                    disabled={ocupado === sala.id}
                    onClick={() =>
                      void actualizar(
                        sala,
                        { habilitada: !sala.habilitada },
                        sala.habilitada
                          ? `«${sala.nombre}» quedó deshabilitada. Quien estaba dentro salió con un aviso.`
                          : `«${sala.nombre}» está habilitada de nuevo.`,
                      )
                    }
                  />
                  Habilitada
                </label>
                <label className={propio.control}>
                  Capacidad
                  <select
                    className={campo.control}
                    style={{ width: '5.5rem', minHeight: '2.4rem' }}
                    value={sala.capacidad}
                    disabled={ocupado === sala.id}
                    onChange={(e) =>
                      void actualizar(
                        sala,
                        { capacidad: Number(e.target.value) },
                        `«${sala.nombre}» admite ahora ${e.target.value} personas.`,
                      )
                    }
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <Boton
                  tamano="sm"
                  variante="secundario"
                  aria-expanded={editando === sala.id}
                  onClick={() => {
                    setErrorEscenario(null);
                    setEditando((actual) => (actual === sala.id ? null : sala.id));
                  }}
                >
                  {editando === sala.id ? 'Cerrar escenario' : 'Editar escenario'}
                </Boton>
              </div>
              {editando === sala.id && (
                <EditorEscenario
                  escenario={sala.escenario}
                  guardando={ocupado === sala.id}
                  error={errorEscenario}
                  onCancelar={() => setEditando(null)}
                  onGuardar={async (cambios) => {
                    setOcupado(sala.id);
                    setErrorEscenario(null);
                    try {
                      reemplazar((await actualizarEscenarioAdmin(sala.id, cambios)).sala);
                      setEditando(null);
                      setAviso(
                        `Escenario de «${sala.nombre}» guardado. Se verá desde la próxima entrada.`,
                      );
                    } catch (e) {
                      setErrorEscenario(mensajeDeError(e));
                    } finally {
                      setOcupado(null);
                    }
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {salas && sinSala.length > 0 && (
        <form
          className={propio.nueva}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!nuevaCategoria) return;
            setError(null);
            try {
              await crearSalaAdmin({ comunidad, categoria: nuevaCategoria });
              setNuevaCategoria('');
              await cargar(comunidad);
              setAviso('Sala temática habilitada.');
            } catch (err) {
              setError(mensajeDeError(err));
            }
          }}
        >
          <label className={campo.campo}>
            <span className={campo.etiqueta}>Habilitar la sala de otra categoría</span>
            <select
              className={campo.control}
              value={nuevaCategoria}
              onChange={(e) => setNuevaCategoria(e.target.value)}
            >
              <option value="">Elige una categoría</option>
              {sinSala.map((c) => (
                <option key={c.codigo} value={c.codigo}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <Boton type="submit" disabled={!nuevaCategoria}>
            Habilitar sala
          </Boton>
        </form>
      )}
    </>
  );
}
