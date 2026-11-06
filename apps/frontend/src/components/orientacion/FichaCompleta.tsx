'use client';

import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  ChevronRight,
  Clock,
  FileText,
  Info,
  Landmark,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Aviso, Boton, BotonEnlace, EnlaceVolver, ErrorDePagina, Insignia } from '@/components/ui';
import { ESTADOS_FUENTE, TIPOS_CANAL } from '@/config/fuentes';
import { ErrorApi, mensajeDeError } from '@/lib/api/cliente';
import { obtenerServicio, type FichaServicio } from '@/lib/api/orientacion';
import { formatearFecha } from '@/lib/fechas';
import comun from '../comun.module.css';
import { ContactoServicio, IconoCanal } from './ContactoServicio';
import { ContactoWhatsApp } from './ContactoWhatsApp';
import estilos from './FichaCompleta.module.css';
import { HorarioAtencion, tieneHorario } from './HorarioAtencion';
import { ModalFicha } from './ModalFicha';
import { AVISO_PLATAFORMA, DatosVerificacion, TemasRelacionados } from './PiezasFicha';
import { UbicacionServicio } from './UbicacionServicio';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; servicio: FichaServicio }
  | { tipo: 'no_disponible' }
  | { tipo: 'error'; mensaje: string };

type Seccion = 'contacto' | 'informacion' | 'fuente' | 'sobre';

/**
 * Ficha de servicio (F05, F06, B.6). Un resumen arriba y cada bloque de la ficha en su propio
 * modal: cómo contactar, qué ofrece, fuente y verificación, y sobre esta información. Se mantiene
 * el orden de transparencia: institución · servicio o canal · información · canal · fuente ·
 * verificado · estado. Todo el contenido viene del servicio real (sin textos inventados).
 */
export function FichaCompleta() {
  const { id } = useParams<{ id: string }>();
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [abierta, setAbierta] = useState<Seccion | null>(null);

  useEffect(() => {
    let vigente = true;
    obtenerServicio(id)
      .then(({ servicio }) => vigente && setEstado({ tipo: 'listo', servicio }))
      .catch((e: unknown) => {
        if (!vigente) return;
        setEstado(
          e instanceof ErrorApi && e.estado === 404
            ? { tipo: 'no_disponible' }
            : { tipo: 'error', mensaje: mensajeDeError(e) },
        );
      });
    return () => {
      vigente = false;
    };
  }, [id]);

  if (estado.tipo === 'cargando') return <FichaCargando />;
  if (estado.tipo === 'error') {
    return (
      <ErrorDePagina
        mensaje={estado.mensaje}
        volverA="/orientacion"
        textoVolver="Ver todos los temas"
      />
    );
  }
  if (estado.tipo === 'no_disponible') {
    return (
      <div className={comun.pagina}>
        <Aviso tono="advertencia" titulo="Este servicio no está disponible">
          Puede que ya no esté vigente. Consulta otras opciones en Orientación o en «Necesito
          ayuda».
        </Aviso>
        <div className={comun.fila}>
          <BotonEnlace href="/orientacion">Ir a Orientación</BotonEnlace>
        </div>
      </div>
    );
  }

  const { servicio } = estado;
  const insigniaEstado = ESTADOS_FUENTE[servicio.estado];
  const cerrar = () => setAbierta(null);
  const verificado = formatearFecha(servicio.fechaVerificacion);

  const acciones: {
    seccion: Seccion;
    icono: ReactNode;
    titulo: string;
    resumen: string;
  }[] = [
    {
      seccion: 'contacto',
      icono: <IconoCanal tipo={servicio.tipoCanal} tamano={22} />,
      titulo: 'Cómo contactar',
      resumen: [TIPOS_CANAL[servicio.tipoCanal], servicio.horario].filter(Boolean).join(' · '),
    },
    {
      seccion: 'informacion',
      icono: <FileText size={22} strokeWidth={1.9} />,
      titulo: 'Qué ofrece',
      resumen:
        servicio.necesidades.length > 0
          ? `Temas: ${servicio.necesidades.map((n) => n.nombre).join(', ')}`
          : 'Descripción del servicio',
    },
    {
      seccion: 'fuente',
      icono: <BadgeCheck size={22} strokeWidth={1.9} />,
      titulo: 'Fuente y verificación',
      resumen: `Verificado el ${verificado}`,
    },
    {
      seccion: 'sobre',
      icono: <ShieldCheck size={22} strokeWidth={1.9} />,
      titulo: 'Sobre esta información',
      resumen: 'Qué hace la plataforma y qué no',
    },
  ];

  return (
    <div className={estilos.pagina}>
      <nav aria-label="Ruta">
        <EnlaceVolver href="/orientacion">Volver a Orientación</EnlaceVolver>
      </nav>

      {/* Resumen del servicio */}
      <section className={estilos.resumen} aria-labelledby="titulo-servicio">
        <span className={estilos.iconoCanal} aria-hidden="true">
          <IconoCanal tipo={servicio.tipoCanal} tamano={28} />
        </span>
        <div className={estilos.textosResumen}>
          <p className={estilos.institucion}>
            <Landmark aria-hidden="true" size={16} />
            {servicio.institucion}
          </p>
          <h1 id="titulo-servicio" className={estilos.titulo}>
            {servicio.servicio}
          </h1>
          <div className={estilos.insignias}>
            <Insignia tono={insigniaEstado.tono}>{insigniaEstado.etiqueta}</Insignia>
            {servicio.esDemo && <Insignia tono="info">Dato de demostración</Insignia>}
            <span className={estilos.verificado}>
              <CalendarCheck aria-hidden="true" size={15} />
              Verificado el {verificado}
            </span>
          </div>
          <p className={estilos.descripcion}>{servicio.descripcion}</p>
          <div className={estilos.botones}>
            <Boton onClick={() => setAbierta('contacto')}>
              Cómo contactar
              <ArrowRight aria-hidden="true" size={18} />
            </Boton>
            <Boton variante="secundario" onClick={() => setAbierta('informacion')}>
              Ver detalles
            </Boton>
          </div>
        </div>
      </section>

      {servicio.estado === 'requiere_revision' && (
        <Aviso tono="advertencia" titulo="Información en revisión">
          Estamos volviendo a comprobar este canal y algunos datos podrían haber cambiado.
          Confírmalos en la fuente original antes de usarlo.
        </Aviso>
      )}
      {servicio.esDemo && (
        <Aviso tono="info" titulo="DATO DE DEMOSTRACIÓN">
          Este registro es ficticio: muestra cómo funciona el prototipo y no corresponde a un
          servicio real.
        </Aviso>
      )}

      {/* Dónde queda (atención presencial): a la vista, sin abrir un modal. */}
      <UbicacionServicio servicio={servicio} />

      {/* Cada bloque de la ficha abre su modal */}
      <ul className={estilos.acciones} aria-label="Información del servicio">
        {acciones.map((accion) => (
          <li key={accion.seccion}>
            <button
              type="button"
              className={`${estilos.accion} con-luz`}
              aria-haspopup="dialog"
              onClick={() => setAbierta(accion.seccion)}
            >
              <span className={estilos.iconoAccion} aria-hidden="true">
                {accion.icono}
              </span>
              <span className={estilos.textosAccion}>
                <span className={estilos.tituloAccion}>{accion.titulo}</span>
                <span className={estilos.resumenAccion}>{accion.resumen}</span>
              </span>
              <ChevronRight aria-hidden="true" size={20} className={estilos.flecha} />
            </button>
          </li>
        ))}
      </ul>

      <p className={comun.suave}>{AVISO_PLATAFORMA}</p>

      {/* ── Modales ─────────────────────────────────────── */}
      <ModalFicha
        abierto={abierta === 'contacto'}
        alCerrar={cerrar}
        icono={<IconoCanal tipo={servicio.tipoCanal} tamano={22} />}
        antetitulo={servicio.institucion}
        titulo="Cómo contactar"
        pie={
          <Boton variante="secundario" onClick={cerrar}>
            Listo
          </Boton>
        }
      >
        <div className={estilos.bloque}>
          <p className={estilos.rotulo}>Canal</p>
          {/* El WhatsApp va aparte, con su botón grande. */}
          <ContactoServicio servicio={servicio} sinWhatsapp />
        </div>
        {servicio.whatsapp && (
          <div className={estilos.bloque}>
            <p className={estilos.rotulo}>WhatsApp</p>
            <ContactoWhatsApp numero={servicio.whatsapp} servicio={servicio.servicio} />
          </div>
        )}
        {(servicio.ubicacion || servicio.direccion) && (
          <div className={estilos.bloque}>
            <p className={estilos.rotulo}>Dirección</p>
            <UbicacionServicio servicio={servicio} compacta />
          </div>
        )}
        {tieneHorario(servicio) && (
          <div className={estilos.bloque}>
            <p className={estilos.rotulo}>
              <Clock aria-hidden="true" size={16} />
              Horario de atención
            </p>
            <HorarioAtencion servicio={servicio} />
          </div>
        )}
        {servicio.estado === 'requiere_revision' && (
          <Aviso tono="advertencia" titulo="Información en revisión">
            Confirma los datos en la fuente original antes de usarlo.
          </Aviso>
        )}
      </ModalFicha>

      <ModalFicha
        abierto={abierta === 'informacion'}
        alCerrar={cerrar}
        icono={<FileText size={22} strokeWidth={1.9} />}
        antetitulo={servicio.institucion}
        titulo="Qué ofrece"
        pie={
          <>
            <Boton variante="secundario" onClick={cerrar}>
              Cerrar
            </Boton>
            <Boton onClick={() => setAbierta('contacto')}>Cómo contactar</Boton>
          </>
        }
      >
        <div className={estilos.bloque}>
          <p className={estilos.rotulo}>Servicio o canal</p>
          <p className={estilos.destacado}>{servicio.servicio}</p>
        </div>
        <div className={estilos.bloque}>
          <p className={estilos.rotulo}>Información</p>
          <p>{servicio.descripcion}</p>
        </div>
        {servicio.necesidades.length > 0 && (
          <div className={estilos.bloque}>
            <p className={estilos.rotulo}>
              <Layers aria-hidden="true" size={16} />
              Temas relacionados
            </p>
            <TemasRelacionados necesidades={servicio.necesidades} />
          </div>
        )}
      </ModalFicha>

      <ModalFicha
        abierto={abierta === 'fuente'}
        alCerrar={cerrar}
        icono={<BadgeCheck size={22} strokeWidth={1.9} />}
        antetitulo={servicio.institucion}
        titulo="Fuente y verificación"
        pie={
          <Boton variante="secundario" onClick={cerrar}>
            Cerrar
          </Boton>
        }
      >
        <DatosVerificacion servicio={servicio} />
        {servicio.estado === 'requiere_revision' && (
          <Aviso tono="advertencia" titulo="Información en revisión">
            Estamos volviendo a comprobar este canal y algunos datos podrían haber cambiado.
            Confírmalos en la fuente original antes de usarlo.
          </Aviso>
        )}
      </ModalFicha>

      <ModalFicha
        abierto={abierta === 'sobre'}
        alCerrar={cerrar}
        icono={<Info size={22} strokeWidth={1.9} />}
        antetitulo="Comunidad Protegida"
        titulo="Sobre esta información"
        pie={
          <>
            <BotonEnlace href="/orientacion" variante="secundario">
              Ver todos los temas
            </BotonEnlace>
            <Boton onClick={cerrar}>Entendido</Boton>
          </>
        }
      >
        <p>{AVISO_PLATAFORMA}</p>
        <p>
          Cada ficha indica su fuente original y la fecha en que se verificó por última vez. Estado
          actual: <Insignia tono={insigniaEstado.tono}>{insigniaEstado.etiqueta}</Insignia>
        </p>
        {servicio.esDemo && (
          <Aviso tono="info" titulo="DATO DE DEMOSTRACIÓN">
            Este registro es ficticio: muestra cómo funciona el prototipo y no corresponde a un
            servicio real.
          </Aviso>
        )}
      </ModalFicha>
    </div>
  );
}

/** Mientras carga: la misma forma que la ficha (sin saltos de diseño al llegar los datos). */
function FichaCargando() {
  return (
    <div className={estilos.pagina} role="status" aria-label="Cargando el servicio…">
      <span className={`esqueleto ${estilos.esqueletoVolver}`} />
      <span className={`esqueleto ${estilos.esqueletoResumen}`} />
      <div className={estilos.esqueletoAcciones}>
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className="esqueleto" />
        ))}
      </div>
    </div>
  );
}
