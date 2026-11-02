/**
 * Pruebas del recorrido del catálogo en el creador de personaje (`node --test`, sin
 * dependencias): `npm test -w apps/frontend`.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ConfiguracionAvatar, ElementoAvatar } from '@/lib/api/avatar';
import {
  aparienciaDe,
  avatarAlAzar,
  configuracionAEditar,
  indiceDeValor,
  mismaConfiguracion,
  valorAdyacente,
  valoresDeCapa,
} from './opciones.ts';

const catalogo: ElementoAvatar[] = [
  { id: 'tono-arena', tipo: 'personaje', nombre: 'Tono arena', recurso: 'tono-arena' },
  { id: 'tono-miel', tipo: 'personaje', nombre: 'Tono miel', recurso: 'tono-miel' },
  { id: 'cabello-corto', tipo: 'cabello', nombre: 'Corto', recurso: 'cabello-corto' },
  { id: 'cabello-largo', tipo: 'cabello', nombre: 'Largo', recurso: 'cabello-largo' },
  { id: 'rasgos-sonrisa', tipo: 'rasgo', nombre: 'Sonrisa', recurso: 'rasgos-sonrisa' },
  { id: 'prenda-buzo', tipo: 'prenda', nombre: 'Buzo verde', recurso: 'prenda-buzo' },
  { id: 'accesorio-gorra', tipo: 'accesorio', nombre: 'Gorra', recurso: 'accesorio-gorra' },
];

describe('creador de personaje: opciones de una capa', () => {
  it('lista solo las opciones del tipo, con «ninguno» primero cuando la capa lo admite', () => {
    assert.deepEqual(valoresDeCapa(catalogo, 'cabello', 'Sin cabello'), [
      { id: null, nombre: 'Sin cabello' },
      { id: 'cabello-corto', nombre: 'Corto' },
      { id: 'cabello-largo', nombre: 'Largo' },
    ]);
    assert.deepEqual(
      valoresDeCapa(catalogo, 'personaje').map((v) => v.id),
      ['tono-arena', 'tono-miel'],
    );
  });

  it('las flechas dan la vuelta en los extremos', () => {
    const valores = valoresDeCapa(catalogo, 'cabello', 'Sin cabello');
    assert.equal(valorAdyacente(valores, 'cabello-largo', 1)?.id, null);
    assert.equal(valorAdyacente(valores, null, -1)?.id, 'cabello-largo');
    assert.equal(valorAdyacente(valores, null, 1)?.id, 'cabello-corto');
  });

  it('una elección que ya no está en el catálogo se trata como la primera opción', () => {
    const valores = valoresDeCapa(catalogo, 'personaje');
    assert.equal(indiceDeValor(valores, 'tono-retirado'), 0);
    assert.equal(valorAdyacente(valores, 'tono-retirado', 1)?.id, 'tono-miel');
  });

  it('sin opciones no hay a dónde moverse', () => {
    assert.equal(valorAdyacente([], null, 1), null);
  });
});

describe('creador de personaje: combinación al azar', () => {
  it('solo usa elementos del catálogo, cada uno en su capa', () => {
    for (const azar of [() => 0, () => 0.5, () => 0.999]) {
      const avatar = avatarAlAzar(catalogo, azar);
      const tipoDe = (id: string | null) => catalogo.find((e) => e.id === id)?.tipo;
      assert.equal(tipoDe(avatar.personaje), 'personaje');
      assert.equal(tipoDe(avatar.rasgos), 'rasgo');
      assert.equal(tipoDe(avatar.prenda), 'prenda');
      assert.ok(avatar.cabello === null || tipoDe(avatar.cabello) === 'cabello');
      assert.ok(avatar.accesorio === null || tipoDe(avatar.accesorio) === 'accesorio');
    }
  });

  it('cabello y accesorio pueden quedar vacíos', () => {
    const avatar = avatarAlAzar(catalogo, () => 0.999);
    assert.equal(avatar.cabello, null);
    assert.equal(avatar.accesorio, null);
  });
});

describe('creador de personaje: editar el avatar guardado', () => {
  const guardada: ConfiguracionAvatar = {
    personaje: 'tono-miel',
    cabello: null,
    rasgos: 'rasgos-sonrisa',
    prenda: 'prenda-buzo',
    accesorio: 'accesorio-gorra',
  };

  it('abre con el personaje guardado, sin reemplazar ninguna capa', () => {
    assert.deepEqual(configuracionAEditar(guardada, catalogo), guardada);
  });

  it('sin avatar guardado parte del primer elemento de cada capa obligatoria', () => {
    assert.deepEqual(configuracionAEditar(null, catalogo), {
      personaje: 'tono-arena',
      cabello: 'cabello-corto',
      rasgos: 'rasgos-sonrisa',
      prenda: 'prenda-buzo',
      accesorio: null,
    });
  });

  it('detecta cambios en cualquier capa, también al quitar el cabello o el accesorio', () => {
    assert.ok(mismaConfiguracion(guardada, { ...guardada }));
    assert.ok(!mismaConfiguracion(guardada, { ...guardada, personaje: 'tono-arena' }));
    assert.ok(!mismaConfiguracion(guardada, { ...guardada, accesorio: null }));
    assert.ok(!mismaConfiguracion(guardada, { ...guardada, cabello: 'cabello-largo' }));
  });

  it('traduce la configuración a los recursos que se dibujan', () => {
    assert.deepEqual(aparienciaDe(guardada, catalogo), {
      personaje: 'tono-miel',
      cabello: null,
      rasgos: 'rasgos-sonrisa',
      prenda: 'prenda-buzo',
      accesorio: 'accesorio-gorra',
    });
    assert.equal(aparienciaDe({ ...guardada, prenda: 'retirada' }, catalogo).prenda, null);
  });
});
