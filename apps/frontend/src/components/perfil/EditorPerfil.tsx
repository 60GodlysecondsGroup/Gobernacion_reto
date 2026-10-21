'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AvatarProvisional } from '@/components/avatar/AvatarProvisional';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { useSesion } from '@/components/sesion/ProveedorSesion';
import { Aviso, Boton, CampoTexto, Tarjeta } from '@/components/ui';
import { campoDelError, ErrorApi, mensajeDeError } from '@/lib/api/cliente';
import type { OpcionAvatar } from '@/lib/api/comunidad';
import { guardarPerfil, obtenerPerfilPropio } from '@/lib/api/perfil';
import comun from '../comun.module.css';
import estilos from './EditorPerfil.module.css';

type Formulario = { alias: string; intereses: string; avatar: string };
type Resultado = { tono: 'exito' | 'peligro'; mensaje: string; campo?: string } | null;

const aIntereses = (texto: string) =>
  texto
    .split(',')
    .map((interes) => interes.trim())
    .filter(Boolean);

/** Primer mensaje de validación por campo (`intereses.2` → `intereses`). */
function erroresDeValidacion(error: unknown): Record<string, string> {
  const detalles = error instanceof ErrorApi ? error.detalles : undefined;
  if (!Array.isArray(detalles)) return {};
  const porCampo: Record<string, string> = {};
  for (const { campo, mensaje } of detalles as { campo: string; mensaje: string }[]) {
    const raiz = campo.split('.')[0] ?? campo;
    porCampo[raiz] ??= mensaje;
  }
  return porCampo;
}

export function EditorPerfil() {
  const { usuario, puede, refrescar } = useSesion();
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [opciones, setOpciones] = useState<OpcionAvatar[]>([]);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<Resultado>(null);
  const [erroresCampo, setErroresCampo] = useState<Record<string, string>>({});

  useEffect(() => {
    let vigente = true;
    obtenerPerfilPropio()
      .then(({ perfil, opcionesAvatar }) => {
        if (!vigente) return;
        setOpciones(opcionesAvatar);
        setFormulario({
          alias: perfil.alias,
          intereses: perfil.intereses.join(', '),
          avatar: perfil.avatar?.id ?? opcionesAvatar[0]?.id ?? '',
        });
      })
      .catch((e: unknown) => vigente && setErrorCarga(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, []);

  if (errorCarga) return <Aviso tono="peligro">{errorCarga}</Aviso>;
  if (!formulario) return <p className={comun.cargando}>Cargando tu perfil…</p>;

  const cambiar = (campo: keyof Formulario, valor: string) => {
    setFormulario({ ...formulario, [campo]: valor });
    setResultado(null);
    setErroresCampo({});
  };

  async function alGuardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!formulario) return;
    setGuardando(true);
    setResultado(null);
    setErroresCampo({});
    try {
      const { perfil } = await guardarPerfil({
        alias: formulario.alias,
        intereses: aIntereses(formulario.intereses),
        avatar: formulario.avatar,
      });
      setFormulario({ ...formulario, alias: perfil.alias, intereses: perfil.intereses.join(', ') });
      setResultado({ tono: 'exito', mensaje: 'Perfil guardado.' });
      await refrescar();
    } catch (e) {
      const campo = campoDelError(e);
      // El mensaje del DLP es el estándar del backend y nunca repite el dato detectado.
      setResultado({ tono: 'peligro', mensaje: mensajeDeError(e), campo });
      setErroresCampo(campo ? { [campo]: 'Revisa este campo.' } : erroresDeValidacion(e));
    } finally {
      setGuardando(false);
    }
  }

  const puedeCambiarAvatar = puede('personalizar_avatar_propio');
  const avatarElegido = opciones.find((opcion) => opcion.id === formulario.avatar);

  return (
    <div className={comun.pagina}>
      <EncabezadoPagina antetitulo="Identidad protegida" titulo="Mi perfil">
        Participas con un alias y un avatar. Tu edad no se muestra ni se guarda: la plataforma solo
        usa tu rango para ubicarte en tu comunidad
        {usuario?.comunidad ? ` (${usuario.comunidad.nombre})` : ''}.
      </EncabezadoPagina>

      <div className={estilos.distribucion}>
        <Tarjeta titulo="Vista previa">
          <div className={estilos.vistaPrevia}>
            <AvatarProvisional recurso={avatarElegido?.recurso} tamano={72} />
            <strong>{formulario.alias || 'Tu alias'}</strong>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Editar perfil">
          <form className={comun.formulario} onSubmit={alGuardar} noValidate>
            {resultado && <Aviso tono={resultado.tono}>{resultado.mensaje}</Aviso>}

            <CampoTexto
              etiqueta="Alias"
              ayuda="Entre 3 y 30 caracteres, sin espacios. No uses tu nombre real."
              value={formulario.alias}
              onChange={(e) => cambiar('alias', e.target.value)}
              error={erroresCampo.alias}
              autoComplete="off"
              maxLength={30}
            />

            <CampoTexto
              etiqueta="Intereses generales (opcional)"
              ayuda="Separados por comas, hasta 10. Por ejemplo: lectura, música."
              value={formulario.intereses}
              onChange={(e) => cambiar('intereses', e.target.value)}
              error={erroresCampo.intereses}
              autoComplete="off"
            />

            <fieldset className={estilos.avatares} disabled={!puedeCambiarAvatar}>
              <legend className={estilos.leyenda}>Personaje (provisional)</legend>
              {!puedeCambiarAvatar && (
                <p className={comun.suave}>Tu rol no personaliza el avatar.</p>
              )}
              <div className={estilos.opciones}>
                {opciones.map((opcion) => (
                  <label key={opcion.id} className={estilos.opcion}>
                    <input
                      type="radio"
                      name="avatar"
                      value={opcion.id}
                      checked={formulario.avatar === opcion.id}
                      onChange={() => cambiar('avatar', opcion.id)}
                    />
                    <AvatarProvisional recurso={opcion.recurso} tamano={36} />
                    <span className={comun.suave}>
                      {opcion.nombre.replace(' (provisional)', '')}
                    </span>
                  </label>
                ))}
              </div>
              {erroresCampo.avatar && <p className={estilos.error}>{erroresCampo.avatar}</p>}
            </fieldset>

            <div className={comun.fila}>
              <Boton type="submit" cargando={guardando}>
                Guardar perfil
              </Boton>
            </div>
          </form>
        </Tarjeta>
      </div>
    </div>
  );
}
