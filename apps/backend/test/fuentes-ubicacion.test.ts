/**
 * Dirección y ubicación geográfica de las fuentes (atención presencial o híbrida): validación,
 * bitácora y búsqueda de lugares con Google Places API (New) usando un `fetch` falso (las
 * pruebas nunca llaman a Google).
 */
import { describe, expect, it, vi } from 'vitest';
import { ErrorApp } from '../src/http/errores.js';
import {
  esquemaEdicion,
  esquemaUbicacion,
  type FuenteCompleta,
} from '../src/modules/fuentes/fuentes.esquemas.js';
import { crearClienteLugares } from '../src/modules/fuentes/fuentes.lugares.js';
import { calcularCambios } from '../src/modules/fuentes/fuentes.reglas.js';

const virtual = {
  institucion: 'InstituciónDemo',
  servicio: 'Línea de prueba',
  descripcion: 'Canal ficticio para pruebas automatizadas.',
  tipoCanal: 'telefono',
  telefono: '000 000 0000',
  enlace: '',
  horario: '',
  fuenteOriginal: 'Registro de prueba',
  necesidades: ['lineas_ayuda'],
  observaciones: '',
  esDemo: true,
};
const presencial = { ...virtual, tipoCanal: 'presencial', telefono: '' };
const ubicacion = {
  latitud: 4.1420123456,
  longitud: -73.6266,
  placeId: 'ChIJ_prueba_0123456789',
  direccion: 'Calle 38 # 30-25, Villavicencio, Meta',
};

const errorEn = (resultado: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  resultado.error?.issues.map((issue) => issue.path.join('.'));

describe('Validación de la dirección y la ubicación', () => {
  it('es opcional: una fuente virtual o presencial sin ubicación es válida', () => {
    expect(esquemaEdicion.parse(virtual)).toMatchObject({ direccion: null, ubicacion: null });
    expect(esquemaEdicion.parse(presencial)).toMatchObject({ direccion: null, ubicacion: null });
  });

  it('guarda la ubicación con 6 decimales y la dirección escrita aparte', () => {
    const datos = esquemaEdicion.parse({
      ...presencial,
      direccion: '  Calle 38 # 30-25, piso 2  ',
      ubicacion,
    });
    expect(datos.direccion).toBe('Calle 38 # 30-25, piso 2');
    expect(datos.ubicacion).toEqual({ ...ubicacion, latitud: 4.142012 });
  });

  it('una fuente híbrida (teléfono) conserva su canal y además tiene ubicación', () => {
    const datos = esquemaEdicion.parse({ ...virtual, ubicacion });
    expect(datos).toMatchObject({ tipoCanal: 'telefono', telefono: '000 000 0000' });
    expect(datos.ubicacion?.latitud).toBe(4.142012);
  });

  it('una ubicación ingresada a mano no necesita place_id', () => {
    const datos = esquemaEdicion.parse({ ...presencial, ubicacion: { ...ubicacion, placeId: '' } });
    expect(datos.ubicacion?.placeId).toBeNull();
  });

  it('latitud y longitud van en pareja y con su dirección', () => {
    const { longitud: _longitud, ...sinLongitud } = ubicacion;
    const { direccion: _direccion, ...sinDireccion } = ubicacion;
    expect(errorEn(esquemaEdicion.safeParse({ ...presencial, ubicacion: sinLongitud }))).toEqual([
      'ubicacion.longitud',
    ]);
    expect(errorEn(esquemaEdicion.safeParse({ ...presencial, ubicacion: sinDireccion }))).toEqual([
      'ubicacion.direccion',
    ]);
    // Coordenadas sueltas, fuera del objeto, no se aceptan.
    expect(esquemaEdicion.safeParse({ ...presencial, latitud: 4.1 }).success).toBe(false);
  });

  it.each([
    [{ latitud: 91 }, 'ubicacion.latitud'],
    [{ latitud: -90.5 }, 'ubicacion.latitud'],
    [{ longitud: 181 }, 'ubicacion.longitud'],
    [{ latitud: '4.14' }, 'ubicacion.latitud'],
    [{ latitud: Number.NaN }, 'ubicacion.latitud'],
    [{ latitud: 0, longitud: 0 }, 'ubicacion.latitud'],
    [{ placeId: 'no válido!' }, 'ubicacion.placeId'],
    [{ direccion: 'x' }, 'ubicacion.direccion'],
  ])('rechaza la ubicación con %o', (cambio, campo) => {
    expect(
      errorEn(esquemaEdicion.safeParse({ ...presencial, ubicacion: { ...ubicacion, ...cambio } })),
    ).toEqual([campo]);
  });

  it('rechaza direcciones escritas demasiado cortas o largas', () => {
    expect(errorEn(esquemaEdicion.safeParse({ ...presencial, direccion: 'abc' }))).toEqual([
      'direccion',
    ]);
    expect(
      errorEn(esquemaEdicion.safeParse({ ...presencial, direccion: 'x'.repeat(201) })),
    ).toEqual(['direccion']);
  });

  it('la bitácora registra el cambio y la eliminación de la ubicación', () => {
    const base = {
      ...esquemaEdicion.parse(presencial),
      estado: 'activo',
      fechaVerificacion: '2026-10-20',
    } as FuenteCompleta;
    const conUbicacion = { ...base, ubicacion: esquemaUbicacion.parse(ubicacion) };
    expect(Object.keys(calcularCambios(base, conUbicacion))).toEqual(['ubicacion']);
    // El mismo punto con las claves en otro orden (como lo devuelve la base) no es un cambio.
    const { direccion, placeId, longitud, latitud } = conUbicacion.ubicacion;
    const reordenado = { ...base, ubicacion: { direccion, placeId, longitud, latitud } };
    expect(calcularCambios(conUbicacion, reordenado)).toEqual({});
    expect(calcularCambios(conUbicacion, base).ubicacion).toEqual({
      antes: conUbicacion.ubicacion,
      despues: null,
    });
  });
});

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const codigoDe = async (promesa: Promise<unknown>) => {
  try {
    await promesa;
    return null;
  } catch (error) {
    return error instanceof ErrorApp ? `${error.estado} ${error.codigo}` : String(error);
  }
};

describe('Búsqueda de lugares (Google Places API (New))', () => {
  it('sin clave no está disponible y no llama a Google', async () => {
    const fetch = vi.fn();
    const cliente = crearClienteLugares({ fetch });
    expect(cliente.disponible).toBe(false);
    expect(await codigoDe(cliente.sugerencias('Gobernación', null))).toBe(
      '503 LUGARES_NO_CONFIGURADO',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('pide sugerencias en Colombia, con sesión y máscara de campos, sin datos de quien busca', async () => {
    const fetch = vi.fn(async () =>
      json({
        suggestions: [
          {
            placePrediction: {
              placeId: 'ChIJ_lugar_000000001',
              text: { text: 'Gobernación del Meta, Villavicencio' },
              structuredFormat: {
                mainText: { text: 'Gobernación del Meta' },
                secondaryText: { text: 'Villavicencio, Meta' },
              },
            },
          },
          { queryPrediction: { text: { text: 'gobernación' } } },
        ],
      }),
    );
    const cliente = crearClienteLugares({ claveApi: 'clave-falsa', fetch });
    const sugerencias = await cliente.sugerencias('Gobernación', 'sesion-0001');

    expect(sugerencias).toEqual([
      {
        placeId: 'ChIJ_lugar_000000001',
        principal: 'Gobernación del Meta',
        secundario: 'Villavicencio, Meta',
      },
    ]);
    const [url, opciones] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://places.googleapis.com/v1/places:autocomplete');
    const cabeceras = opciones.headers as Record<string, string>;
    expect(cabeceras['X-Goog-Api-Key']).toBe('clave-falsa');
    expect(cabeceras['X-Goog-FieldMask']).toMatch(/^suggestions\.placePrediction\./);
    const cuerpo = JSON.parse(String(opciones.body));
    expect(cuerpo).toMatchObject({
      input: 'Gobernación',
      includedRegionCodes: ['co'],
      sessionToken: 'sesion-0001',
    });
    // Sesgo fijo hacia Villavicencio: nunca la ubicación de la persona que busca.
    expect(cuerpo.locationBias.circle.center).toEqual({ latitude: 4.142, longitude: -73.6266 });
    expect(cuerpo).not.toHaveProperty('origin');
  });

  it('el detalle trae solo punto, dirección y nombre, con 6 decimales', async () => {
    const fetch = vi.fn(async () =>
      json({
        id: 'ChIJ_lugar_000000001',
        displayName: { text: 'Gobernación del Meta' },
        formattedAddress: 'Cl. 38 #30-25, Villavicencio, Meta, Colombia',
        location: { latitude: 4.15123456789, longitude: -73.63987654321 },
      }),
    );
    const cliente = crearClienteLugares({ claveApi: 'clave-falsa', fetch });
    expect(await cliente.lugar('ChIJ_lugar_000000001', 'sesion-0001')).toEqual({
      placeId: 'ChIJ_lugar_000000001',
      nombre: 'Gobernación del Meta',
      latitud: 4.151235,
      longitud: -73.639877,
      direccion: 'Cl. 38 #30-25, Villavicencio, Meta, Colombia',
    });
    const [url, opciones] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/places/ChIJ_lugar_000000001?');
    expect(url).toContain('sessionToken=sesion-0001');
    expect((opciones.headers as Record<string, string>)['X-Goog-FieldMask']).toBe(
      'id,displayName,formattedAddress,location',
    );
  });

  it('no inventa un punto si Google no devuelve ubicación o dirección', async () => {
    const fetch = vi.fn(async () => json({ id: 'ChIJ_lugar_000000001', formattedAddress: 'Meta' }));
    const cliente = crearClienteLugares({ claveApi: 'clave-falsa', fetch });
    expect(await codigoDe(cliente.lugar('ChIJ_lugar_000000001', null))).toBe(
      '422 LUGAR_SIN_UBICACION',
    );
  });

  it('los errores de Google o de red se traducen sin exponer la clave', async () => {
    const rechazado = crearClienteLugares({
      claveApi: 'clave-falsa',
      fetch: vi.fn(async () => json({ error: { message: 'API key not valid' } }, 403)),
    });
    expect(await codigoDe(rechazado.sugerencias('abc', null))).toBe('502 LUGARES_NO_DISPONIBLE');

    const sinRed = crearClienteLugares({
      claveApi: 'clave-falsa',
      fetch: vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    });
    expect(await codigoDe(sinRed.lugar('ChIJ_lugar_000000001', null))).toBe(
      '502 LUGARES_NO_DISPONIBLE',
    );

    const inexistente = crearClienteLugares({
      claveApi: 'clave-falsa',
      fetch: vi.fn(async () => json({}, 404)),
    });
    expect(await codigoDe(inexistente.lugar('ChIJ_lugar_000000001', null))).toBe(
      '404 NO_ENCONTRADO',
    );
  });
});
