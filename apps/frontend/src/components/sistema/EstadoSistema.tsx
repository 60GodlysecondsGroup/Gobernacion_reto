'use client';

import { useEffect, useState } from 'react';
import { Boton, Insignia, Tarjeta, type TonoInsignia } from '@/components/ui';
import { ErrorApi, URL_API } from '@/lib/api/cliente';
import { obtenerEstadoSalud, type EstadoSalud } from '@/lib/api/sistema';
import estilos from './EstadoSistema.module.css';

type Vista =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; salud: EstadoSalud; comprobadoEn: Date }
  | { tipo: 'error'; mensaje: string; comprobadoEn: Date };

const ETIQUETAS_DATOS: { clave: keyof NonNullable<EstadoSalud['datosDemo']>; etiqueta: string }[] =
  [
    { clave: 'comunidades', etiqueta: 'Comunidades' },
    { clave: 'usuarios', etiqueta: 'Usuarios de prueba' },
    { clave: 'categorias', etiqueta: 'Categorías' },
    { clave: 'salas', etiqueta: 'Salas' },
    { clave: 'fuentes', etiqueta: 'Fuentes de demostración' },
  ];

function estadoBaseDeDatos(salud: EstadoSalud): { tono: TonoInsignia; texto: string } {
  const { estado, latenciaMs } = salud.baseDeDatos;
  if (estado === 'ok') return { tono: 'exito', texto: `conectada · ${latenciaMs} ms` };
  if (estado === 'sin_esquema') return { tono: 'advertencia', texto: 'sin esquema' };
  return { tono: 'peligro', texto: 'sin conexión' };
}

export function EstadoSistema() {
  const [vista, setVista] = useState<Vista>({ tipo: 'cargando' });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    const controlador = new AbortController();
    obtenerEstadoSalud(controlador.signal)
      .then((salud) => setVista({ tipo: 'listo', salud, comprobadoEn: new Date() }))
      .catch((error: unknown) => {
        if (controlador.signal.aborted) return;
        const mensaje = error instanceof ErrorApi ? error.message : 'Ocurrió un error inesperado.';
        setVista({ tipo: 'error', mensaje, comprobadoEn: new Date() });
      });
    return () => controlador.abort();
  }, [intento]);

  const volverAComprobar = () => {
    setVista({ tipo: 'cargando' });
    setIntento((n) => n + 1);
  };

  const cargando = vista.tipo === 'cargando';
  const baseDeDatos = vista.tipo === 'listo' ? estadoBaseDeDatos(vista.salud) : null;

  return (
    <Tarjeta
      titulo="Estado del sistema"
      descripcion="Conexión entre el frontend, el backend y la base de datos."
      pie={
        <>
          <span className={estilos.marcaTiempo}>
            {vista.tipo === 'cargando'
              ? 'Comprobando…'
              : `Comprobado a las ${vista.comprobadoEn.toLocaleTimeString('es-CO')}`}
          </span>
          <Boton variante="secundario" tamano="sm" onClick={volverAComprobar} cargando={cargando}>
            Volver a comprobar
          </Boton>
        </>
      }
    >
      <div aria-live="polite" aria-busy={cargando} className={estilos.contenido}>
        <dl className={estilos.filas}>
          <div className={estilos.fila}>
            <dt>Backend</dt>
            <dd>
              {vista.tipo === 'cargando' && <Insignia>comprobando…</Insignia>}
              {vista.tipo === 'listo' && <Insignia tono="exito">backend OK</Insignia>}
              {vista.tipo === 'error' && <Insignia tono="peligro">sin respuesta</Insignia>}
            </dd>
          </div>
          <div className={estilos.fila}>
            <dt>Base de datos</dt>
            <dd>
              {baseDeDatos ? (
                <Insignia tono={baseDeDatos.tono}>{baseDeDatos.texto}</Insignia>
              ) : (
                <Insignia>{vista.tipo === 'cargando' ? 'comprobando…' : 'desconocido'}</Insignia>
              )}
            </dd>
          </div>
        </dl>

        {vista.tipo === 'error' && (
          <p className={estilos.aviso}>
            {vista.mensaje} Verifica que el backend esté corriendo en <code>{URL_API}</code> (
            <code>npm run dev</code>).
          </p>
        )}

        {vista.tipo === 'listo' && vista.salud.baseDeDatos.estado === 'sin_esquema' && (
          <p className={estilos.aviso}>
            La base de datos responde pero no tiene el esquema. Ejecuta{' '}
            <code>npm run db:reset</code>.
          </p>
        )}

        {vista.tipo === 'listo' && vista.salud.baseDeDatos.estado === 'sin_conexion' && (
          <p className={estilos.aviso}>
            El backend no logra conectarse a la base. Revisa <code>DATABASE_URL</code> en el{' '}
            <code>.env</code>.
          </p>
        )}

        {vista.tipo === 'listo' && vista.salud.datosDemo && (
          <section aria-labelledby="titulo-datos-demo">
            <h3 id="titulo-datos-demo" className={estilos.subtitulo}>
              Datos sintéticos cargados
            </h3>
            <ul className={estilos.conteos}>
              {ETIQUETAS_DATOS.map(({ clave, etiqueta }) => (
                <li key={clave} className={estilos.conteo}>
                  <span className={estilos.numero}>{vista.salud.datosDemo![clave]}</span>
                  <span className={estilos.etiquetaConteo}>{etiqueta}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Tarjeta>
  );
}
