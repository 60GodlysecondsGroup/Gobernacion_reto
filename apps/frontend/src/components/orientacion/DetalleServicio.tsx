'use client';

import {
  ArrowUpRight,
  BadgeCheck,
  CalendarCheck,
  Clock,
  Globe,
  Headset,
  MessageCircle,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { Fragment, useId, type ReactNode } from 'react';
import { Aviso, Boton, BotonEnlace, Insignia } from '@/components/ui';
import { ESTADOS_FUENTE, TIPOS_CANAL } from '@/config/fuentes';
import type { FichaServicio } from '@/lib/api/orientacion';
import { formatearFecha } from '@/lib/fechas';
import { dominio, hrefTelefono, IconoCanal } from './ContactoServicio';
import { ContactoWhatsApp } from './ContactoWhatsApp';
import estilos from './DetalleServicio.module.css';
import { HorarioAtencion, tieneHorario } from './HorarioAtencion';
import { ModalFicha } from './ModalFicha';
import { AVISO_PLATAFORMA, DatosVerificacion, TemasRelacionados } from './PiezasFicha';
import { UbicacionServicio } from './UbicacionServicio';

/**
 * Consulta rápida de una ficha (F05, F06, B.6): toda la información del servicio en un modal, sin
 * salir de la lista. Lo usan «Necesito ayuda» y las listas de Orientación por tema (también
 * «Información institucional») a través de `RejillaServicios`. La página de la ficha
 * (`/orientacion/servicios/[id]`) sigue existiendo para enlaces directos y otras pestañas.
 */
export function ModalServicio({
  servicio,
  abierto,
  alCerrar,
}: {
  servicio: FichaServicio;
  abierto: boolean;
  alCerrar: () => void;
}) {
  return (
    <ModalFicha
      abierto={abierto}
      alCerrar={alCerrar}
      ancho="amplio"
      icono={<IconoCanal tipo={servicio.tipoCanal} tamano={24} />}
      antetitulo={servicio.institucion}
      titulo={servicio.servicio}
      pie={
        <>
          <BotonEnlace
            href={`/orientacion/servicios/${servicio.id}`}
            variante="fantasma"
            className={estilos.enlacePagina}
          >
            Abrir la ficha en su página
          </BotonEnlace>
          <Boton variante="secundario" onClick={alCerrar}>
            Cerrar
          </Boton>
        </>
      }
    >
      <DetalleServicio servicio={servicio} />
    </ModalFicha>
  );
}

/**
 * Contenido completo de la ficha, de lo general a lo concreto:
 * 1. Estado y verificación, y los avisos (en revisión, demostración).
 * 2. Qué ofrece: la descripción como texto principal y sus temas.
 * 3. Cómo usarlo, en tarjetas: contacto (teléfono, enlace y, si lo tiene, WhatsApp), horario de
 *    atención y dónde queda (el mapa y sus botones abren el punto registrado en Google Maps).
 *    En pantallas amplias van en dos columnas: el contacto siempre a la izquierda; con mapa, el
 *    horario debajo del contacto y el mapa a la derecha; sin mapa, el horario a la derecha.
 * 4. Fuente y verificación, y el aviso de la plataforma.
 * Solo se muestran los datos que tiene el servicio: nada inventado ni secciones vacías. Los
 * registros de demostración muestran su contacto como texto, sin enlaces ni llamadas.
 */
export function DetalleServicio({ servicio }: { servicio: FichaServicio }) {
  const idOfrece = useId();
  const idContacto = useId();
  const idHorario = useId();
  const idFuente = useId();
  const estado = ESTADOS_FUENTE[servicio.estado];
  const { telefono, enlace, esDemo } = servicio;
  // `|| null`: también si la API aún no envía el campo (base sin la migración 0014).
  const whatsapp = servicio.whatsapp || null;
  const esChat = servicio.tipoCanal === 'chat';
  const conMapa = Boolean(servicio.ubicacion);
  const conUbicacion = conMapa || Boolean(servicio.direccion);
  const conHorario = tieneHorario(servicio);

  const contacto = (
    <section
      className={`${estilos.tarjeta} ${estilos.tarjetaContacto}`}
      aria-labelledby={idContacto}
    >
      <div className={estilos.cabeceraTarjeta}>
        <h3 id={idContacto} className={estilos.tituloSeccion}>
          <Headset aria-hidden="true" size={18} />
          Cómo contactar
        </h3>
        <span className={estilos.canal}>
          <IconoCanal tipo={servicio.tipoCanal} tamano={15} />
          <span className="visualmente-oculto">Canal: </span>
          {TIPOS_CANAL[servicio.tipoCanal]}
        </span>
      </div>

      {telefono || enlace || whatsapp ? (
        <ul className={estilos.filas} aria-label="Datos de contacto">
          {telefono && (
            <li>
              <FilaContacto
                icono={<Phone size={18} />}
                rotulo="Teléfono"
                valor={telefono}
                accion="Llamar"
                href={esDemo ? null : hrefTelefono(telefono)}
                etiqueta={`Llamar al ${telefono}`}
              />
            </li>
          )}
          {enlace && (
            <li>
              <FilaContacto
                icono={esChat ? <MessageCircle size={18} /> : <Globe size={18} />}
                rotulo={esChat ? 'Chat' : 'Sitio web'}
                valor={dominio(enlace)}
                accion="Abrir"
                href={esDemo ? null : enlace}
                externo
                etiqueta={`Abrir ${dominio(enlace)} (sitio oficial, se abre en otra pestaña)`}
              />
            </li>
          )}
          {whatsapp && (
            <li>
              <ContactoWhatsApp numero={whatsapp} servicio={servicio.servicio} esDemo={esDemo} />
            </li>
          )}
        </ul>
      ) : (
        <p className={estilos.sinDatos}>
          {servicio.tipoCanal === 'presencial' && conUbicacion
            ? 'Atención presencial: consulta la dirección en «Dónde queda».'
            : 'Esta ficha no registra teléfono ni enlace de contacto.'}
        </p>
      )}
    </section>
  );

  const horario = conHorario && (
    <section className={`${estilos.tarjeta} ${estilos.ordenHorario}`} aria-labelledby={idHorario}>
      <h3 id={idHorario} className={estilos.tituloSeccion}>
        <Clock aria-hidden="true" size={18} />
        Horario de atención
      </h3>
      <HorarioAtencion servicio={servicio} />
    </section>
  );

  return (
    <div className={estilos.detalle}>
      <div className={estilos.encabezado}>
        <div className={estilos.estado}>
          <Insignia tono={estado.tono}>{estado.etiqueta}</Insignia>
          {esDemo && <Insignia tono="info">Dato de demostración</Insignia>}
          <span className={estilos.verificado}>
            <CalendarCheck aria-hidden="true" size={15} />
            Verificado el {formatearFecha(servicio.fechaVerificacion)}
          </span>
        </div>

        {servicio.estado === 'requiere_revision' && (
          <Aviso tono="advertencia" titulo="Información en revisión">
            Estamos volviendo a comprobar este canal y algunos datos podrían haber cambiado.
            Confírmalos en la fuente original antes de usarlo.
          </Aviso>
        )}
        {esDemo && (
          <Aviso tono="info" titulo="DATO DE DEMOSTRACIÓN">
            Este registro es ficticio: muestra cómo funciona el prototipo y no corresponde a un
            servicio real.
          </Aviso>
        )}
      </div>

      <section className={estilos.ofrece} aria-labelledby={idOfrece}>
        <h3 id={idOfrece} className={estilos.rotuloSeccion}>
          Qué ofrece
        </h3>
        <p className={estilos.descripcion}>{servicio.descripcion}</p>
        {servicio.necesidades.length > 0 && (
          <div className={estilos.temas}>
            <p className={estilos.rotulo}>Temas relacionados</p>
            <TemasRelacionados necesidades={servicio.necesidades} />
          </div>
        )}
      </section>

      <div
        className={
          conUbicacion || conHorario
            ? `${estilos.columnas} ${estilos.dosColumnas}`
            : estilos.columnas
        }
      >
        {/* Columnas equilibradas: el mapa es alto, así que con mapa el horario va bajo el
            contacto; sin mapa (solo dirección, o sin sede), el horario va a la derecha. */}
        <div className={estilos.columna}>
          {contacto}
          {conMapa && horario}
        </div>
        {(conUbicacion || horario) && (
          <div className={estilos.columna}>
            {conUbicacion && (
              // Sede física (presencial o híbrida): mapa, dirección y «Cómo llegar».
              <div className={`${estilos.tarjeta} ${estilos.ordenUbicacion}`}>
                <UbicacionServicio servicio={servicio} nivelTitulo="h3" sinMarco />
              </div>
            )}
            {!conMapa && horario}
          </div>
        )}
      </div>

      <section className={`${estilos.tarjeta} ${estilos.fuente}`} aria-labelledby={idFuente}>
        <h3 id={idFuente} className={estilos.tituloSeccion}>
          <BadgeCheck aria-hidden="true" size={18} />
          Fuente y verificación
        </h3>
        <DatosVerificacion servicio={servicio} enRejilla />
      </section>

      <p className={estilos.nota}>
        <ShieldCheck aria-hidden="true" size={16} />
        {AVISO_PLATAFORMA}
      </p>
    </div>
  );
}

/** Permite cortar un dominio largo en sus puntos («bienestar-demo.<wbr>example.<wbr>test»). */
const conCortes = (texto: string) =>
  texto.split('.').map((parte, i, partes) => (
    <Fragment key={i}>
      {parte}
      {i < partes.length - 1 && (
        <>
          .<wbr />
        </>
      )}
    </Fragment>
  ));

/**
 * Un dato de contacto como fila: con `href`, toda la fila es el enlace (llamar o abrir); sin él
 * (registros de demostración), solo texto, con la aclaración debajo del dato.
 */
function FilaContacto({
  icono,
  rotulo,
  valor,
  accion,
  href,
  externo = false,
  etiqueta,
}: {
  icono: ReactNode;
  rotulo: string;
  valor: string;
  accion: string;
  href: string | null;
  externo?: boolean;
  etiqueta: string;
}) {
  const contenido = (
    <>
      <span className={estilos.iconoFila} aria-hidden="true">
        {icono}
      </span>
      <span className={estilos.textosFila}>
        <span className={estilos.rotulo}>{rotulo}</span>
        <span className={estilos.valorFila}>{conCortes(valor)}</span>
        {!href && <span className={estilos.sinEnlace}>Sin enlace: es de demostración</span>}
      </span>
      {href && (
        <span className={estilos.accionFila} aria-hidden="true">
          {accion}
          {externo && <ArrowUpRight size={16} />}
        </span>
      )}
    </>
  );

  if (!href) return <div className={estilos.fila}>{contenido}</div>;
  return (
    <a
      className={`${estilos.fila} ${estilos.filaAccion}`}
      href={href}
      aria-label={etiqueta}
      {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {contenido}
    </a>
  );
}
