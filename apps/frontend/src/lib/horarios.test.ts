/**
 * Pruebas del horario semanal de las fuentes. Usan el ejecutor de pruebas de Node
 * (`node --test`), sin dependencias: `npm test -w apps/frontend`. Los textos esperados son los
 * mismos que comprueba el backend (`apps/backend/test/fuentes-horario.test.ts`).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  borradorDesde,
  borradorVacio,
  formatearHora,
  formatearHorario,
  horarioDesde,
  validarHorario,
  type BorradorHorario,
  type DiaSemana,
  type Intervalo,
} from './horarios.ts';

const de = (apertura: string, cierre: string): Intervalo => ({ apertura, cierre });
const con = (dias: Partial<Record<DiaSemana, Intervalo[]>>): BorradorHorario => {
  const borrador = borradorVacio();
  for (const [dia, intervalos] of Object.entries(dias)) {
    borrador[dia as DiaSemana] = { activo: true, intervalos };
  }
  return borrador;
};
const oficina = [de('08:00', '17:00')];

describe('horario semanal: validación', () => {
  it('acepta varios intervalos por día y días sin atención', () => {
    const borrador = con({ lunes: [de('08:00', '12:00'), de('14:00', '17:00')], martes: oficina });
    assert.deepEqual(validarHorario(borrador, { exigirCompletos: true }), {});
  });

  it('el cierre debe ser posterior a la apertura', () => {
    assert.deepEqual(validarHorario(con({ martes: [de('17:00', '08:00')] })), {
      'martes.0.cierre': 'El cierre debe ser posterior a la apertura.',
    });
  });

  it('señala intervalos superpuestos o duplicados, no los contiguos', () => {
    assert.deepEqual(validarHorario(con({ lunes: [de('11:00', '15:00'), de('08:00', '12:00')] })), {
      'lunes.0.apertura': 'Se cruza con otro intervalo del día.',
    });
    assert.ok(validarHorario(con({ lunes: [...oficina, ...oficina] }))['lunes.1.apertura']);
    assert.deepEqual(
      validarHorario(con({ lunes: [de('08:00', '12:00'), de('12:00', '17:00')] })),
      {},
    );
  });

  it('los intervalos incompletos solo se señalan al guardar', () => {
    const borrador = con({ lunes: [de('08:00', '')], martes: [] });
    assert.deepEqual(validarHorario(borrador), {});
    assert.deepEqual(validarHorario(borrador, { exigirCompletos: true }), {
      'lunes.0.cierre': 'Indica la hora de cierre.',
      martes: 'Agrega un intervalo o marca el día sin atención.',
    });
  });

  it('ignora los días sin atención aunque recuerden intervalos', () => {
    const borrador = con({ lunes: [de('17:00', '08:00')] });
    borrador.lunes.activo = false;
    assert.deepEqual(validarHorario(borrador, { exigirCompletos: true }), {});
  });

  it('24:00 vale como cierre (medianoche)', () => {
    assert.deepEqual(validarHorario(con({ viernes: [de('22:00', '24:00')] })), {});
  });
});

describe('horario semanal: conversión', () => {
  it('envía solo los días activos, con los intervalos ordenados', () => {
    const borrador = con({ lunes: [de('14:00', '17:00'), de('08:00', '12:00')], martes: oficina });
    borrador.martes.activo = false;
    const horario = horarioDesde(borrador)!;
    assert.deepEqual(horario.lunes, [de('08:00', '12:00'), de('14:00', '17:00')]);
    assert.deepEqual(horario.martes, []);
  });

  it('sin días activos no hay horario, y al revés se recupera lo guardado', () => {
    assert.equal(horarioDesde(borradorVacio()), null);
    const horario = horarioDesde(con({ sabado: [de('08:00', '12:00')] }))!;
    assert.deepEqual(borradorDesde(horario), con({ sabado: [de('08:00', '12:00')] }));
    assert.deepEqual(borradorDesde(null), borradorVacio());
  });
});

describe('horario semanal: texto legible', () => {
  it('formatea horas en 12 h con a. m. / p. m.', () => {
    assert.deepEqual(['00:00', '08:05', '12:00', '13:30', '23:59', '24:00'].map(formatearHora), [
      '12:00 a. m.',
      '8:05 a. m.',
      '12:00 p. m.',
      '1:30 p. m.',
      '11:59 p. m.',
      'medianoche',
    ]);
  });

  it('agrupa los días seguidos con el mismo horario, igual que el backend', () => {
    const borrador = con({
      lunes: [de('08:00', '12:00'), de('14:00', '17:00')],
      martes: oficina,
      jueves: oficina,
      viernes: oficina,
      sabado: [de('08:00', '12:00')],
    });
    assert.equal(
      formatearHorario(horarioDesde(borrador)!),
      'Lunes: 8:00 a. m. – 12:00 p. m. y 2:00 p. m. – 5:00 p. m.; Martes: 8:00 a. m. – 5:00 p. m.; ' +
        'Miércoles: sin atención; Jueves y viernes: 8:00 a. m. – 5:00 p. m.; ' +
        'Sábado: 8:00 a. m. – 12:00 p. m.; Domingo: sin atención',
    );
    const siempre = [de('00:00', '24:00')];
    const todos = con(Object.fromEntries(Object.keys(borradorVacio()).map((d) => [d, siempre])));
    assert.equal(formatearHorario(horarioDesde(todos)!), 'Lunes a domingo: 24 horas');
  });
});
