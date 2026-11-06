/**
 * Pruebas del número de WhatsApp (`node --test`): mismas reglas que el backend y enlace oficial.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  errorWhatsapp,
  formatearWhatsapp,
  MENSAJES_WHATSAPP,
  normalizarWhatsapp,
  urlWhatsapp,
} from './whatsapp.ts';

describe('Validación del WhatsApp', () => {
  it('vacío es válido: el campo es opcional', () => {
    assert.equal(errorWhatsapp(''), null);
    assert.equal(errorWhatsapp('   '), null);
  });

  it('acepta celulares con indicativo y separadores habituales', () => {
    for (const valido of [
      '+57 300 123 4567',
      '+57-300-123-4567',
      '+57 (300) 123.4567',
      '+573001234567',
      '+1 (555) 010-0000',
      '+34 600 00 00 00',
    ]) {
      assert.equal(errorWhatsapp(valido), null, valido);
    }
  });

  it('exige el indicativo con +', () => {
    for (const sinIndicativo of ['3001234567', '0057 300 123 4567', '57 300 123 4567']) {
      assert.equal(errorWhatsapp(sinIndicativo), MENSAJES_WHATSAPP.indicativo, sinIndicativo);
    }
    assert.equal(errorWhatsapp('+57 300 abc 4567'), MENSAJES_WHATSAPP.indicativo);
  });

  it('rechaza números demasiado cortos, largos o con indicativo 0', () => {
    assert.equal(errorWhatsapp('+1 234 567'), MENSAJES_WHATSAPP.formato);
    assert.equal(errorWhatsapp('+1 2345 6789 0123 4567'), MENSAJES_WHATSAPP.formato);
    assert.equal(errorWhatsapp('+0 300 123 4567'), MENSAJES_WHATSAPP.formato);
    assert.equal(errorWhatsapp(`+57 ${'3'.repeat(40)}`), MENSAJES_WHATSAPP.maximo);
  });

  it('en Colombia solo admite celulares (10 dígitos que empiezan por 3)', () => {
    assert.equal(errorWhatsapp('+57 601 123 4567'), MENSAJES_WHATSAPP.colombia);
    assert.equal(errorWhatsapp('+57 300 123 456'), MENSAJES_WHATSAPP.colombia);
  });
});

describe('Enlace de WhatsApp', () => {
  it('usa el formato oficial wa.me con solo dígitos', () => {
    assert.equal(urlWhatsapp('+573001234567'), 'https://wa.me/573001234567');
    assert.equal(urlWhatsapp('+57 (300) 123-4567'), 'https://wa.me/573001234567');
    assert.equal(urlWhatsapp('+15550100000'), 'https://wa.me/15550100000');
  });

  it('sin número válido no hay enlace', () => {
    assert.equal(urlWhatsapp(''), null);
    assert.equal(urlWhatsapp('3001234567'), null);
    assert.equal(urlWhatsapp('+57 601 123 4567'), null);
  });

  it('el número se lee agrupado en Colombia y tal cual en otros países', () => {
    assert.equal(formatearWhatsapp('+573001234567'), '+57 300 123 4567');
    assert.equal(formatearWhatsapp('+15550100000'), '+15550100000');
    assert.equal(normalizarWhatsapp(' +57 300-123 4567 '), '+573001234567');
  });
});
