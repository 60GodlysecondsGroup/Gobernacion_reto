'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso } from '@/components/ui';
import { ErrorApi, mensajeDeError } from '@/lib/api/cliente';
import { obtenerServiciosDe, type FichaServicio, type Necesidad } from '@/lib/api/orientacion';
import comun from '../comun.module.css';
import estilos from './Orientacion.module.css';
import { TarjetaServicio } from './TarjetaServicio';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; necesidad: Necesidad; servicios: FichaServicio[] }
  | { tipo: 'error'; mensaje: string };

export function ServiciosPorNecesidad() {
  const { necesidad: codigo } = useParams<{ necesidad: string }>();
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  useEffect(() => {
    let vigente = true;
    obtenerServiciosDe(codigo)
      .then((r) => vigente && setEstado({ tipo: 'listo', ...r }))
      .catch((e: unknown) => {
        if (!vigente) return;
        const mensaje =
          e instanceof ErrorApi && e.estado === 404 ? 'Ese tema no existe.' : mensajeDeError(e);
        setEstado({ tipo: 'error', mensaje });
      });
    return () => {
      vigente = false;
    };
  }, [codigo]);

  return (
    <div className={comun.pagina}>
      <nav aria-label="Ruta" className={estilos.migas}>
        <Link href="/orientacion">← Todos los temas</Link>
      </nav>

      {estado.tipo === 'cargando' && <p className={comun.cargando}>Cargando servicios…</p>}
      {estado.tipo === 'error' && <Aviso tono="peligro">{estado.mensaje}</Aviso>}

      {estado.tipo === 'listo' && (
        <>
          <EncabezadoPagina antetitulo="Orientación" titulo={estado.necesidad.nombre}>
            {estado.necesidad.descripcion}
          </EncabezadoPagina>
          {estado.servicios.length === 0 ? (
            <Aviso tono="info">Aún no hay servicios registrados para este tema.</Aviso>
          ) : (
            <ul className={comun.lista}>
              {estado.servicios.map((servicio) => (
                <li key={servicio.id}>
                  <TarjetaServicio servicio={servicio} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
