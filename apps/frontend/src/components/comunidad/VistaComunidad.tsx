'use client';

import { Building2, PenLine } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { useSesion } from '@/components/sesion/ProveedorSesion';
import { Aviso, BotonEnlace, ErrorDePagina } from '@/components/ui';
import { mensajeDeError } from '@/lib/api/cliente';
import { obtenerComunidadPropia, type Comunidad } from '@/lib/api/comunidad';
import comun from '../comun.module.css';
import estilos from './Comunidad.module.css';
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

  if (error) return <ErrorDePagina mensaje={error} volverA="/" textoVolver="Volver al inicio" />;
  if (!comunidad) {
    return (
      <div className={comun.pagina} aria-busy="true">
        <span className="esqueleto" style={{ height: '6rem' }} />
        <span className="esqueleto" style={{ height: '20rem' }} />
      </div>
    );
  }

  return (
    <div className={estilos.inicio}>
      <EncabezadoPagina
        antetitulo={`Tu comunidad, ${comunidad.rango}`}
        titulo={comunidad.nombre}
        acciones={
          puede('crear_hilo') && (
            <BotonEnlace href="/comunidad/hilos/nuevo">
              <PenLine aria-hidden="true" size={18} />
              Crear hilo
            </BotonEnlace>
          )
        }
      >
        {comunidad.descripcion} Aquí conversas con tu alias con personas de tu mismo rango de edad;
        nadie de otra comunidad puede ver este espacio.
      </EncabezadoPagina>

      <div className={estilos.columnas}>
        <div className={estilos.principal}>
          <ListaHilos />
        </div>

        <aside className={estilos.lateral} aria-label="Más de tu comunidad">
          {puede('acceder_salas') && (
            <Link href="/salas" className={estilos.atajoSalas}>
              <Building2 aria-hidden="true" size={22} />
              <span>
                <strong>Salas temáticas</strong>
                <span>Conversa en tiempo real con tu avatar, hasta 10 personas por sala.</span>
              </span>
            </Link>
          )}
          <Aviso tono="info" titulo="Antes de publicar">
            Revisa las <Link href="/reglas">reglas de la comunidad</Link>. Si buscas información o
            un canal de apoyo, tienes <Link href="/orientacion">Orientación</Link> y el botón
            «Necesito ayuda».
          </Aviso>
          <BuscadorPersonas />
        </aside>
      </div>
    </div>
  );
}
