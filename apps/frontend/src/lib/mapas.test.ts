/**
 * Pruebas de los enlaces a Google Maps (`node --test`): destino correcto y nunca un origen.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatearCoordenadas,
  leerCoordenadas,
  urlBuscarDireccion,
  urlComoLlegar,
  urlMapaIncrustado,
  urlVerEnMapa,
  type UbicacionFuente,
} from './mapas.ts';

const gobernacion: UbicacionFuente = {
  latitud: 4.151235,
  longitud: -73.639877,
  placeId: 'ChIJ_lugar_000000001',
  direccion: 'Cl. 38 #30-25, Villavicencio, Meta, Colombia',
};
const aMano: UbicacionFuente = { ...gobernacion, placeId: null };

const parametros = (url: string) => Object.fromEntries(new URL(url).searchParams);

describe('«Cómo llegar»', () => {
  it('abre las indicaciones de Google Maps hacia el destino guardado', () => {
    const url = new URL(urlComoLlegar(gobernacion));
    assert.equal(`${url.origin}${url.pathname}`, 'https://www.google.com/maps/dir/');
    assert.deepEqual(parametros(url.href), {
      api: '1',
      destination: '4.151235,-73.639877',
      destination_place_id: 'ChIJ_lugar_000000001',
    });
  });

  it('sin place_id usa solo las coordenadas', () => {
    assert.deepEqual(parametros(urlComoLlegar(aMano)), {
      api: '1',
      destination: '4.151235,-73.639877',
    });
  });

  it('privacidad: ningún enlace lleva un origen ni datos de quien consulta', () => {
    for (const url of [
      urlComoLlegar(gobernacion),
      urlComoLlegar(aMano),
      urlVerEnMapa(gobernacion),
      urlBuscarDireccion('Calle 38 # 30-25'),
    ]) {
      const claves = Object.keys(parametros(url));
      assert.ok(!claves.includes('origin'), url);
      assert.ok(!claves.includes('origin_place_id'), url);
      assert.ok(
        claves.every((clave) => !/user|ubicacion|geo|lat|lng/i.test(clave)),
        url,
      );
    }
  });
});

describe('ver y buscar en Google Maps', () => {
  it('«Ver en Google Maps» muestra el mismo punto que la vista previa', () => {
    assert.deepEqual(parametros(urlVerEnMapa(gobernacion)), {
      api: '1',
      query: '4.151235,-73.639877',
      query_place_id: 'ChIJ_lugar_000000001',
    });
  });

  it('una dirección escrita se busca tal cual, sin inventar coordenadas', () => {
    const url = urlBuscarDireccion('  Calle 38 # 30-25, Villavicencio ');
    assert.ok(url.startsWith('https://www.google.com/maps/search/?'));
    assert.deepEqual(parametros(url), { api: '1', query: 'Calle 38 # 30-25, Villavicencio' });
  });
});

describe('vista previa incrustada (Maps Embed API)', () => {
  it('sin clave no hay iframe (la interfaz muestra la alternativa)', () => {
    assert.equal(urlMapaIncrustado(gobernacion, null), null);
    assert.equal(urlMapaIncrustado(gobernacion, ''), null);
  });

  it('marca exactamente las coordenadas guardadas', () => {
    const url = urlMapaIncrustado(gobernacion, 'clave-publica');
    assert.ok(url?.startsWith('https://www.google.com/maps/embed/v1/place?'));
    assert.deepEqual(parametros(url!), {
      key: 'clave-publica',
      q: '4.151235,-73.639877',
      zoom: '16',
      language: 'es',
      region: 'CO',
    });
  });
});

describe('coordenadas escritas a mano', () => {
  it('lee el par que copia Google Maps, con 6 decimales', () => {
    assert.deepEqual(leerCoordenadas('4.14201234, -73.6266'), {
      latitud: 4.142012,
      longitud: -73.6266,
    });
    assert.deepEqual(leerCoordenadas(' 4.1,-73.6 '), { latitud: 4.1, longitud: -73.6 });
  });

  it('rechaza pares incompletos, fuera de rango o 0, 0', () => {
    for (const texto of ['', '4.14', '4.14,', ',-73.6', '91, 10', '4.1, 181', '0, 0', 'a, b']) {
      assert.equal(leerCoordenadas(texto), null, texto);
    }
  });

  it('formatea un punto guardado para editarlo', () => {
    assert.equal(formatearCoordenadas(gobernacion), '4.151235, -73.639877');
  });
});
