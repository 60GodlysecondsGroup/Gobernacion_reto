import { describe, expect, it } from 'vitest';
import { leerFuentes } from '../src/modules/fuentes/fuentes.carga.js';
import {
  CODIGOS_NECESIDAD,
  esquemaCreacion,
  esquemaEdicion,
  esquemaVerificacion,
  hoyEnColombia,
  type FuenteCompleta,
} from '../src/modules/fuentes/fuentes.esquemas.js';
import {
  accionesPermitidas,
  accionParaCambio,
  calcularCambios,
  generarCodigo,
} from '../src/modules/fuentes/fuentes.reglas.js';

const valida = {
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

const errorEn = (resultado: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  resultado.error?.issues.map((issue) => issue.path.join('.'));

describe('Validación de fuentes', () => {
  it('acepta una fuente válida y guarda los opcionales vacíos como null', () => {
    const datos = esquemaEdicion.parse(valida);
    expect(datos).toMatchObject({ enlace: null, horario: null, observaciones: null });
  });

  it('un canal telefónico necesita teléfono, y uno web o de chat necesita enlace', () => {
    expect(errorEn(esquemaEdicion.safeParse({ ...valida, telefono: '' }))).toEqual(['telefono']);
    expect(errorEn(esquemaEdicion.safeParse({ ...valida, tipoCanal: 'web' }))).toEqual(['enlace']);
    expect(errorEn(esquemaEdicion.safeParse({ ...valida, tipoCanal: 'chat' }))).toEqual(['enlace']);
  });

  it.each(['javascript:alert(1)', 'ftp://ejemplo.test', 'no es un enlace'])(
    'rechaza el enlace «%s»',
    (enlace) => {
      expect(errorEn(esquemaEdicion.safeParse({ ...valida, enlace }))).toEqual(['enlace']);
    },
  );

  it('rechaza campos desconocidos, necesidades inexistentes y listas vacías', () => {
    expect(esquemaEdicion.safeParse({ ...valida, estado: 'activo' }).success).toBe(false);
    expect(esquemaEdicion.safeParse({ ...valida, necesidades: ['diagnostico'] }).success).toBe(
      false,
    );
    expect(esquemaEdicion.safeParse({ ...valida, necesidades: [] }).success).toBe(false);
  });

  it('ninguna fuente se crea sin fecha de verificación, ni con fecha futura', () => {
    expect(esquemaCreacion.safeParse({ ...valida, estado: 'activo' }).success).toBe(false);
    expect(
      esquemaCreacion.safeParse({ ...valida, estado: 'activo', fechaVerificacion: '2999-01-01' })
        .success,
    ).toBe(false);
    expect(
      esquemaCreacion.safeParse({ ...valida, estado: 'activo', fechaVerificacion: hoyEnColombia() })
        .success,
    ).toBe(true);
  });

  it('la verificación usa la fecha de hoy en Colombia si no se indica otra', () => {
    expect(esquemaVerificacion.parse({})).toEqual({ fecha: hoyEnColombia(), observacion: null });
    expect(hoyEnColombia(new Date('2026-10-21T03:00:00Z'))).toBe('2026-10-20');
  });
});

describe('Ciclo de vida y bitácora', () => {
  it('permite solo las transiciones de la sección 21', () => {
    expect(accionesPermitidas('activo')).toEqual(['marcar_revision', 'verificar', 'desactivar']);
    expect(accionesPermitidas('requiere_revision')).toEqual(['verificar', 'desactivar']);
    expect(accionesPermitidas('inactivo')).toEqual(['marcar_revision', 'verificar']);
  });

  const base = {
    ...esquemaEdicion.parse(valida),
    estado: 'activo',
    fechaVerificacion: '2026-10-20',
  } as FuenteCompleta;

  it('registra solo los campos que cambian, con su valor anterior y nuevo', () => {
    const despues = { ...base, telefono: '000 000 0009', necesidades: [...base.necesidades] };
    expect(calcularCambios(base, despues)).toEqual({
      telefono: { antes: '000 000 0000', despues: '000 000 0009' },
    });
  });

  it('el orden de las necesidades no cuenta como cambio', () => {
    const a = { ...base, necesidades: ['bienestar', 'lineas_ayuda'] } as FuenteCompleta;
    const b = { ...base, necesidades: ['lineas_ayuda', 'bienestar'] } as FuenteCompleta;
    expect(calcularCambios(a, b)).toEqual({});
  });

  it('elige la acción de bitácora según el cambio', () => {
    expect(accionParaCambio(base, { ...base, estado: 'inactivo' })).toBe('desactivar');
    expect(accionParaCambio(base, { ...base, estado: 'requiere_revision' })).toBe(
      'marcar_revision',
    );
    expect(accionParaCambio(base, { ...base, fechaVerificacion: '2026-10-21' })).toBe('verificar');
    expect(accionParaCambio(base, base)).toBe('actualizar');
  });

  it('genera códigos legibles y válidos', () => {
    expect(generarCodigo('Línea Ñandú de Orientación', 'a1b2c3')).toBe(
      'linea-nandu-de-orientacion-a1b2c3',
    );
  });
});

describe('Archivo de carga fuentes_institucionales.json', () => {
  it('es válido y solo contiene datos de demostración, sin canales reales', async () => {
    const fuentes = await leerFuentes();

    expect(fuentes.length).toBeGreaterThanOrEqual(1);
    for (const fuente of fuentes) {
      expect(fuente.esDemo).toBe(true);
      if (fuente.enlace) expect(new URL(fuente.enlace).hostname).toMatch(/\.example\.test$/);
      if (fuente.telefono) expect(fuente.telefono.replace(/\D/g, '')).toMatch(/^0+1?$/);
    }
  });

  it('incluye InstituciónDemo · CanalDemo (B.7) y un ejemplo de cada estado', async () => {
    const fuentes = await leerFuentes();
    expect(fuentes).toContainEqual(
      expect.objectContaining({ institucion: 'InstituciónDemo', servicio: 'CanalDemo' }),
    );
    expect(new Set(fuentes.map((f) => f.estado))).toEqual(
      new Set(['activo', 'requiere_revision', 'inactivo']),
    );
  });

  it('cada necesidad del navegador tiene al menos un servicio activo', async () => {
    const activas = (await leerFuentes()).filter((f) => f.estado === 'activo');
    for (const necesidad of CODIGOS_NECESIDAD) {
      expect(
        activas.some((f) => f.necesidades.includes(necesidad)),
        necesidad,
      ).toBe(true);
    }
  });
});
