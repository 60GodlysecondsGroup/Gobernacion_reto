'use client';

import Link from 'next/link';
import { ChatAsistente } from '@/components/chat-asistente/ChatAsistente';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import {
  preguntarAsistenteUsuario,
  type RespuestaAsistenteUsuario,
} from '@/lib/api/asistente-usuario';
import estilos from './AsistenteUsuario.module.css';

const SUGERENCIAS = [
  '¿Cómo puedo ingresar a una sala?',
  '¿Dónde encuentro los canales de ayuda?',
  '¿Cómo configuro mi perfil?',
  '¿Cómo reporto un contenido?',
];

const textoDe = (respuesta: RespuestaAsistenteUsuario) => respuesta.respuesta;

function accesosDe(respuesta: RespuestaAsistenteUsuario) {
  if (respuesta.accesos.length === 0) return null;
  return (
    <nav className={estilos.accesos} aria-label="Accesos relacionados">
      {respuesta.accesos.map((acceso, indice) =>
        acceso.href.startsWith('tel:') ? (
          <a href={acceso.href} key={acceso.href + '-' + indice}>
            {acceso.texto}
          </a>
        ) : (
          <Link href={acceso.href} key={acceso.href + '-' + indice}>
            {acceso.texto}
          </Link>
        ),
      )}
    </nav>
  );
}

export function AsistenteUsuario() {
  return (
    <section className={estilos.pagina}>
      <EncabezadoPagina antetitulo="Guía de la plataforma" titulo="Asistente de orientación">
        Te ayudo a encontrar funciones, salas y recursos publicados. No doy atención clínica ni
        reemplazo los canales humanos de ayuda.
      </EncabezadoPagina>

      <ChatAsistente
        nombre="Cocuyo te orienta"
        descripcion="Respuestas sobre cómo usar Refugio"
        bienvenida={{
          titulo: 'Hola, ¿qué quieres hacer?',
          texto: 'Pregúntame cómo navegar o elige una consulta frecuente.',
        }}
        sugerencias={SUGERENCIAS}
        campo={{
          id: 'pregunta-asistente-usuario',
          etiqueta: 'Escribe una pregunta sobre cómo usar la aplicación',
          placeholder: '¿Cómo encuentro una sala?',
        }}
        textoGenerando="Buscando una respuesta…"
        tituloError="No pude responder ahora"
        preguntar={preguntarAsistenteUsuario}
        textoDe={textoDe}
        extras={accesosDe}
        nota={
          <p>
            Algunas preguntas se envían a un proveedor externo de IA. No escribas nombres, teléfonos
            ni detalles personales o de salud. Si necesitas ayuda urgente, abre{' '}
            <Link href="/ayuda">Necesito ayuda</Link>. El asistente no contacta servicios de
            emergencia.
          </p>
        }
      />
    </section>
  );
}
