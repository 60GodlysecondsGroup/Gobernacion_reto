import { MapPin, Navigation, Search } from 'lucide-react';
import { useId } from 'react';
import { MapaUbicacion } from '@/components/mapas/MapaUbicacion';
import { BotonEnlaceExterno } from '@/components/ui';
import type { FichaServicio } from '@/lib/api/orientacion';
import { urlBuscarDireccion, urlComoLlegar, urlVerEnMapa } from '@/lib/mapas';
import estilos from './UbicacionServicio.module.css';

type Props = {
  servicio: Pick<FichaServicio, 'servicio' | 'institucion' | 'direccion' | 'ubicacion' | 'esDemo'>;
  /** Nivel del título según dónde se use (en la ficha, h2; dentro de una sección del modal, h4). */
  nivelTitulo?: 'h2' | 'h3' | 'h4';
  /** Sin mapa: solo dirección y acciones (p. ej. dentro de «Cómo contactar»). */
  compacta?: boolean;
  /** Sin el marco de tarjeta, cuando ya va dentro de una sección enmarcada (modal de la ficha). */
  sinMarco?: boolean;
};

const AVISO_PRIVACIDAD =
  'Google Maps te muestra la ruta desde donde tú decidas. Esta plataforma no conoce ni guarda tu ubicación.';

/**
 * «Dónde queda» de una fuente con atención presencial (o híbrida):
 * - Con ubicación: mapa pequeño con su marcador, la dirección de ese mismo punto, «Cómo llegar»
 *   (indicaciones en Google Maps, sin origen) y «Ver en Google Maps».
 * - Solo con dirección escrita: la dirección y «Buscar en Google Maps» (no se inventa un punto).
 * - Sin dirección ni ubicación: no se muestra nada (nunca un mapa vacío).
 *
 * Nunca usa la geolocalización del navegador ni pide permisos de ubicación. El mapa y sus
 * botones abren Google Maps también en los datos de demostración (con un aviso de que el punto
 * no es una sede real): ver un lugar no contacta a nadie, a diferencia de llamar o abrir un sitio.
 */
export function UbicacionServicio({
  servicio,
  nivelTitulo = 'h2',
  compacta = false,
  sinMarco = false,
}: Props) {
  const idTitulo = useId();
  const { ubicacion, direccion, esDemo } = servicio;
  if (!ubicacion && !direccion) return null;

  const Titulo = nivelTitulo;
  const lugar = `${servicio.servicio} (${servicio.institucion})`;
  // La dirección escrita complementa la del mapa (piso, oficina…) solo si dice algo distinto.
  const indicaciones =
    ubicacion && direccion && direccion.trim() !== ubicacion.direccion.trim() ? direccion : null;

  return (
    <section
      className={[estilos.ubicacion, (compacta || sinMarco) && estilos.sinMarco]
        .filter(Boolean)
        .join(' ')}
      aria-label={compacta ? 'Dirección' : undefined}
      aria-labelledby={compacta ? undefined : idTitulo}
    >
      {!compacta && (
        <Titulo id={idTitulo} className={estilos.titulo}>
          <MapPin aria-hidden="true" size={20} />
          Dónde queda
        </Titulo>
      )}

      {ubicacion && !compacta && (
        <MapaUbicacion ubicacion={ubicacion} lugar={lugar} enlace={urlVerEnMapa(ubicacion)} />
      )}

      <div className={estilos.datos}>
        <address className={estilos.direccion}>
          {compacta && <MapPin aria-hidden="true" size={16} className={estilos.icono} />}
          <span>{ubicacion ? ubicacion.direccion : direccion}</span>
        </address>
        {indicaciones && (
          <p className={estilos.indicaciones}>
            <span className={estilos.rotulo}>Indicaciones:</span> {indicaciones}
          </p>
        )}
        {!ubicacion && !compacta && (
          <p className={estilos.nota}>Esta sede aún no tiene su ubicación marcada en el mapa.</p>
        )}
      </div>

      <div className={estilos.acciones}>
        {ubicacion ? (
          <>
            <BotonEnlaceExterno
              href={urlComoLlegar(ubicacion)}
              tamano={compacta ? 'sm' : 'md'}
              aria-label={`Cómo llegar a ${lugar}: abre las indicaciones en Google Maps, en otra pestaña`}
            >
              <Navigation aria-hidden="true" size={18} />
              Cómo llegar
            </BotonEnlaceExterno>
            {!compacta && (
              <BotonEnlaceExterno
                href={urlVerEnMapa(ubicacion)}
                variante="secundario"
                aria-label={`Ver ${lugar} en Google Maps, en otra pestaña`}
              >
                Ver en Google Maps
              </BotonEnlaceExterno>
            )}
          </>
        ) : (
          <BotonEnlaceExterno
            href={urlBuscarDireccion(direccion!)}
            variante="secundario"
            tamano={compacta ? 'sm' : 'md'}
            aria-label={`Buscar la dirección de ${lugar} en Google Maps, en otra pestaña`}
          >
            <Search aria-hidden="true" size={18} />
            Buscar en Google Maps
          </BotonEnlaceExterno>
        )}
      </div>
      {ubicacion && !compacta && <p className={estilos.nota}>{AVISO_PRIVACIDAD}</p>}
      {esDemo && (
        <p className={estilos.nota}>
          Ubicación de demostración: el punto del mapa no corresponde a una sede real.
        </p>
      )}
    </section>
  );
}
