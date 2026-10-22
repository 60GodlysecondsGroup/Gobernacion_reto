'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Avatar } from '@/components/avatar/Avatar';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { useSesion } from '@/components/sesion/ProveedorSesion';
import {
  Aviso,
  Boton,
  BotonEnlace,
  CampoTexto,
  CargandoLista,
  Insignia,
  Tarjeta,
  useNotificar,
} from '@/components/ui';
import { campoDelError, erroresPorCampo, mensajeDeError } from '@/lib/api/cliente';
import type { Apariencia } from '@/lib/api/avatar';
import { guardarPerfil, obtenerPerfilPropio } from '@/lib/api/perfil';
import comun from '../comun.module.css';
import estilos from './EditorPerfil.module.css';

type Formulario = { alias: string; intereses: string };
type Resultado = { tono: 'exito' | 'peligro'; mensaje: string; campo?: string } | null;

const aIntereses = (texto: string) =>
  texto
    .split(',')
    .map((interes) => interes.trim())
    .filter(Boolean);

export function EditorPerfil() {
  const { usuario, puede, refrescar } = useSesion();
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [apariencia, setApariencia] = useState<Apariencia | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<Resultado>(null);
  const notificar = useNotificar();
  const [erroresCampo, setErroresCampo] = useState<Record<string, string>>({});

  useEffect(() => {
    let vigente = true;
    obtenerPerfilPropio()
      .then(({ perfil }) => {
        if (!vigente) return;
        setApariencia(perfil.avatar);
        setFormulario({ alias: perfil.alias, intereses: perfil.intereses.join(', ') });
      })
      .catch((e: unknown) => vigente && setErrorCarga(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, []);

  if (errorCarga) return <Aviso tono="peligro">{errorCarga}</Aviso>;
  if (!formulario) return <CargandoLista etiqueta="Cargando tu perfil…" />;

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
      });
      setFormulario({ ...formulario, alias: perfil.alias, intereses: perfil.intereses.join(', ') });
      setResultado(null);
      notificar('exito', 'Perfil guardado', 'Tus cambios ya se ven en tu comunidad.');
      await refrescar();
    } catch (e) {
      const campo = campoDelError(e);
      // El mensaje del DLP es el estándar del backend y nunca repite el dato detectado.
      setResultado({ tono: 'peligro', mensaje: mensajeDeError(e), campo });
      setErroresCampo(campo ? { [campo]: 'Revisa este campo.' } : erroresPorCampo(e));
    } finally {
      setGuardando(false);
    }
  }

  const puedeCambiarAvatar = puede('personalizar_avatar_propio');

  return (
    <div className={comun.pagina}>
      <EncabezadoPagina antetitulo="Identidad protegida" titulo="Mi perfil">
        Participas con un alias y un avatar. Tu edad no se muestra ni se guarda: la plataforma solo
        usa tu rango para ubicarte en tu comunidad
        {usuario?.comunidad ? ` (${usuario.comunidad.nombre})` : ''}.
      </EncabezadoPagina>

      <div className={estilos.distribucion}>
        <Tarjeta titulo="Tu avatar">
          <div className={estilos.vistaPrevia}>
            <div className={estilos.escenarioAvatar}>
              <Avatar apariencia={apariencia} tamano={96} etiqueta="Tu avatar" />
            </div>
            <strong className={estilos.alias}>{formulario.alias || 'Tu alias'}</strong>
            {usuario?.comunidad && <Insignia tono="info">{usuario.comunidad.nombre}</Insignia>}
            <BotonEnlace
              href="/perfil/avatar"
              variante="secundario"
              tamano="sm"
              className={estilos.botonAvatar}
            >
              {puedeCambiarAvatar ? 'Personalizar mi avatar' : 'Ver mi avatar'}
            </BotonEnlace>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Editar perfil">
          <form className={comun.formulario} onSubmit={alGuardar} noValidate>
            {resultado && <Aviso tono={resultado.tono}>{resultado.mensaje}</Aviso>}

            <CampoTexto
              etiqueta="Alias"
              obligatorio
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
