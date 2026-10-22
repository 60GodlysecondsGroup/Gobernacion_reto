'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso, Boton, CampoSeleccion, CampoTexto, EnlaceVolver, Tarjeta } from '@/components/ui';
import { campoDelError, ErrorApi, erroresPorCampo, mensajeDeError } from '@/lib/api/cliente';
import { crearHilo, obtenerCategorias, type CategoriaForo } from '@/lib/api/hilos';
import { useBorrador } from '@/lib/hooks/useBorrador';
import comun from '../comun.module.css';

type Formulario = { categoria: string; titulo: string; contenido: string };

/** Crear hilo (F07). El texto pasa por el DLP antes de guardarse; si se bloquea, se puede editar. */
export function NuevoHilo() {
  const router = useRouter();
  const [categorias, setCategorias] = useState<CategoriaForo[]>([]);
  const [datos, setDatos, descartarBorrador] = useBorrador<Formulario>('nuevo-hilo', {
    categoria: '',
    titulo: '',
    contenido: '',
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [bloqueo, setBloqueo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);

  useEffect(() => {
    let vigente = true;
    obtenerCategorias()
      .then((r) => vigente && setCategorias(r.categorias))
      .catch((e: unknown) => vigente && setError(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, []);

  const cambiar = (campo: keyof Formulario, valor: string) => {
    setDatos((actual) => ({ ...actual, [campo]: valor }));
    setErrores((actual) => ({ ...actual, [campo]: '' }));
    setBloqueo(null);
  };

  async function alPublicar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setPublicando(true);
    setErrores({});
    setBloqueo(null);
    setError(null);
    try {
      const { hilo } = await crearHilo(datos);
      descartarBorrador();
      router.push(`/comunidad/hilos/${hilo.id}?publicado=1`);
    } catch (e) {
      if (e instanceof ErrorApi && e.codigo === 'CONTENIDO_BLOQUEADO') {
        const campo = campoDelError(e);
        setBloqueo(e.message);
        if (campo) setErrores({ [campo]: 'Revisa este campo.' });
      } else {
        setErrores(erroresPorCampo(e));
        setError(mensajeDeError(e));
      }
      setPublicando(false);
    }
  }

  return (
    <div className={comun.pagina}>
      <nav aria-label="Ruta">
        <EnlaceVolver href="/comunidad">Volver a la comunidad</EnlaceVolver>
      </nav>
      <EncabezadoPagina antetitulo="Tu comunidad" titulo="Crear hilo">
        Solo lo verán personas de tu comunidad. Participas con tu alias.
      </EncabezadoPagina>

      <Tarjeta>
        <form className={comun.formulario} onSubmit={alPublicar} noValidate>
          {bloqueo && (
            <Aviso tono="peligro" titulo="Hilo bloqueado">
              {bloqueo} Puedes editarlo y volver a intentarlo.
            </Aviso>
          )}
          {error && <Aviso tono="peligro">{error}</Aviso>}

          <CampoSeleccion
            etiqueta="Categoría"
            opciones={[
              { valor: '', etiqueta: 'Elige una categoría' },
              ...categorias.map((c) => ({ valor: c.codigo, etiqueta: c.nombre })),
            ]}
            obligatorio
            value={datos.categoria}
            onChange={(e) => cambiar('categoria', e.target.value)}
            error={errores.categoria || undefined}
          />
          <CampoTexto
            etiqueta="Título"
            obligatorio
            ayuda="Una frase que resuma de qué quieres hablar."
            maxLength={120}
            value={datos.titulo}
            onChange={(e) => cambiar('titulo', e.target.value)}
            error={errores.titulo || undefined}
          />
          <CampoTexto
            etiqueta="Contenido"
            obligatorio
            ayuda="No compartas datos personales, de contacto, ubicaciones ni redes sociales. El texto se revisa antes de publicarse."
            multilinea
            rows={6}
            maxLength={5000}
            value={datos.contenido}
            onChange={(e) => cambiar('contenido', e.target.value)}
            error={errores.contenido || undefined}
          />
          <div className={comun.fila}>
            <Boton type="submit" cargando={publicando}>
              {publicando ? 'Publicando…' : 'Publicar hilo'}
            </Boton>
            <Link href="/reglas">Ver las reglas</Link>
          </div>
          <p className={comun.suave}>
            Si sales de esta página, tu borrador se conserva mientras no cierres la pestaña.
          </p>
        </form>
      </Tarjeta>
    </div>
  );
}
