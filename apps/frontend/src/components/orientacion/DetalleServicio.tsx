'use client';

import {
  ArrowUpRight,
  BadgeCheck,
  CalendarCheck,
  Clock,
  FileText,
  Globe,
  Headset,
  MessageCircle,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { Aviso, Boton, BotonEnlace, Insignia } from '@/components/ui';
import { ESTADOS_FUENTE, TIPOS_CANAL } from '@/config/fuentes';
import type { FichaServicio } from '@/lib/api/orientacion';
import { formatearFecha } from '@/lib/fechas';
import { dominio, hrefTelefono, IconoCanal } from './ContactoServicio';
import estilos from './DetalleServicio.module.css';
import { ModalFicha } from './ModalFicha';
import { AVISO_PLATAFORMA, DatosVerificacion, TemasRelacionados } from './PiezasFicha';

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
 * Contenido completo de la ficha, por secciones: estado, cómo contactar (teléfono, enlace,
 * horario), qué ofrece, fuente y verificación. Solo se muestran los datos que tiene el servicio:
 * nada inventado ni campos vacíos. Los registros de demostración muestran su contacto como texto,
 * sin enlaces ni llamadas (como en las tarjetas).
 */
export function DetalleServicio({ servicio }: { servicio: FichaServicio }) {
  const idContacto = useId();
  const idOfrece = useId();
  const idFuente = useId();
  const estado = ESTADOS_FUENTE[servicio.estado];
  const { telefono, enlace, horario, esDemo } = servicio;
  const esChat = servicio.tipoCanal === 'chat';

  return (
    <>
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

      <div className={estilos.distribucion}>
        <section className={estilos.contacto} aria-labelledby={idContacto}>
          <h3 id={idContacto} className={estilos.tituloSeccion}>
            <Headset aria-hidden="true" size={18} />
            Cómo contactar
          </h3>
          <p className={estilos.canal}>
            <span className={estilos.rotulo}>Canal</span>
            <span className={estilos.valorCanal}>
              <IconoCanal tipo={servicio.tipoCanal} tamano={16} />
              {TIPOS_CANAL[servicio.tipoCanal]}
            </span>
          </p>

          {(telefono || enlace) && (
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
            </ul>
          )}

          {horario && (
            <div className={estilos.horario}>
              <span className={estilos.iconoHorario} aria-hidden="true">
                <Clock size={18} />
              </span>
              <div>
                <p className={estilos.rotulo}>Horario de atención</p>
                <p className={estilos.textoHorario}>{horario}</p>
              </div>
            </div>
          )}
        </section>

        <section className={`${estilos.seccion} ${estilos.ofrece}`} aria-labelledby={idOfrece}>
          <h3 id={idOfrece} className={estilos.tituloSeccion}>
            <FileText aria-hidden="true" size={18} />
            Qué ofrece
          </h3>
          <p className={estilos.descripcion}>{servicio.descripcion}</p>
          {servicio.necesidades.length > 0 && (
            <div className={estilos.bloque}>
              <p className={estilos.rotulo}>Temas relacionados</p>
              <TemasRelacionados necesidades={servicio.necesidades} />
            </div>
          )}
        </section>

        <section className={`${estilos.seccion} ${estilos.fuente}`} aria-labelledby={idFuente}>
          <h3 id={idFuente} className={estilos.tituloSeccion}>
            <BadgeCheck aria-hidden="true" size={18} />
            Fuente y verificación
          </h3>
          <DatosVerificacion servicio={servicio} />
        </section>
      </div>

      <p className={estilos.nota}>
        <ShieldCheck aria-hidden="true" size={16} />
        {AVISO_PLATAFORMA}
      </p>
    </>
  );
}

/**
 * Un dato de contacto como fila: con `href`, toda la fila es el enlace (llamar o abrir); sin él
 * (registros de demostración), solo texto.
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
        <span className={estilos.valorFila}>{valor}</span>
      </span>
      {href ? (
        <span className={estilos.accionFila} aria-hidden="true">
          {accion}
          {externo && <ArrowUpRight size={16} />}
        </span>
      ) : (
        <span className={estilos.sinEnlace}>Sin enlace: es de demostración</span>
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
