/**
 * Pruebas de la validación de fuentes en el navegador (`node --test`): mismas reglas que el
 * backend (`apps/backend/test/fuentes.test.ts`).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MENSAJES_FUENTE, validarFuente, type DatosValidables } from './fuentes-validacion.ts';

const valida: DatosValidables = {
  institucion: 'InstituciónDemo',
  servicio: 'Línea de prueba',
  descripcion: 'Canal ficticio para pruebas automatizadas.',
  tipoCanal: 'telefono',
  telefono: '000 000 0000',
  enlace: '',
  fuenteOriginal: 'Registro de prueba',
  necesidades: ['lineas_ayuda'],
  observaciones: '',
};

describe('validación de fuentes', () => {
  it('acepta una fuente válida', () => {
    assert.deepEqual(validarFuente(valida), {});
  });

  it('pide los textos obligatorios con su largo mínimo, sin contar espacios', () => {
    const errores = validarFuente({
      ...valida,
      institucion: ' x ',
      servicio: '',
      descripcion: 'corta',
      fuenteOriginal: 'ab',
      necesidades: [],
    });
    assert.deepEqual(errores, {
      institucion: MENSAJES_FUENTE.institucion,
      servicio: MENSAJES_FUENTE.servicio,
      descripcion: MENSAJES_FUENTE.descripcion,
      fuenteOriginal: MENSAJES_FUENTE.fuenteOriginal,
      necesidades: MENSAJES_FUENTE.necesidades,
    });
  });

  it('un canal telefónico necesita teléfono, y uno web o de chat necesita enlace', () => {
    assert.deepEqual(validarFuente({ ...valida, telefono: '' }), {
      telefono: MENSAJES_FUENTE.telefonoObligatorio,
    });
    for (const tipoCanal of ['web', 'chat']) {
      assert.deepEqual(validarFuente({ ...valida, tipoCanal }), {
        enlace: MENSAJES_FUENTE.enlaceObligatorio,
      });
    }
    assert.deepEqual(validarFuente({ ...valida, tipoCanal: 'presencial', telefono: '' }), {});
  });

  it('valida el formato del teléfono y del enlace aunque sean opcionales', () => {
    assert.equal(validarFuente({ ...valida, telefono: '12a' }).telefono, MENSAJES_FUENTE.telefono);
    for (const enlace of ['javascript:alert(1)', 'ftp://ejemplo.test', 'no es un enlace']) {
      assert.equal(validarFuente({ ...valida, enlace }).enlace, MENSAJES_FUENTE.enlace, enlace);
    }
    assert.deepEqual(validarFuente({ ...valida, enlace: 'https://ejemplo.example.test' }), {});
  });

  it('respeta los máximos', () => {
    assert.equal(
      validarFuente({ ...valida, observaciones: 'x'.repeat(501) }).observaciones,
      MENSAJES_FUENTE.maximo(500),
    );
    assert.equal(
      validarFuente({ ...valida, institucion: 'x'.repeat(121) }).institucion,
      MENSAJES_FUENTE.maximo(120),
    );
  });

  it('al crear, la fecha de verificación es obligatoria y no puede ser futura', () => {
    const hoy = '2026-11-03';
    assert.equal(
      validarFuente({ ...valida, fechaVerificacion: '' }, hoy).fechaVerificacion,
      MENSAJES_FUENTE.fechaVerificacion,
    );
    assert.equal(
      validarFuente({ ...valida, fechaVerificacion: '2026-11-04' }, hoy).fechaVerificacion,
      MENSAJES_FUENTE.fechaFutura,
    );
    assert.deepEqual(validarFuente({ ...valida, fechaVerificacion: hoy }, hoy), {});
  });
});
