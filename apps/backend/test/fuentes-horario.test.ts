import { describe, expect, it } from 'vitest';
import { esquemaEdicion, type FuenteCompleta } from '../src/modules/fuentes/fuentes.esquemas.js';
import {
  esquemaHorarioSemanal,
  formatearHora,
  formatearHorario,
  type HorarioSemanal,
} from '../src/modules/fuentes/fuentes.horario.js';
import { calcularCambios } from '../src/modules/fuentes/fuentes.reglas.js';

const sinAtencion: HorarioSemanal = {
  lunes: [],
  martes: [],
  miercoles: [],
  jueves: [],
  viernes: [],
  sabado: [],
  domingo: [],
};
const de = (apertura: string, cierre: string) => ({ apertura, cierre });
const oficina = [de('08:00', '17:00')];

/** Ejemplo del requerimiento: jornada partida, días distintos y un día sin atención. */
const ejemplo: HorarioSemanal = {
  ...sinAtencion,
  lunes: [de('14:00', '17:00'), de('08:00', '12:00')],
  martes: oficina,
  jueves: oficina,
  viernes: oficina,
  sabado: [de('08:00', '12:00')],
};

const valida = {
  institucion: 'InstituciónDemo',
  servicio: 'Línea de prueba',
  descripcion: 'Canal ficticio para pruebas automatizadas.',
  tipoCanal: 'telefono',
  telefono: '000 000 0000',
  enlace: '',
  horario: 'Texto anterior escrito a mano',
  fuenteOriginal: 'Registro de prueba',
  necesidades: ['lineas_ayuda'],
  observaciones: '',
  esDemo: true,
};

const errores = (horario: unknown) =>
  esquemaHorarioSemanal.safeParse(horario).error?.issues.map((issue) => ({
    ruta: issue.path.join('.'),
    mensaje: issue.message,
  }));
const rutaDelError = (horario: unknown) => errores(horario)?.[0]?.ruta;

describe('Horario semanal estructurado', () => {
  it('acepta varios intervalos por día, días sin atención y los guarda ordenados', () => {
    const horario = esquemaHorarioSemanal.parse(ejemplo);
    expect(horario?.lunes).toEqual([de('08:00', '12:00'), de('14:00', '17:00')]);
    expect(horario?.miercoles).toEqual([]);
  });

  it('la hora de cierre debe ser posterior a la de apertura', () => {
    expect(errores({ ...sinAtencion, martes: [de('17:00', '08:00')] })).toEqual([
      {
        ruta: 'martes.0.cierre',
        mensaje: 'La hora de cierre debe ser posterior a la de apertura.',
      },
    ]);
    expect(rutaDelError({ ...sinAtencion, martes: [de('08:00', '08:00')] })).toBe(
      'martes.0.cierre',
    );
  });

  it('rechaza intervalos superpuestos o duplicados, pero no los contiguos', () => {
    expect(
      errores({ ...sinAtencion, lunes: [de('08:00', '12:00'), de('11:00', '15:00')] }),
    ).toEqual([
      { ruta: 'lunes.1.apertura', mensaje: 'Este intervalo se cruza con otro del mismo día.' },
    ]);
    expect(rutaDelError({ ...sinAtencion, lunes: [...oficina, ...oficina] })).toBe(
      'lunes.1.apertura',
    );
    expect(errores({ ...sinAtencion, lunes: [de('08:00', '12:00'), de('12:00', '17:00')] })).toBe(
      undefined,
    );
  });

  it('rechaza intervalos incompletos, horas inválidas y días desconocidos o faltantes', () => {
    expect(rutaDelError({ ...sinAtencion, lunes: [{ apertura: '08:00' }] })).toBe('lunes.0.cierre');
    expect(rutaDelError({ ...sinAtencion, lunes: [de('', '12:00')] })).toBe('lunes.0.apertura');
    expect(errores({ ...sinAtencion, lunes: [de('8:00', '25:00')] })).toHaveLength(2);
    expect(errores({ ...sinAtencion, feriado: [] })).toBeDefined();
    const { domingo: _domingo, ...sinDomingo } = sinAtencion;
    expect(rutaDelError(sinDomingo)).toBe('domingo');
  });

  it('24:00 solo vale como cierre: «00:00–24:00» son 24 horas', () => {
    expect(errores({ ...sinAtencion, lunes: [de('00:00', '24:00')] })).toBe(undefined);
    expect(rutaDelError({ ...sinAtencion, lunes: [de('24:00', '24:00')] })).toBe(
      'lunes.0.apertura',
    );
  });

  it('limita los intervalos por día', () => {
    const cinco = ['06', '08', '10', '12', '14'].map((h) => de(`${h}:00`, `${h}:30`));
    expect(rutaDelError({ ...sinAtencion, lunes: cinco })).toBe('lunes');
  });

  it('un horario sin ningún día con atención es «sin horario»', () => {
    expect(esquemaHorarioSemanal.parse(sinAtencion)).toBe(null);
  });
});

describe('Texto legible del horario', () => {
  it('formatea horas en 12 h con a. m. / p. m.', () => {
    expect(['00:00', '08:05', '12:00', '13:30', '23:59', '24:00'].map(formatearHora)).toEqual([
      '12:00 a. m.',
      '8:05 a. m.',
      '12:00 p. m.',
      '1:30 p. m.',
      '11:59 p. m.',
      'medianoche',
    ]);
  });

  it('agrupa los días seguidos con el mismo horario', () => {
    expect(formatearHorario(esquemaHorarioSemanal.parse(ejemplo)!)).toBe(
      'Lunes: 8:00 a. m. – 12:00 p. m. y 2:00 p. m. – 5:00 p. m.; Martes: 8:00 a. m. – 5:00 p. m.; ' +
        'Miércoles: sin atención; Jueves y viernes: 8:00 a. m. – 5:00 p. m.; ' +
        'Sábado: 8:00 a. m. – 12:00 p. m.; Domingo: sin atención',
    );
    const semana = { ...sinAtencion, lunes: oficina, martes: oficina, miercoles: oficina };
    expect(formatearHorario({ ...semana, jueves: oficina, viernes: oficina })).toBe(
      'Lunes a viernes: 8:00 a. m. – 5:00 p. m.; Sábado y domingo: sin atención',
    );
  });

  it('nombra los horarios de 24 horas y los que cierran a medianoche', () => {
    const siempre = [de('00:00', '24:00')];
    const todos = Object.fromEntries(Object.keys(sinAtencion).map((dia) => [dia, siempre]));
    expect(formatearHorario(todos as HorarioSemanal)).toBe('Lunes a domingo: 24 horas');
    expect(formatearHorario({ ...sinAtencion, viernes: [de('22:00', '24:00')] })).toContain(
      'Viernes: 10:00 p. m. – medianoche',
    );
  });
});

describe('Fuente con horario semanal', () => {
  it('sin horario semanal, el texto se guarda como antes (compatibilidad)', () => {
    const datos = esquemaEdicion.parse(valida);
    expect(datos).toMatchObject({ horario: 'Texto anterior escrito a mano', horarioSemanal: null });
  });

  it('con horario semanal, el texto se deriva de él y reemplaza al anterior', () => {
    const datos = esquemaEdicion.parse({ ...valida, horarioSemanal: ejemplo });
    expect(datos.horarioSemanal?.lunes[0]).toEqual(de('08:00', '12:00'));
    expect(datos.horario).toBe(formatearHorario(datos.horarioSemanal!));
  });

  it('el texto libre sigue limitado a 200 caracteres; el derivado no', () => {
    const largo = 'x'.repeat(201);
    expect(esquemaEdicion.safeParse({ ...valida, horario: largo }).error?.issues[0]?.path).toEqual([
      'horario',
    ]);
    const derivado = esquemaEdicion.parse({ ...valida, horarioSemanal: ejemplo }).horario!;
    expect(derivado.length).toBeGreaterThan(200);
    // Reenviar lo que devolvió la API (texto derivado + estructura) es válido.
    expect(
      esquemaEdicion.safeParse({ ...valida, horario: derivado, horarioSemanal: ejemplo }).success,
    ).toBe(true);
  });

  it('informa el error en la ruta del intervalo', () => {
    const resultado = esquemaEdicion.safeParse({
      ...valida,
      horarioSemanal: { ...sinAtencion, martes: [de('17:00', '08:00')] },
    });
    expect(resultado.error?.issues.map((issue) => issue.path.join('.'))).toEqual([
      'horarioSemanal.martes.0.cierre',
    ]);
  });

  it('la bitácora no ve cambios si solo cambia el orden de las claves (jsonb)', () => {
    const base = {
      ...esquemaEdicion.parse({ ...valida, horarioSemanal: ejemplo }),
      estado: 'activo',
      fechaVerificacion: '2026-10-20',
    } as FuenteCompleta;
    // Así lo devuelve PostgreSQL: claves más cortas primero («fin» antes que «inicio»).
    const comoJsonb = JSON.parse(
      JSON.stringify(base.horarioSemanal, [
        'lunes',
        'jueves',
        'martes',
        'sabado',
        'domingo',
        'viernes',
        'miercoles',
        'cierre',
        'apertura',
      ]),
    );
    expect(calcularCambios(base, { ...base, horarioSemanal: comoJsonb })).toEqual({});

    const otro = { ...base.horarioSemanal!, domingo: [de('09:00', '12:00')] };
    expect(Object.keys(calcularCambios(base, { ...base, horarioSemanal: otro }))).toEqual([
      'horarioSemanal',
    ]);
  });
});
