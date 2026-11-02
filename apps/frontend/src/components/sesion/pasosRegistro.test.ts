/**
 * Pruebas del registro por etapas (`node --test`, sin dependencias): `npm test -w apps/frontend`.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hobbyEscrito,
  pasoDelCampo,
  primerPasoConError,
  validarCuenta,
  validarPaso,
  validarRegistro,
} from './pasosRegistro.ts';

const validos = { alias: 'luna_23', contrasena: 'una frase larga', rango: 'B' as const };

describe('registro: validación por etapa', () => {
  it('con datos válidos ninguna etapa tiene errores', () => {
    for (const paso of [0, 1, 2] as const) assert.deepEqual(validarPaso(paso, validos), {});
    assert.deepEqual(validarRegistro(validos), {});
  });

  it('la etapa de cuenta revisa el nametag', () => {
    assert.ok(validarCuenta({ ...validos, alias: '  ab ' }).alias);
    assert.ok(validarCuenta({ ...validos, alias: 'a'.repeat(31) }).alias);
    assert.ok(validarCuenta({ ...validos, alias: 'luna 23' }).alias);
    assert.equal(validarCuenta({ ...validos, alias: 'Ñandú.07' }).alias, undefined);
  });

  it('la etapa de cuenta revisa la contraseña', () => {
    assert.ok(validarCuenta({ ...validos, contrasena: 'corta' }).contrasena);
    assert.ok(validarCuenta({ ...validos, contrasena: 'x'.repeat(129) }).contrasena);
    assert.equal(
      validarCuenta({ ...validos, contrasena: 'soy LUNA_23 siempre' }).contrasena,
      'Tu contraseña no puede contener tu nametag.',
    );
  });

  it('la etapa «sobre ti» solo exige el rango de edad', () => {
    assert.deepEqual(validarPaso(1, { ...validos, rango: null }), {
      rango: 'Elige tu rango de edad.',
    });
    // Los errores de la cuenta no bloquean avanzar desde «sobre ti».
    assert.deepEqual(validarPaso(1, { ...validos, alias: '' }), {});
  });

  it('el registro completo junta los errores de todas las etapas', () => {
    const errores = validarRegistro({ alias: '', contrasena: '', rango: null });
    assert.deepEqual(Object.keys(errores).sort(), ['alias', 'contrasena', 'rango']);
  });
});

describe('registro: a qué etapa volver ante un error', () => {
  it('ubica cada campo en su etapa, también los que señala el backend', () => {
    assert.equal(pasoDelCampo('alias'), 0);
    assert.equal(pasoDelCampo('contrasena'), 0);
    assert.equal(pasoDelCampo('rango'), 1);
    assert.equal(pasoDelCampo('intereses'), 1);
    assert.equal(pasoDelCampo('avatar'), 2);
    assert.equal(pasoDelCampo('otro'), null);
  });

  it('elige la primera etapa con errores', () => {
    assert.equal(primerPasoConError({}), null);
    assert.equal(primerPasoConError({ rango: 'x', avatar: 'y' }), 1);
    assert.equal(primerPasoConError({ intereses: 'x', contrasena: 'y' }), 0);
    assert.equal(primerPasoConError({ alias: undefined, avatar: 'y' }), 2);
  });
});

describe('registro: hobby escrito a mano', () => {
  it('normaliza espacios y respeta el largo de 2 a 30 caracteres', () => {
    assert.equal(hobbyEscrito('  tejer   a  mano '), 'tejer a mano');
    assert.equal(hobbyEscrito(' a '), null);
    assert.equal(hobbyEscrito('x'.repeat(31)), null);
  });
});
