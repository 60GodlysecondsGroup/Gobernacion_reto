import type { Metadata } from 'next';
import Link from 'next/link';
import estilos from '@/components/comunidad/Comunidad.module.css';
import comun from '@/components/comun.module.css';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso, Tarjeta } from '@/components/ui';
import { AVISO_LIMITES } from '@/config/textos';

export const metadata: Metadata = { title: 'Reglas de la comunidad' };

/** Reglas consultables en cualquier momento (F24). Pública: no requiere sesión. */
export default function Reglas() {
  return (
    <div className={comun.pagina}>
      <EncabezadoPagina antetitulo="Comunidad" titulo="Reglas de la comunidad">
        Son pocas y sirven para que este sea un espacio seguro para todas las personas.
      </EncabezadoPagina>

      <Tarjeta titulo="1. Privacidad">
        <ul className={estilos.reglas}>
          <li>Participas con tu alias y tu avatar. No hace falta que nadie sepa quién eres.</li>
          <li>
            Tu edad exacta no se muestra: la plataforma solo usa tu rango para ubicarte en tu
            comunidad.
          </li>
          <li>
            Cuida también tu perfil: no pongas tu nombre completo, tu colegio, tu dirección ni tus
            redes.
          </li>
        </ul>
      </Tarjeta>

      <Tarjeta titulo="2. Convivencia">
        <ul className={estilos.reglas}>
          <li>Trata a los demás con respeto, aunque no pienses igual.</li>
          <li>No se permiten burlas, insultos, acoso ni mensajes que hagan sentir mal a otros.</li>
          <li>Mantén las conversaciones en el tema de cada categoría o sala.</li>
          <li>Comparte experiencias, no consejos médicos: aquí no se diagnostica ni se receta.</li>
        </ul>
      </Tarjeta>

      <Tarjeta titulo="3. Información que no se puede compartir">
        <ul className={estilos.reglas}>
          <li>
            <strong>Datos de contacto:</strong> teléfonos, correos, enlaces o nombres de usuario de
            otras plataformas.
          </li>
          <li>
            <strong>Ubicación:</strong> direcciones, barrios o puntos de encuentro.
          </li>
          <li>
            <strong>Identidad:</strong> nombres completos, documentos o el colegio de alguien.
          </li>
          <li>
            <strong>Edad exacta:</strong> ni decir la tuya ni preguntar la de otros.
          </li>
          <li>
            <strong>Redes y plataformas externas:</strong> invitar a hablar por Instagram, WhatsApp,
            Discord u otras.
          </li>
          <li>
            <strong>Publicidad y comercio:</strong> ventas, promociones o pedir dinero.
          </li>
        </ul>
        <p className={comun.suave}>
          Si un mensaje incluye algo de esto, no se publica y verás un aviso; puedes corregirlo y
          volver a intentarlo. El sistema no detecta todo: por eso existen los reportes.
        </p>
      </Tarjeta>

      <Tarjeta titulo="4. Reportes">
        <ul className={estilos.reglas}>
          <li>
            Cada hilo, respuesta y perfil tiene el botón <strong>Reportar</strong>. Úsalo si ves
            información personal, acoso, contenido inapropiado, intentos de contacto externo o
            publicidad.
          </li>
          <li>
            El reporte es confidencial: la otra persona no sabe quién reportó. Lo revisa el equipo
            de moderación.
          </li>
          <li>Por privacidad, no te contamos qué medida se toma con otra persona.</li>
          <li>Reporta de buena fe: los reportes falsos dificultan proteger a la comunidad.</li>
        </ul>
      </Tarjeta>

      <Tarjeta titulo="5. Límites de la plataforma">
        <p>{AVISO_LIMITES}</p>
      </Tarjeta>

      <Tarjeta titulo="6. Orientación">
        <p>
          Si buscas información confiable o un canal de apoyo, visita{' '}
          <Link href="/orientacion">Orientación</Link> o pulsa{' '}
          <Link href="/ayuda">Necesito ayuda</Link>: ahí están los canales de instituciones, con su
          fuente y fecha de verificación.
        </p>
      </Tarjeta>

      <Aviso tono="info">
        Estas reglas aplican en foros, hilos, salas y perfiles de todas las comunidades.
      </Aviso>
    </div>
  );
}
