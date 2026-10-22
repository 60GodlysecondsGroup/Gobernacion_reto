'use client';

import { ElementoEscalonado, ListaEscalonada } from '@/components/movimiento/Escalonado';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import {
  BotonEnlace,
  CargandoLista,
  EnlaceVolver,
  ErrorDePagina,
  EstadoVacio,
} from '@/components/ui';
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
    <div className={comun.paginaAncha}>
      <nav aria-label="Ruta" className={estilos.migas}>
        <EnlaceVolver href="/orientacion">Todos los temas</EnlaceVolver>
      </nav>

      {estado.tipo === 'cargando' && <CargandoLista etiqueta="Cargando servicios…" />}
      {estado.tipo === 'error' && (
        <ErrorDePagina
          mensaje={estado.mensaje}
          volverA="/orientacion"
          textoVolver="Ver todos los temas"
        />
      )}

      {estado.tipo === 'listo' && (
        <>
          <EncabezadoPagina antetitulo="Orientación" titulo={estado.necesidad.nombre}>
            {estado.necesidad.descripcion}
          </EncabezadoPagina>
          {estado.servicios.length === 0 ? (
            <EstadoVacio
              titulo="Aún no hay servicios para este tema"
              accion={
                <BotonEnlace href="/orientacion" variante="secundario">
                  Ver otros temas
                </BotonEnlace>
              }
            >
              Mientras tanto, «Necesito ayuda» muestra los canales institucionales disponibles.
            </EstadoVacio>
          ) : (
            <ListaEscalonada className={estilos.rejillaServicios}>
              {estado.servicios.map((servicio) => (
                <ElementoEscalonado key={servicio.id}>
                  <TarjetaServicio servicio={servicio} />
                </ElementoEscalonado>
              ))}
            </ListaEscalonada>
          )}
        </>
      )}
    </div>
  );
}
