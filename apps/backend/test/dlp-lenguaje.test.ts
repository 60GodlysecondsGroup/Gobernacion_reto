/**
 * DLP de convivencia: groserías, insultos, lenguaje sexual y doble sentido en foros y salas.
 * Usa las reglas reales del seed (db/seed/reglas_dlp.json) y la batería de
 * test/dlp-lenguaje.casos.ts, que también resume docs/moderacion-dlp-informe.md.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { leerReglasDlpSemilla, type ReglaDlpSemilla } from '../src/db/migraciones.js';
import { ErrorApp } from '../src/http/errores.js';
import { crearLogger } from '../src/lib/logger.js';
import type { ServicioComunidad } from '../src/modules/comunidad/comunidad.service.js';
import type { RepositorioHilos } from '../src/modules/comunidad/hilos.repository.js';
import { crearServicioHilos } from '../src/modules/comunidad/hilos.service.js';
import {
  analizar,
  CATEGORIAS_DLP,
  CATEGORIAS_LENGUAJE,
  compilarPatron,
  esCategoriaLenguaje,
  MENSAJE_BLOQUEO,
  MENSAJE_BLOQUEO_LENGUAJE,
  mensajeBloqueo,
  normalizar,
  variantesLenguaje,
  type CategoriaDlp,
  type ReglaCompilada,
} from '../src/modules/dlp/dlp.analizador.js';
import type { EventoDlp, RepositorioDlp } from '../src/modules/dlp/dlp.repository.js';
import { crearServicioDlp } from '../src/modules/dlp/dlp.service.js';
import type { Sesion } from '../src/modules/seguridad/sesion.service.js';
import {
  COLOQUIALES,
  DOBLE_SENTIDO,
  EVASIONES,
  GROSERIAS,
  INSULTOS,
  LEGITIMOS,
  SEXUALES,
  type CasoLenguaje,
} from './dlp-lenguaje.casos.js';

const logger = crearLogger('silencioso');
let semilla: ReglaDlpSemilla[];
let reglas: ReglaCompilada[];

const compilar = (lista: ReglaDlpSemilla[]): ReglaCompilada[] =>
  lista.map((regla) => ({
    id: `id-${regla.codigo}`,
    codigo: regla.codigo,
    categoria: regla.categoria as CategoriaDlp,
    accion: regla.accion ?? 'bloquear',
    patron: compilarPatron(regla.patron),
  }));

beforeAll(async () => {
  semilla = await leerReglasDlpSemilla();
  reglas = compilar(semilla);
});

function repositorioFalso(reglasActivas: () => ReglaCompilada[]) {
  const eventos: EventoDlp[] = [];
  const repositorio: RepositorioDlp = {
    reglasActivas: vi.fn(async () => reglasActivas()),
    registrarEvento: vi.fn(async (evento: EventoDlp) => {
      eventos.push(evento);
    }),
  };
  return { repositorio, eventos };
}

const textos = (casos: CasoLenguaje[]) => casos.map((c) => c.texto);

describe('Batería de lenguaje ofensivo (test/dlp-lenguaje.casos.ts)', () => {
  describe.each([
    ['groserías explícitas', GROSERIAS],
    ['insultos dirigidos', INSULTOS],
    ['lenguaje sexual vulgar', SEXUALES],
    ['doble sentido sexual', DOBLE_SENTIDO],
    ['evasión (signos, leetspeak, repeticiones, espacios, unicode)', EVASIONES],
    ['expresiones coloquiales colombianas', COLOQUIALES],
  ])('bloquea %s', (_grupo, casos) => {
    it.each(textos(casos))('«%s»', (texto) => {
      expect(analizar(texto, reglas)).toMatchObject({ accion: 'bloquear' });
    });
  });

  describe('no bloquea frases legítimas (falsos positivos)', () => {
    it.each(textos(LEGITIMOS))('«%s»', (texto) => {
      expect(analizar(texto, reglas)).toBeNull();
    });
  });

  it('la batería tiene casos de todos los grupos pedidos', () => {
    expect(GROSERIAS.length + INSULTOS.length + COLOQUIALES.length).toBeGreaterThanOrEqual(40);
    expect(SEXUALES.length + DOBLE_SENTIDO.length).toBeGreaterThanOrEqual(30);
    expect(EVASIONES.length).toBeGreaterThanOrEqual(40);
    expect(LEGITIMOS.length).toBeGreaterThanOrEqual(80);
  });

  it('los insultos y groserías caen en lenguaje_ofensivo y lo sexual en contenido_sexual', () => {
    expect(analizar('Eres un hijueputa', reglas)?.categoria).toBe('lenguaje_ofensivo');
    expect(analizar('Cállate, imbécil', reglas)?.categoria).toBe('lenguaje_ofensivo');
    expect(analizar('Pásame el pack', reglas)?.categoria).toBe('contenido_sexual');
    expect(analizar('Te voy a comer toda', reglas)?.categoria).toBe('contenido_sexual');
  });
});

describe('Contexto: la misma palabra se bloquea o no según cómo se use', () => {
  it.each([
    ['gonorrea', 'Qué gonorrea tan fastidioso', 'La gonorrea es una ITS que se previene'],
    ['idiota', 'Eres un idiota', 'Me siento como un idiota por haber reprobado'],
    ['perra', 'Eres una perra', 'Mi perra tuvo cachorros'],
    ['pico', 'Chupa el pico', 'Hoy hay pico y placa'],
    ['huevos', 'Me rasco los huevos', 'Comí huevos al desayuno'],
    ['leche', '¿Quieres probar mi leche?', 'Me tomé un vaso de leche'],
    ['rica', 'Estás muy rica', 'La sopa está rica'],
    ['coger', 'Te quiero coger', 'Vamos a coger el bus'],
    ['cuatro', 'Ponte en cuatro', 'En cuatro días es el examen'],
    ['hp', 'Ese hp no sabe nada', 'Mi impresora HP no imprime'],
    ['pito', '¿Quieres ver mi pito?', 'El árbitro sonó el pito'],
  ])('«%s»', (_palabra, ofensivo, legitimo) => {
    expect(analizar(ofensivo, reglas)).toMatchObject({ accion: 'bloquear' });
    expect(analizar(legitimo, reglas)).toBeNull();
  });

  it('no silencia a quien pide ayuda: «me quiero morir» no es un insulto', () => {
    expect(analizar('A veces me quiero morir', reglas)).toBeNull();
    expect(analizar('Ojalá te mueras', reglas)).toMatchObject({ categoria: 'lenguaje_ofensivo' });
  });
});

describe('Normalización contra evasión', () => {
  it('quita tildes, mayúsculas, homoglifos, ancho completo y caracteres invisibles', () => {
    expect(normalizar('Púta')).toBe('puta');
    expect(normalizar('\uff50\uff55\uff54\uff41')).toBe('puta'); // ancho completo
    expect(normalizar('\u0440ut\u0430')).toBe('puta'); // p y a cirílicas
    expect(normalizar('pu\u200bta')).toBe('puta'); // espacio de ancho cero
    expect(normalizar('pu\u00adta')).toBe('puta'); // guion suave
    expect(normalizar('  ¿Cuántos   AÑOS tienes? ')).toBe('¿cuantos anos tienes?');
  });

  it('genera variantes sin signos, sin leetspeak, sin repeticiones, con comodines y pegadas', () => {
    expect(variantesLenguaje('hijue.puta')).toContain('hijueputa');
    expect(variantesLenguaje('pu+a')).toContain('puta');
    expect(variantesLenguaje('m13rd4')).toContain('mierda');
    expect(variantesLenguaje('puuuuta')).toContain('puta');
    expect(variantesLenguaje('p*ta')).toContain('puta');
    expect(variantesLenguaje('m*erda')).toContain('mierda');
    expect(variantesLenguaje('hi jue pu ta')).toContain('hijueputa');
    expect(variantesLenguaje('p/u/t/a')).toContain('puta');
  });

  it('la normalización también protege los datos de contacto contra trucos Unicode', () => {
    const digitosAnchos = '3000000000'.replace(/\d/g, (d) =>
      String.fromCharCode(0xff10 + Number(d)),
    );
    expect(analizar(digitosAnchos, reglas)).toMatchObject({ categoria: 'contacto' });
    expect(analizar('tengo what\u200bsapp', reglas)).toMatchObject({
      categoria: 'redes_externas',
    });
    expect(analizar('\u0456nstagram', reglas)).toMatchObject({ categoria: 'redes_externas' });
  });

  it('las variantes de lenguaje no las ven las reglas de contacto (no hay falsos teléfonos)', () => {
    // Sin signos, «21/10/2026 a las 8.30» sería «21102026»; para contacto no se usa esa variante.
    expect(analizar('El examen es el 21/10/2026 a las 8.30', reglas)).toBeNull();
    expect(analizar('Saqué 4.5 en la tarea y 3.8 en el quiz', reglas)).toBeNull();
  });

  it('un texto largo con comodines se revisa en un tiempo acotado', () => {
    const texto = 'h*la a t*d*s c*m* est*n e* c*legio m* f*e b*en '.repeat(110).slice(0, 5000);
    const inicio = performance.now();
    expect(analizar(texto, reglas)).toBeNull();
    expect(performance.now() - inicio).toBeLessThan(2000);
  });
});

describe('Reglas de lenguaje en datos', () => {
  it('existen las dos categorías nuevas y todas sus reglas bloquean', () => {
    expect(CATEGORIAS_DLP).toEqual(expect.arrayContaining([...CATEGORIAS_LENGUAJE]));
    const deLenguaje = semilla.filter((r) => esCategoriaLenguaje(r.categoria as CategoriaDlp));
    expect(deLenguaje.length).toBeGreaterThanOrEqual(10);
    expect(deLenguaje.every((r) => (r.accion ?? 'bloquear') === 'bloquear')).toBe(true);
  });

  it('la migración 0008 trae exactamente las mismas reglas de lenguaje que el seed', async () => {
    const sql = await readFile(
      fileURLToPath(new URL('../db/migraciones/0008_dlp_lenguaje_ofensivo.sql', import.meta.url)),
      'utf8',
    );
    const literal = (texto: string) => `'${texto.replaceAll("'", "''")}'`;
    const deLenguaje = semilla.filter((r) => esCategoriaLenguaje(r.categoria as CategoriaDlp));
    for (const regla of deLenguaje) {
      expect(sql).toContain(`(${literal(regla.codigo)}, ${literal(regla.categoria)},`);
      expect(sql).toContain(literal(regla.patron));
    }
    for (const categoria of CATEGORIAS_LENGUAJE) expect(sql).toContain(`('${categoria}',`);
    // Ninguna regla de la migración falta en el seed.
    const enMigracion = [...sql.matchAll(/^ {2}\('([a-z-]+)', '([a-z_]+)',$/gm)].map((m) => m[1]);
    expect(enMigracion.sort()).toEqual(deLenguaje.map((r) => r.codigo).sort());
  });

  it('desactivar las reglas de lenguaje vuelve a permitir el texto (F31)', () => {
    const sinLenguaje = reglas.filter((r) => !esCategoriaLenguaje(r.categoria));
    expect(analizar('Eres un hijueputa', sinLenguaje)).toBeNull();
    expect(analizar('Eres un hijueputa', reglas)).not.toBeNull();
  });
});

describe('Servicio DLP con lenguaje ofensivo', () => {
  it('usa un mensaje propio para el lenguaje y el de privacidad para los datos', () => {
    expect(mensajeBloqueo('lenguaje_ofensivo')).toBe(MENSAJE_BLOQUEO_LENGUAJE);
    expect(mensajeBloqueo('contenido_sexual')).toBe(MENSAJE_BLOQUEO_LENGUAJE);
    expect(mensajeBloqueo('contacto')).toBe(MENSAJE_BLOQUEO);
    expect(MENSAJE_BLOQUEO_LENGUAJE).not.toMatch(/puta|mierda|grosería detectada/i);
  });

  it.each(['hilo', 'respuesta', 'sala', 'perfil', 'reporte'] as const)(
    'bloquea igual en %s y registra el evento sin el texto',
    async (tipoContenido) => {
      const { repositorio, eventos } = repositorioFalso(() => reglas);
      const dlp = crearServicioDlp({ repositorio, logger });
      const resultado = await dlp.revisar('Eres un h1jueput4', {
        tipoContenido,
        idUsuario: 'usuario-prueba',
      });
      expect(resultado).toMatchObject({ permitido: false, mensaje: MENSAJE_BLOQUEO_LENGUAJE });
      expect(eventos).toEqual([
        {
          idUsuario: 'usuario-prueba',
          tipoContenido,
          categoria: 'lenguaje_ofensivo',
          idRegla: 'id-ofensivo-hijueputa',
          accion: 'bloquear',
          resultado: 'bloqueado',
        },
      ]);
      expect(JSON.stringify(eventos)).not.toMatch(/h1jueput4|eres un/i);
    },
  );

  it('exigirPermitido responde 422 con el campo y el mensaje de convivencia', async () => {
    const { repositorio } = repositorioFalso(() => reglas);
    const error = await crearServicioDlp({ repositorio, logger })
      .exigirPermitido(
        { titulo: 'Ayuda con matemáticas', contenido: 'Mándame fotos desnuda' },
        { tipoContenido: 'hilo', idUsuario: 'usuario-prueba' },
      )
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorApp);
    expect(error).toMatchObject({
      estado: 422,
      codigo: 'CONTENIDO_BLOQUEADO',
      message: MENSAJE_BLOQUEO_LENGUAJE,
      detalles: { campo: 'contenido' },
    });
  });
});

describe('Foros: hilos y respuestas pasan por el DLP en el backend', () => {
  const ID_HILO = '00000000-0000-4000-8000-000000000001';
  const sesion: Sesion = { idUsuario: 'u1', alias: 'Luna', rol: 'usuario', rango: 'B' };
  const comunidades = {
    obtenerPropia: async () => ({ id: 'comunidad-B', nombre: 'B', descripcion: '', rango: 'B' }),
  } as unknown as ServicioComunidad;

  function foro() {
    const repositorio = {
      idCategoriaActiva: vi.fn(async () => 'categoria-1'),
      crear: vi.fn(async () => ID_HILO),
      responder: vi.fn(async () => undefined),
      porId: vi.fn(async () => ({ id: ID_HILO, estado: 'abierto' })),
      respuestas: vi.fn(async () => []),
    };
    const dlp = crearServicioDlp({
      repositorio: repositorioFalso(() => reglas).repositorio,
      logger,
    });
    const servicio = crearServicioHilos({
      repositorio: repositorio as unknown as RepositorioHilos,
      comunidades,
      dlp,
    });
    return { servicio, repositorio };
  }

  it.each([
    ['título', { titulo: 'Qué mierda de foro', contenido: 'Hola a todos' }, 'titulo'],
    ['contenido', { titulo: 'Una pregunta', contenido: 'p.u.t.a vida' }, 'contenido'],
    ['contenido sexual', { titulo: 'Una pregunta', contenido: 'Pásame el pack' }, 'contenido'],
  ])('no guarda un hilo con lenguaje ofensivo en el %s', async (_caso, cuerpo, campo) => {
    const { servicio, repositorio } = foro();
    const error = await servicio
      .crear(sesion, { categoria: 'bienestar-cotidiano', ...cuerpo })
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ estado: 422, detalles: { campo } });
    expect(repositorio.crear).not.toHaveBeenCalled();
  });

  it('no guarda una respuesta con un insulto y sí una legítima', async () => {
    const { servicio, repositorio } = foro();
    const error = await servicio
      .responder(sesion, ID_HILO, {
        contenido: 'Cállate, imbécil',
      })
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ estado: 422, message: MENSAJE_BLOQUEO_LENGUAJE });
    expect(repositorio.responder).not.toHaveBeenCalled();

    await servicio.responder(sesion, ID_HILO, {
      contenido: 'Comí huevos al desayuno y me fue bien en el examen',
    });
    expect(repositorio.responder).toHaveBeenCalledOnce();
  });
});
