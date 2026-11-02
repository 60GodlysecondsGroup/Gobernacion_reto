/**
 * Recorrido del catálogo de avatar en el creador de personaje. Funciones puras (sin React ni
 * DOM): solo se eligen identificadores del catálogo cerrado que entrega el backend.
 */
import type {
  Apariencia,
  Capa,
  ConfiguracionAvatar,
  ElementoAvatar,
  TipoElemento,
} from '@/lib/api/avatar';

/** Las cinco capas que se eligen, en orden. Cabello y accesorio admiten «ninguno». */
export const CATEGORIAS: { capa: Capa; tipo: TipoElemento; titulo: string; ninguno?: string }[] = [
  { capa: 'personaje', tipo: 'personaje', titulo: 'Personaje base' },
  { capa: 'cabello', tipo: 'cabello', titulo: 'Cabello', ninguno: 'Sin cabello' },
  { capa: 'rasgos', tipo: 'rasgo', titulo: 'Rasgos' },
  { capa: 'prenda', tipo: 'prenda', titulo: 'Prenda' },
  { capa: 'accesorio', tipo: 'accesorio', titulo: 'Accesorio', ninguno: 'Ninguno' },
];

/** Traduce identificadores del catálogo a los recursos que se dibujan. */
export function aparienciaDe(
  configuracion: ConfiguracionAvatar,
  catalogo: ElementoAvatar[],
): Apariencia {
  const recurso = (id: string | null) =>
    id === null ? null : (catalogo.find((elemento) => elemento.id === id)?.recurso ?? null);
  return {
    personaje: recurso(configuracion.personaje) ?? '',
    cabello: recurso(configuracion.cabello),
    rasgos: recurso(configuracion.rasgos),
    prenda: recurso(configuracion.prenda),
    accesorio: recurso(configuracion.accesorio),
  };
}

/**
 * El personaje con el que abre «Mi avatar»: el guardado, tal cual. Solo sin avatar guardado se
 * parte del primer elemento de cada capa obligatoria.
 */
export function configuracionAEditar(
  guardada: ConfiguracionAvatar | null,
  catalogo: ElementoAvatar[],
): ConfiguracionAvatar {
  if (guardada) return guardada;
  const primero = (tipo: TipoElemento) => catalogo.find((e) => e.tipo === tipo)?.id ?? null;
  return {
    personaje: primero('personaje') ?? '',
    cabello: primero('cabello'),
    rasgos: primero('rasgo'),
    prenda: primero('prenda'),
    accesorio: null,
  };
}

/** Si dos configuraciones eligen lo mismo en las cinco capas. */
export const mismaConfiguracion = (a: ConfiguracionAvatar, b: ConfiguracionAvatar) =>
  CATEGORIAS.every(({ capa }) => a[capa] === b[capa]);

export type ValorCapa = { id: string | null; nombre: string };

/** Las opciones de una capa en orden; si admite «ninguno», va primero. */
export function valoresDeCapa(
  catalogo: ElementoAvatar[],
  tipo: TipoElemento,
  ninguno?: string,
): ValorCapa[] {
  return [
    ...(ninguno ? [{ id: null, nombre: ninguno }] : []),
    ...catalogo.filter((e) => e.tipo === tipo).map(({ id, nombre }) => ({ id, nombre })),
  ];
}

/** Posición de la opción elegida; 0 si no está en la lista (catálogo cambiado). */
export function indiceDeValor(valores: ValorCapa[], id: string | null): number {
  return Math.max(
    0,
    valores.findIndex((v) => v.id === id),
  );
}

/** La opción anterior (-1) o siguiente (+1), dando la vuelta en los extremos como un carrusel. */
export function valorAdyacente(
  valores: ValorCapa[],
  id: string | null,
  direccion: -1 | 1,
): ValorCapa | null {
  if (valores.length === 0) return null;
  const total = valores.length;
  return valores[(((indiceDeValor(valores, id) + direccion) % total) + total) % total];
}

/**
 * Una combinación al azar del catálogo, para empezar con un personaje ya armado. Cabello y
 * accesorio pueden quedar vacíos, igual que en el editor.
 */
export function avatarAlAzar(
  catalogo: ElementoAvatar[],
  azar: () => number = Math.random,
): ConfiguracionAvatar {
  const alAzar = (tipo: TipoElemento, opcional = false) => {
    const opciones: (string | null)[] = catalogo.filter((e) => e.tipo === tipo).map((e) => e.id);
    if (opcional) opciones.push(null);
    return opciones[Math.floor(azar() * opciones.length)] ?? null;
  };
  return {
    personaje: alAzar('personaje') ?? '',
    cabello: alAzar('cabello', true),
    rasgos: alAzar('rasgo'),
    prenda: alAzar('prenda'),
    accesorio: alAzar('accesorio', true),
  };
}
