'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { useSesion } from '@/components/sesion/ProveedorSesion';
import { Aviso, BotonEnlace, Insignia } from '@/components/ui';
import { mensajeDeError } from '@/lib/api/cliente';
import { obtenerComunidadPropia, type Comunidad } from '@/lib/api/comunidad';
import comun from '../comun.module.css';
import { BuscadorPersonas } from './BuscadorPersonas';
import { ListaHilos } from './ListaHilos';

/** Inicio de la comunidad (F03): bienvenida, reglas, orientación y ayuda, categorías e hilos. */
export function VistaComunidad() {
  const { puede } = useSesion();
  const [comunidad, setComunidad] = useState<Comunidad | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    obtenerComunidadPropia()
      .then(({ comunidad }) => vigente && setComunidad(comunidad))
      .catch((e: unknown) => vigente && setError(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, []);

  if (error) return <Aviso tono="peligro">{error}</Aviso>;
  if (!comunidad) return <p className={comun.cargando}>Cargando tu comunidad…</p>;

  return (
    <div className={comun.pagina}>
      <EncabezadoPagina antetitulo="Tu comunidad" titulo={comunidad.nombre}>
        <div className={comun.fila}>
          <span>{comunidad.descripcion}</span>
          <Insignia tono="info">Rango {comunidad.rango}</Insignia>
        </div>
      </EncabezadoPagina>

      <Aviso tono="info" titulo="Te damos la bienvenida">
        Aquí conversas con tu alias con personas de tu mismo rango de edad; nadie de otra comunidad
        puede ver este espacio. Antes de publicar, revisa las{' '}
        <Link href="/reglas">reglas de la comunidad</Link>. Si buscas información o un canal de
        apoyo, tienes <Link href="/orientacion">Orientación</Link> y el botón «Necesito ayuda».
      </Aviso>

      <div className={comun.fila}>
        {puede('crear_hilo') && <BotonEnlace href="/comunidad/hilos/nuevo">Crear hilo</BotonEnlace>}
        {puede('acceder_salas') && (
          <BotonEnlace href="/salas" variante="secundario">
            Salas temáticas
          </BotonEnlace>
        )}
        <BotonEnlace href="/reglas" variante="secundario">
          Ver las reglas
        </BotonEnlace>
      </div>

      <ListaHilos />
      <BuscadorPersonas />
    </div>
  );
}
