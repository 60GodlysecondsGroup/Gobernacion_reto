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
import type { Database } from '../src/db/database.js';
import {
  crearRepositorioDlp,
  type EventoDlp,
  type RepositorioDlp,
} from '../src/modules/dlp/dlp.repository.js';
import { crearServicioDlp } from '../src/modules/dlp/dlp.service.js';
import type { Sesion } from '../src/modules/seguridad/sesion.service.js';
import {
  AMENAZAS,
  COLOQUIALES,
  DOBLE_SENTIDO,
  DOBLE_SENTIDO_0010,
  EVASIONES,
  EVASIONES_0010,
  GROSERIAS,
  GROSERIAS_0010,
  INGLES,
  INSULTOS,
  INSULTOS_0010,
  LEGITIMOS,
  LEGITIMOS_0010,
  LEGITIMOS_ORGANOS,
  ORGANOS,
  SEXUALES,
  SEXUALES_0010,
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
    ['derivados y abreviaturas de groserías (0010)', GROSERIAS_0010],
    ['insultos dirigidos, aunque traigan palabras de «contexto» (0010)', INSULTOS_0010],
    ['amenazas de violencia física o sexual (0010)', AMENAZAS],
    ['groserías y lenguaje sexual en inglés (0010)', INGLES],
    ['comentarios y propuestas sexuales dirigidos (0010)', SEXUALES_0010],
    ['doble sentido sexual (0010)', DOBLE_SENTIDO_0010],
    ['evasión con emoji, versalitas, «ñ» y palabras partidas (0010)', EVASIONES_0010],
    ['nombres de órganos sexuales externos (0011)', ORGANOS],
  ])('bloquea %s', (_grupo, casos) => {
    it.each(textos(casos))('«%s»', (texto) => {
      expect(analizar(texto, reglas)).toMatchObject({ accion: 'bloquear' });
    });
  });

  describe('no bloquea frases legítimas (falsos positivos)', () => {
    it.each(textos([...LEGITIMOS, ...LEGITIMOS_0010, ...LEGITIMOS_ORGANOS]))('«%s»', (texto) => {
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
    expect(variantesLenguaje('p \u{1f346} u t a')).toContain('puta');
    expect(variantesLenguaje('mi erda')).toContain('mierda');
    expect(variantesLenguaje('hi jo de pu ta')).toContain('hijo de puta');
  });

  it('convierte versalitas y letras en emoji, que NFKC deja iguales', () => {
    expect(normalizar('ᴘᴜᴛᴀ')).toBe('puta');
    expect(normalizar('\u{1f1f5}\u{1f1fa}\u{1f1f9}\u{1f1e6}')).toBe('puta');
    expect(normalizar('\u{1f15f}\u{1f164}\u{1f163}\u{1f150}')).toBe('puta');
    expect(normalizar('\u{1f17f}\u{1f184}\u{1f183}\u{1f170}')).toBe('puta');
    // Los demás emoji no cambian.
    expect(normalizar('hola \u{1f600}')).toBe('hola \u{1f600}');
  });

  it('distingue «coño» de «cono» aunque la normalización quite la tilde de la ñ', () => {
    expect(analizar('¡Coño, qué susto!', reglas)).toMatchObject({ accion: 'bloquear' });
    expect(analizar('c0ño', reglas)).toMatchObject({ accion: 'bloquear' });
    expect(analizar('Me compré un cono de helado', reglas)).toBeNull();
    expect(analizar('Mañana es el cumpleaños de mi papá', reglas)).toBeNull();
  });

  it('las palabras función no se pegan: las excepciones de contexto siguen viéndose', () => {
    // Antes «es una its» se pegaba en «esunaits» y la excepción de salud dejaba de verse.
    expect(variantesLenguaje('la gonorrea es una its')).not.toContain('la gonorrea esunaits');
    expect(analizar('La gonorrea es una ITS', reglas)).toBeNull();
    expect(analizar('Te monto en la moto hasta el colegio', reglas)).toBeNull();
    expect(analizar('Te voy a montar', reglas)).toMatchObject({ accion: 'bloquear' });
  });

  it('una palabra de «contexto» agregada ya no sirve para pasar un insulto dirigido', () => {
    expect(analizar('La gonorrea se previene, consulta tu salud', reglas)).toBeNull();
    expect(analizar('Eres una gonorrea, consulta tu salud', reglas)).toMatchObject({
      categoria: 'lenguaje_ofensivo',
    });
    expect(analizar('Me quedan 10 hp en el juego', reglas)).toBeNull();
    expect(analizar('Eres un hp, juego mejor que tú', reglas)).toMatchObject({
      categoria: 'lenguaje_ofensivo',
    });
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

  it('las migraciones 0008, 0010 y 0011 dejan exactamente las mismas reglas de lenguaje que el seed', async () => {
    const leer = (archivo: string) =>
      readFile(fileURLToPath(new URL(`../db/migraciones/${archivo}`, import.meta.url)), 'utf8');
    const sql0008 = await leer('0008_dlp_lenguaje_ofensivo.sql');
    const sql0010 = await leer('0010_dlp_lenguaje_variantes.sql');
    const sql0011 = await leer('0011_dlp_organos_genitales.sql');
    for (const categoria of CATEGORIAS_LENGUAJE) expect(sql0008).toContain(`('${categoria}',`);

    // Patrón final de cada regla, aplicando en orden los insert y los update de cada migración.
    const LITERAL = String.raw`'((?:[^']|'')*)'`;
    const texto = (literal: string) => literal.replaceAll("''", "'");
    const enMigraciones = new Map<string, { categoria: string; patron: string }>();
    for (const sql of [sql0008, sql0010, sql0011]) {
      const insertados = sql.matchAll(
        new RegExp(
          String.raw`^ {2}\('([a-z-]+)', '([a-z_]+)',\n {3}${LITERAL},\n {3}${LITERAL}\)`,
          'gm',
        ),
      );
      for (const [, codigo, categoria, , patron] of insertados) {
        enMigraciones.set(codigo!, { categoria: categoria!, patron: texto(patron!) });
      }
      const actualizados = sql.matchAll(
        new RegExp(
          String.raw`update app\.regla_dlp\nset patron = ${LITERAL},[\s\S]*?where codigo = '([a-z-]+)'`,
          'g',
        ),
      );
      for (const [, patron, codigo] of actualizados) {
        enMigraciones.get(codigo!)!.patron = texto(patron!);
      }
    }

    const deLenguaje = semilla.filter((r) => esCategoriaLenguaje(r.categoria as CategoriaDlp));
    expect(Object.fromEntries(enMigraciones)).toEqual(
      Object.fromEntries(
        deLenguaje.map(({ codigo, categoria, patron }) => [codigo, { categoria, patron }]),
      ),
    );
  });

  it('0010 solo corrige una regla de 0008 si su patrón no se ha cambiado', async () => {
    const sql = await readFile(
      fileURLToPath(new URL('../db/migraciones/0010_dlp_lenguaje_variantes.sql', import.meta.url)),
      'utf8',
    );
    expect(sql).toMatch(/on conflict \(codigo\) do nothing;/);
    for (const update of sql.match(/update app\.regla_dlp[\s\S]*?;/g) ?? []) {
      expect(update).toMatch(/\n {2}and patron = '/);
      expect(update).not.toMatch(/estado/);
    }
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

describe('Reglas en una base sin migrar: el seed cubre lo que falta', () => {
  type Fila = { id: string; codigo: string; categoria: string; accion: string; patron: string };
  const filaDe = (codigo: string, activa = true): Fila & { activa: boolean } => {
    const regla = semilla.find((r) => r.codigo === codigo)!;
    return { id: `db-${codigo}`, accion: 'bloquear', activa, ...regla };
  };
  const baseCon = (filas: (Fila & { activa: boolean })[]) =>
    ({ query: vi.fn(async () => ({ rows: filas })) }) as unknown as Database;
  const loggerEspia = () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });

  it('sin las reglas de lenguaje en la base (0008 y 0010 sin aplicar) se aplican las del seed', async () => {
    const deDatos = semilla.filter((r) => !esCategoriaLenguaje(r.categoria as CategoriaDlp));
    const espia = loggerEspia();
    const repositorio = crearRepositorioDlp(baseCon(deDatos.map((r) => filaDe(r.codigo))), espia);

    const activas = await repositorio.reglasActivas();
    expect(activas.map((r) => r.codigo).sort()).toEqual(semilla.map((r) => r.codigo).sort());
    const respaldo = activas.filter((r) => esCategoriaLenguaje(r.categoria));
    expect(respaldo.every((r) => r.id === null && r.accion === 'bloquear')).toBe(true);
    expect(activas.find((r) => r.codigo === 'contacto-telefono')?.id).toBe('db-contacto-telefono');
    expect(espia.warn).toHaveBeenCalledOnce();
    expect(espia.warn.mock.calls[0]![1]).toMatchObject({
      reglas: expect.stringContaining('ofensivo-hijueputa'),
    });

    // Avisa una sola vez mientras falten las mismas reglas.
    await repositorio.reglasActivas();
    expect(espia.warn).toHaveBeenCalledOnce();

    const dlp = crearServicioDlp({ repositorio, logger, ttlReglasMs: 0 });
    const contexto = { tipoContenido: 'sala', idUsuario: 'u1' } as const;
    for (const texto of ['Eres un hijueputa', 'Te voy a violar', 'p \u{1f346} u t a']) {
      // registrarEvento va a la base falsa: el evento sin id de regla también se guarda.
      expect(await dlp.revisar(texto, contexto)).toMatchObject({ permitido: false });
    }
    expect((await dlp.revisar('Hoy hay pico y placa', contexto)).permitido).toBe(true);
  });

  it('una regla desactivada en el panel sigue desactivada: el seed no la revive', async () => {
    const filas = semilla.map((r) => filaDe(r.codigo, r.codigo !== 'ofensivo-hijueputa'));
    const espia = loggerEspia();
    const activas = await crearRepositorioDlp(baseCon(filas), espia).reglasActivas();

    expect(activas.map((r) => r.codigo)).not.toContain('ofensivo-hijueputa');
    expect(activas).toHaveLength(semilla.length - 1);
    expect(activas.every((r) => r.id === `db-${r.codigo}`)).toBe(true);
    expect(espia.warn).not.toHaveBeenCalled();
  });

  it('si no se puede guardar el evento, el texto sigue bloqueado (no es un error 500)', async () => {
    const espia = loggerEspia();
    const dlp = crearServicioDlp({
      repositorio: {
        reglasActivas: async () => reglas,
        registrarEvento: async () => {
          throw new Error('violates foreign key constraint "evento_dlp_categoria_fkey"');
        },
      },
      logger: espia,
    });

    const resultado = await dlp.revisar('Te voy a violar', {
      tipoContenido: 'sala',
      idUsuario: 'u1',
    });
    expect(resultado).toMatchObject({ permitido: false, mensaje: MENSAJE_BLOQUEO_LENGUAJE });
    expect(espia.error).toHaveBeenCalledWith('No se pudo registrar el evento DLP', {
      codigo: 'ofensivo-amenazas',
      error: expect.stringContaining('foreign key'),
    });

    const error = await dlp
      .exigirPermitido({ contenido: 'Qué cagada' }, { tipoContenido: 'hilo', idUsuario: 'u1' })
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ estado: 422, codigo: 'CONTENIDO_BLOQUEADO' });
  });
});
