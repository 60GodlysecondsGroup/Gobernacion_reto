/**
 * Número de WhatsApp de las fuentes (opcional): validación, normalización a E.164 y bitácora.
 */
import { describe, expect, it } from 'vitest';
import {
  esquemaCreacion,
  esquemaEdicion,
  esquemaEntradaCarga,
  hoyEnColombia,
  MENSAJES_WHATSAPP,
  normalizarWhatsapp,
  type FuenteCompleta,
} from '../src/modules/fuentes/fuentes.esquemas.js';
import { calcularCambios } from '../src/modules/fuentes/fuentes.reglas.js';

const base = {
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

const errores = (whatsapp: unknown) => {
  const resultado = esquemaEdicion.safeParse({ ...base, whatsapp });
  return resultado.success ? [] : resultado.error.issues.map((i) => [i.path.join('.'), i.message]);
};

describe('Validación del número de WhatsApp', () => {
  it('es opcional: ausente, vacío o null queda en null', () => {
    expect(esquemaEdicion.parse(base).whatsapp).toBeNull();
    expect(esquemaEdicion.parse({ ...base, whatsapp: '' }).whatsapp).toBeNull();
    expect(esquemaEdicion.parse({ ...base, whatsapp: '   ' }).whatsapp).toBeNull();
    expect(esquemaEdicion.parse({ ...base, whatsapp: null }).whatsapp).toBeNull();
  });

  it('acepta el indicativo con espacios, guiones, puntos o paréntesis y lo guarda en E.164', () => {
    for (const escrito of [
      '+57 300 123 4567',
      '+57-300-123-4567',
      '+57 (300) 123.4567',
      ' +573001234567 ',
    ]) {
      expect(esquemaEdicion.parse({ ...base, whatsapp: escrito }).whatsapp).toBe('+573001234567');
    }
    // Otros países: solo se exige el formato internacional.
    expect(esquemaEdicion.parse({ ...base, whatsapp: '+1 (555) 010-0000' }).whatsapp).toBe(
      '+15550100000',
    );
    expect(esquemaEdicion.parse({ ...base, whatsapp: '+34 600 00 00 00' }).whatsapp).toBe(
      '+34600000000',
    );
  });

  it('exige el indicativo internacional con +', () => {
    for (const sinIndicativo of ['3001234567', '0057 300 123 4567', '57 300 123 4567']) {
      expect(errores(sinIndicativo)).toEqual([['whatsapp', MENSAJES_WHATSAPP.indicativo]]);
    }
  });

  it('rechaza letras, símbolos y números demasiado cortos o largos', () => {
    expect(errores('+57 300 abc 4567')).toEqual([['whatsapp', MENSAJES_WHATSAPP.indicativo]]);
    expect(errores('+57 300 123 4567 ext 2')).toEqual([['whatsapp', MENSAJES_WHATSAPP.indicativo]]);
    expect(errores('+1 234 567')).toEqual([['whatsapp', MENSAJES_WHATSAPP.formato]]);
    expect(errores('+1 2345 6789 0123 4567')).toEqual([['whatsapp', MENSAJES_WHATSAPP.formato]]);
    expect(errores('+0 300 123 4567')).toEqual([['whatsapp', MENSAJES_WHATSAPP.formato]]);
    expect(errores(`+57 ${'3'.repeat(40)}`)[0]?.[0]).toBe('whatsapp');
    expect(errores(5730012345)[0]?.[0]).toBe('whatsapp');
  });

  it('en Colombia (+57) solo admite celulares: 10 dígitos que empiezan por 3', () => {
    expect(errores('+57 601 123 4567')).toEqual([['whatsapp', MENSAJES_WHATSAPP.colombia]]);
    expect(errores('+57 300 123 456')).toEqual([['whatsapp', MENSAJES_WHATSAPP.colombia]]);
    expect(errores('+57 300 123 45678')).toEqual([['whatsapp', MENSAJES_WHATSAPP.colombia]]);
  });

  it('se valida igual al crear y en el archivo de carga', () => {
    const creacion = {
      ...base,
      estado: 'activo',
      fechaVerificacion: hoyEnColombia(),
      whatsapp: '+57 300 000 0000',
    };
    expect(esquemaCreacion.parse(creacion).whatsapp).toBe('+573000000000');
    expect(esquemaCreacion.safeParse({ ...creacion, whatsapp: '300' }).success).toBe(false);
    expect(esquemaEntradaCarga.parse({ ...creacion, codigo: 'demo-whatsapp' }).whatsapp).toBe(
      '+573000000000',
    );
    // Las entradas del archivo que no lo traen siguen siendo válidas.
    expect(
      esquemaEntradaCarga.parse({
        ...base,
        estado: 'activo',
        fechaVerificacion: hoyEnColombia(),
        codigo: 'demo-sin',
      }).whatsapp,
    ).toBeNull();
  });

  it('no cambia el teléfono ni el resto del canal', () => {
    const datos = esquemaEdicion.parse({ ...base, whatsapp: '+57 300 000 0000' });
    expect(datos).toMatchObject({ tipoCanal: 'telefono', telefono: '000 000 0000', enlace: null });
  });

  it('normalizarWhatsapp solo quita separadores', () => {
    expect(normalizarWhatsapp('+57 (300) 123-45.67')).toBe('+573001234567');
  });
});

describe('Bitácora del WhatsApp', () => {
  const completa = (whatsapp: string | null): FuenteCompleta => ({
    ...esquemaEdicion.parse({ ...base, whatsapp }),
    estado: 'activo',
    fechaVerificacion: '2026-01-01',
  });

  it('registra agregar, cambiar y quitar el número', () => {
    expect(calcularCambios(completa(null), completa('+573000000000'))).toEqual({
      whatsapp: { antes: null, despues: '+573000000000' },
    });
    expect(calcularCambios(completa('+573000000000'), completa('+573000000001'))).toEqual({
      whatsapp: { antes: '+573000000000', despues: '+573000000001' },
    });
    expect(calcularCambios(completa('+573000000000'), completa(null))).toEqual({
      whatsapp: { antes: '+573000000000', despues: null },
    });
  });

  it('escribir el mismo número con otro formato no es un cambio', () => {
    expect(calcularCambios(completa('+57 300 000 0000'), completa('+573000000000'))).toEqual({});
  });
});
