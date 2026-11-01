'use client';

import { Palette, PenLine, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/avatar/Avatar';
import { obtenerPerfilPropio, type PerfilPropio } from '@/lib/api/perfil';
import estilos from './TarjetaIdentidad.module.css';

/**
 * Inicio de la comunidad con la identidad de la persona: su avatar, su nametag (alias), sus
 * hobbies (intereses) y su rango de edad. Es lo mismo que ven los demás en la comunidad, nunca la
 * edad exacta ni datos personales. Si el perfil no carga, la tarjeta no se muestra y el resto de
 * la comunidad sigue funcionando.
 */
export function TarjetaIdentidad({
  comunidad,
  rango,
}: {
  /** Nombre de la comunidad («Comunidad B»). */
  comunidad: string;
  /** Rango de edad de la comunidad («13–15 años»). */
  rango: string;
}) {
  const [perfil, setPerfil] = useState<PerfilPropio | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vigente = true;
    obtenerPerfilPropio()
      .then(({ perfil }) => vigente && setPerfil(perfil))
      .catch(() => vigente && setFallo(true));
    return () => {
      vigente = false;
    };
  }, []);

  if (fallo) return null;
  if (!perfil) {
    return (
      <span
        className={`esqueleto ${estilos.esqueleto}`}
        role="status"
        aria-label="Cargando tu perfil…"
      />
    );
  }

  return (
    <section className={estilos.tarjeta} aria-labelledby="titulo-identidad">
      <div className={estilos.retrato}>
        <Avatar apariencia={perfil.avatar} tamano={88} etiqueta={`Avatar de ${perfil.alias}`} />
      </div>

      <div className={estilos.datos}>
        <p className={estilos.saludo} id="titulo-identidad">
          Así te ven en tu comunidad
        </p>

        <p className={estilos.nametag}>
          <span className={estilos.etiquetaNametag}>Nametag</span>
          <strong>{perfil.alias}</strong>
        </p>

        <dl className={estilos.atributos}>
          <div className={estilos.atributo}>
            <dt>
              <Users aria-hidden="true" size={16} />
              Rango de edad
            </dt>
            <dd>
              <span className={estilos.rango}>{rango}</span>
              <span className={estilos.suave}>{comunidad}</span>
            </dd>
          </div>
          <div className={estilos.atributo}>
            <dt>
              <Sparkles aria-hidden="true" size={16} />
              Hobbies
            </dt>
            <dd>
              {perfil.intereses.length > 0 ? (
                <ul className={estilos.hobbies}>
                  {perfil.intereses.map((interes) => (
                    <li key={interes}>{interes}</li>
                  ))}
                </ul>
              ) : (
                <span className={estilos.suave}>
                  Aún no agregas hobbies. <Link href="/perfil">Agrégalos en tu perfil</Link>.
                </span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      <div className={estilos.acciones}>
        <Link href="/perfil/avatar" className={estilos.accion}>
          <Palette aria-hidden="true" size={18} />
          Personalizar avatar
        </Link>
        <Link href="/perfil" className={estilos.accion}>
          <PenLine aria-hidden="true" size={18} />
          Editar nametag y hobbies
        </Link>
      </div>
    </section>
  );
}
