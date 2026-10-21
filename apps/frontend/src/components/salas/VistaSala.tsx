'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso, Boton, BotonEnlace, Tarjeta } from '@/components/ui';
import { ErrorApi, mensajeDeError } from '@/lib/api/cliente';
import { CIERRE, obtenerSala, type SalaDetalle } from '@/lib/api/salas';
import comun from '../comun.module.css';
import { OcupacionSala } from './OcupacionSala';
import { SalaEnVivo } from './SalaEnVivo';
import estilos from './Salas.module.css';
import { useSalaEnVivo } from './useSalaEnVivo';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'lista'; sala: SalaDetalle }
  | { tipo: 'no_encontrada' }
  | { tipo: 'error'; mensaje: string };

const reglasDe = (texto: string) =>
  texto
    .split(/(?<=\.)\s+/)
    .map((regla) => regla.trim())
    .filter(Boolean);

/**
 * Antesala y sala (F11–F15): antes de entrar se ven el tema, las reglas y la ocupación.
 * Al entrar se abre la conexión en tiempo real; al salir o perderla, se vuelve a la antesala.
 */
export function VistaSala() {
  const { id } = useParams<{ id: string }>();
  // Con `key`, ir a otra sala empieza de cero: nunca se entra sin pulsar «Entrar».
  return <Sala key={id} id={id} />;
}

function Sala({ id }: { id: string }) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const { estado: vivo, iniciado, entrar, salir, enviar, limpiarAvisosChat } = useSalaEnVivo(id);
  const fin = vivo.fin;

  // Al cargar y cada vez que termina una conexión, se refresca la antesala (ocupación y estado).
  useEffect(() => {
    let vigente = true;
    obtenerSala(id)
      .then(({ sala }) => vigente && setEstado({ tipo: 'lista', sala }))
      .catch((e: unknown) => {
        if (!vigente) return;
        setEstado(
          e instanceof ErrorApi && e.estado === 404
            ? { tipo: 'no_encontrada' }
            : { tipo: 'error', mensaje: mensajeDeError(e) },
        );
      });
    return () => {
      vigente = false;
    };
  }, [id, fin]);

  const volver = (
    <nav aria-label="Ruta" className={comun.suave}>
      <Link href="/salas">← Volver a las salas</Link>
    </nav>
  );

  if (estado.tipo === 'cargando') return <p className={comun.cargando}>Cargando la sala…</p>;
  if (estado.tipo === 'error') return <Aviso tono="peligro">{estado.mensaje}</Aviso>;
  if (estado.tipo === 'no_encontrada') {
    return (
      <div className={comun.pagina}>
        {volver}
        <Aviso tono="peligro" titulo="No encontramos esa sala en tu comunidad" />
      </div>
    );
  }

  const { sala } = estado;
  const enSala = iniciado && vivo.fase !== 'fuera';

  if (enSala) {
    return (
      <div className={estilos.paginaSala}>
        {volver}
        <EncabezadoPagina antetitulo="Sala temática" titulo={sala.nombre} />
        {vivo.fase === 'conectando' ? (
          <p className={comun.cargando} aria-busy="true">
            Entrando a la sala…
          </p>
        ) : (
          <SalaEnVivo
            sala={sala}
            estado={vivo}
            enviar={enviar}
            salir={salir}
            limpiarAvisosChat={limpiarAvisosChat}
          />
        )}
      </div>
    );
  }

  const cerrada = sala.estado === 'cerrada';

  return (
    <div className={comun.pagina}>
      {volver}
      <EncabezadoPagina antetitulo="Sala temática" titulo={sala.nombre}>
        {sala.descripcion}
      </EncabezadoPagina>

      {fin && (
        <Aviso tono={fin.codigo === CIERRE.SALIDA ? 'info' : 'advertencia'}>{fin.mensaje}</Aviso>
      )}

      {cerrada ? (
        <Aviso tono="info" titulo="Esta sala se cerró porque estuvo vacía un tiempo">
          {sala.instanciaVigente ? (
            <BotonEnlace href={`/salas/${sala.instanciaVigente}`} variante="secundario">
              Ir a la sala «{sala.nombre}» abierta
            </BotonEnlace>
          ) : (
            <Link href="/salas">Ver las salas abiertas</Link>
          )}
        </Aviso>
      ) : (
        <>
          <div className={comun.fila}>
            <OcupacionSala sala={sala} />
          </div>
          <Tarjeta titulo="Reglas de la sala">
            <ul className={estilos.reglas}>
              {reglasDe(sala.reglas).map((regla) => (
                <li key={regla}>{regla}</li>
              ))}
            </ul>
          </Tarjeta>
          <Aviso tono="info" titulo="Cómo funciona">
            Entras con tu alias y tu avatar. Puedes moverte por la sala y conversar con quienes
            están dentro. El chat no se guarda: solo ves los mensajes desde que entras. Cada mensaje
            se revisa antes de mostrarse.
          </Aviso>
          <div className={comun.fila}>
            <Boton onClick={entrar}>{fin ? 'Volver a entrar' : 'Entrar a la sala'}</Boton>
          </div>
        </>
      )}
    </div>
  );
}
