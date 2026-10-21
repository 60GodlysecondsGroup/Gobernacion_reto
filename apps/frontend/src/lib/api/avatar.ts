import { api } from './cliente';

export type TipoElemento = 'personaje' | 'cabello' | 'rasgo' | 'prenda' | 'accesorio';

/** Un elemento del catálogo cerrado y gratuito (ELEMENTO_AVATAR). */
export type ElementoAvatar = { id: string; tipo: TipoElemento; nombre: string; recurso: string };

/** Lo que se guarda: un identificador del catálogo por capa (CONFIGURACION_AVATAR). */
export type ConfiguracionAvatar = {
  personaje: string;
  cabello: string | null;
  rasgos: string | null;
  prenda: string | null;
  accesorio: string | null;
};

/**
 * Lo que se dibuja: la clave del recurso gráfico de cada capa. Es lo que llega junto al alias
 * en perfiles, hilos, respuestas y salas.
 */
export type Apariencia = ConfiguracionAvatar;

export type Capa = keyof ConfiguracionAvatar;

export const obtenerMiAvatar = () =>
  api.get<{ configuracion: ConfiguracionAvatar | null; catalogo: ElementoAvatar[] }>('/api/avatar');

export const guardarMiAvatar = (configuracion: ConfiguracionAvatar) =>
  api.put<{ configuracion: ConfiguracionAvatar; apariencia: Apariencia | null }>(
    '/api/avatar',
    configuracion,
  );
