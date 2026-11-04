/**
 * Fase 10 · Filtros de contenido: lenguaje ofensivo, evasión Unicode y falsos positivos.
 * Usa las mismas reglas que carga el seed (db/seed/reglas_dlp.json) y comprueba que la
 * migración 0006 trae exactamente las mismas para las bases existentes.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { leerReglasDlpSemilla } from '../src/db/migraciones.js';
import { ErrorApp } from '../src/http/errores.js';
import { crearLogger, type Logger } from '../src/lib/logger.js';
import {
  analizar,
  compilarPatron,
  MENSAJE_BLOQUEO,
  MENSAJES_POR_CATEGORIA,
  normalizar,
  type CategoriaDlp,
  type ReglaCompilada,
} from '../src/modules/dlp/dlp.analizador.js';
import type { EventoDlp, RepositorioDlp } from '../src/modules/dlp/dlp.repository.js';
import { crearServicioDlp } from '../src/modules/dlp/dlp.service.js';

const MENSAJE_OFENSIVO =
  'Este mensaje contiene lenguaje ofensivo. Reformúlalo de manera respetuosa.';
const CONTEXTO = { tipoContenido: 'hilo', idUsuario: 'usuario-prueba' } as const;
const logger = crearLogger('silencioso');

let reglas: ReglaCompilada[];

beforeAll(async () => {
  reglas = (await leerReglasDlpSemilla()).map((regla) => ({
    id: `id-${regla.codigo}`,
    codigo: regla.codigo,
    categoria: regla.categoria as CategoriaDlp,
    accion: regla.accion ?? 'bloquear',
    patron: compilarPatron(regla.patron),
  }));
});

function repositorioFalso() {
  const eventos: EventoDlp[] = [];
  const repositorio: RepositorioDlp = {
    reglasActivas: vi.fn(async () => reglas),
    registrarEvento: vi.fn(async (evento: EventoDlp) => {
      eventos.push(evento);
    }),
  };
  return { repositorio, eventos };
}

const categoria = (texto: string) => analizar(texto, reglas)?.categoria ?? null;

describe('Lenguaje ofensivo · se bloquea', () => {
  it.each([
    // Insultos dirigidos
    ['insulto directo', 'eres un idiota'],
    ['con modificadores', 'No seas tan imbécil con la gente del grupo'],
    ['plural', 'ustedes son unos tarados'],
    ['voseo', 'vos sos una gonorrea'],
    ['a una persona', 'eres una perra'],
    ['discriminatorio dirigido', 'eres un retrasado'],
    ['marica dirigido', 'eres un marica'],
    ['huevón dirigido', 'eres un huevón'],
    ['basura dirigido', 'sos una basura'],
    ['orden invertido', 'p3rr4 asquerosa eres'],
    // Groserías fuertes, en cualquier posición
    ['hijueputa', 'hijueputa'],
    ['malparido en frase', 'ese man es un malparido'],
    ['hijo de puta', 'hijo de puta'],
    ['abreviatura hpta', 'HPTA'],
    ['jueputa', 'jueputa'],
    ['carechimba', 'carechimba'],
    ['comemierda', 'comemierda'],
    ['maricón', 'maricón'],
    ['mal nacido', 'mal nacido'],
    // Vocativos y expresiones
    ['vocativo', 'cállate idiota'],
    ['vocativo con coma', 'cállate, imbécil'],
    ['insulto + orden', 'gonorrea, cállate'],
    ['oye estúpido', 'oye estúpido'],
    ['maldita', 'maldita perra'],
    ['de mierda', 'idiota de mierda'],
    ['pedazo de', 'pedazo de mierda'],
    ['hp dirigido', 'eres un hp'],
    // Agresiones y amenazas
    ['mandar a la mierda', 'vete a la mierda'],
    ['familia', 'me cago en tu madre'],
    ['amenaza', 'te voy a pegar'],
    ['amenaza de muerte', 'te voy a matar'],
    ['incitación a hacerse daño', 'mátate'],
    ['deseo de muerte', 'muérete'],
    // Mensaje que es solo un insulto
    ['solo el insulto', 'IDIOTA'],
    ['con signos', 'Estúpido!!'],
    ['abreviatura con puntos', 'h.p.'],
  ])('%s: «%s»', (_caso, texto) => {
    expect(analizar(texto, reglas)).toMatchObject({
      categoria: 'lenguaje_ofensivo',
      accion: 'bloquear',
    });
  });
});

describe('Lenguaje ofensivo · mayúsculas, tildes y evasión', () => {
  it.each([
    ['mayúsculas', 'ERES UN IDIOTA'],
    ['tilde', 'eres un estúpido'],
    ['sin tilde', 'eres un estupido'],
    ['letras separadas', 'i d i o t a'],
    ['separadas en frase', 'eres un i.d.i.o.t.a'],
    ['números por letras', '1d10t4'],
    ['números en frase', 'eres una p3rr4'],
    ['letras repetidas', 'idiotaaaa'],
    ['emojis intercalados', 'i💀d💀i💀o💀t💀a'],
    ['espacio de ancho cero', 'id​iota'],
    ['guion virtual', 'mal­parido'],
    ['ancho completo', 'ＩＤＩＯＴＡ'],
    ['letras cirílicas', 'іdіоtа'],
    ['negrita matemática', '𝐢𝐝𝐢𝐨𝐭𝐚'],
    ['mensaje largo con el insulto al final', `${'hola '.repeat(900)}eres un idiota`],
  ])('%s', (_caso, texto) => {
    expect(categoria(texto)).toBe('lenguaje_ofensivo');
  });

  it('un mensaje largo se analiza rápido (sin retroceso catastrófico)', () => {
    for (const texto of [
      'a '.repeat(2500),
      '1-'.repeat(2500),
      'a.'.repeat(2500),
      'x'.repeat(5000),
    ]) {
      const inicio = performance.now();
      analizar(texto, reglas);
      expect(performance.now() - inicio).toBeLessThan(500);
    }
  });
});

describe('Lenguaje ofensivo · no se bloquean usos legítimos o ambiguos', () => {
  it.each([
    'Hoy aprendí a tocar guitarra con mis amigos',
    'Me gusta el análisis de datos y la computación',
    'Fui a Masaya y vi un documental',
    'Mi cumpleaños es el 21/10/2026',
    'Ese partido fue una locura, ¡qué golazo!',
    // Ambiguas: dependen del contexto
    'qué estupidez tan grande',
    'Me sentí como un idiota en el examen',
    'La gonorrea es una infección de transmisión sexual',
    'Te dejo este dato: la gonorrea se previene',
    'Mi perra se llama Luna y es muy juguetona',
    'Estas perras son muy tranquilas',
    'marica, qué susto me dio',
    'qué más huevón, ¿cómo vas?',
    'qué chimba de película',
    'Compré un portátil HP',
    'HP',
    'te voy a pegar el enlace del tema en la sala',
    'te voy a matar de la risa con este chiste',
    'me voy a morir de la risa',
    'muérete de la envidia',
    'el libro habla de la palabra idiota y su origen griego',
    // Palabras que contienen una secuencia «prohibida»
    'la reputación del computador',
    'disputa entre equipos',
    'Hipótesis y computadores',
    'los pueblos indígenas',
    // Letras sueltas legítimas
    'a, e, i, o, u son vocales',
    'opciones a b c',
  ])('permite «%s»', (texto) => {
    expect(analizar(texto, reglas)).toBeNull();
  });
});

describe('Redes externas · falso positivo de «ig» (auditoría D-2)', () => {
  it.each([
    'Sigo el ig de la Gobernación',
    'El instagram de la Gobernación publicó horarios',
    'el tiktok de la alcaldía',
    'Vi el Facebook oficial del ICBF',
  ])('permite la referencia institucional «%s»', (texto) => {
    expect(analizar(texto, reglas)).toBeNull();
  });

  it.each([
    ['mi ig es luna_22', 'redes_externas'],
    ['pásame tu ig', 'redes_externas'],
    ['ig: luna', 'redes_externas'],
    ['sígueme en ig', 'redes_externas'],
    ['escríbeme por ig', 'contacto'],
    ['vi un video en tiktok', 'redes_externas'],
    ['Búscame en Instagram como usuario_prueba.', 'redes_externas'],
  ])('sigue bloqueando «%s»', (texto, esperada) => {
    expect(categoria(texto)).toBe(esperada);
  });
});

describe('Normalización Unicode (también protege las demás categorías)', () => {
  it('convierte ancho completo, quita invisibles y letras parecidas, conserva el resto', () => {
    expect(normalizar('ＭＩ　número')).toBe('mi numero');
    expect(normalizar('what​s⁠app')).toBe('whatsapp');
    expect(normalizar('іnstаgrаm')).toBe('instagram');
    expect(normalizar('  ¿Cuántos   AÑOS tienes? ')).toBe('¿cuantos anos tienes?');
    expect(normalizar('Ñandú 😀')).toBe('nandu 😀');
  });

  it.each([
    ['teléfono en dígitos de ancho completo', 'mi número es ３００１２３４５６７', 'contacto'],
    ['WhatsApp con espacio de ancho cero', 'what​sapp', 'redes_externas'],
    ['Instagram con i cirílica', 'іnstagram', 'redes_externas'],
    ['WhatsApp separado', 'w h a t s a p p', 'redes_externas'],
  ])('bloquea %s', (_caso, texto, esperada) => {
    expect(categoria(texto)).toBe(esperada);
  });

  it('las demás categorías mantienen su comportamiento', () => {
    expect(categoria('mi número es 300 123 4567')).toBe('contacto');
    expect(categoria('tengo 14 años')).toBe('edad');
    expect(categoria('vivo en el barrio La Esperanza')).toBe('ubicacion');
    expect(categoria('vendo zapatos a 50 mil')).toBe('publicidad_comercio');
    expect(categoria('Me llamo Juan Pérez')).toBe('identidad');
  });
});

describe('Servicio DLP · mensajes por categoría y registro', () => {
  it('bloquea el lenguaje ofensivo con su propio mensaje y registra el evento sin el texto', async () => {
    const { repositorio, eventos } = repositorioFalso();
    const resultado = await crearServicioDlp({ repositorio, logger }).revisar(
      'eres un idiota',
      CONTEXTO,
    );

    expect(resultado).toMatchObject({ permitido: false, mensaje: MENSAJE_OFENSIVO });
    expect(MENSAJES_POR_CATEGORIA.lenguaje_ofensivo).toBe(MENSAJE_OFENSIVO);
    expect(eventos).toEqual([
      expect.objectContaining({ categoria: 'lenguaje_ofensivo', resultado: 'bloqueado' }),
    ]);
    expect(JSON.stringify(eventos)).not.toContain('idiota');
  });

  it('las categorías de privacidad conservan el mensaje estándar', async () => {
    const { repositorio } = repositorioFalso();
    const resultado = await crearServicioDlp({ repositorio, logger }).revisar(
      'Escríbeme al 3000000000.',
      CONTEXTO,
    );
    expect(resultado).toMatchObject({ permitido: false, mensaje: MENSAJE_BLOQUEO });
  });

  it('exigirPermitido responde 422 CONTENIDO_BLOQUEADO con el campo, sin el texto ni la regla', async () => {
    const { repositorio } = repositorioFalso();
    const error = await crearServicioDlp({ repositorio, logger })
      .exigirPermitido({ titulo: 'Hola a todos', contenido: 'cállate idiota' }, CONTEXTO)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ErrorApp);
    expect(error).toMatchObject({
      estado: 422,
      codigo: 'CONTENIDO_BLOQUEADO',
      message: MENSAJE_OFENSIVO,
      detalles: { campo: 'contenido' },
    });
    expect(JSON.stringify((error as ErrorApp).detalles)).not.toMatch(/idiota|ofensivo/);
  });

  it('si falla el registro del evento, lo bloqueado sigue bloqueado (422) y el log no lleva el texto', async () => {
    const registro = { error: vi.fn() };
    const repositorio: RepositorioDlp = {
      reglasActivas: async () => reglas,
      registrarEvento: async () => {
        throw new Error('fallo al insertar');
      },
    };
    const dlp = crearServicioDlp({ repositorio, logger: registro as unknown as Logger });

    const error = await dlp
      .exigirPermitido({ contenido: 'eres un idiota' }, CONTEXTO)
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ estado: 422, codigo: 'CONTENIDO_BLOQUEADO' });
    expect(registro.error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(registro.error.mock.calls)).not.toContain('idiota');
  });

  it('falla cerrado: sin reglas disponibles, un insulto tampoco se publica (503)', async () => {
    const repositorio: RepositorioDlp = {
      reglasActivas: async () => {
        throw new Error('sin conexión');
      },
      registrarEvento: async () => {},
    };
    const error = await crearServicioDlp({ repositorio, logger })
      .revisar('eres un idiota', CONTEXTO)
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ estado: 503, codigo: 'DLP_NO_DISPONIBLE' });
  });

  it('si la categoría ofensiva se desactiva en el panel, deja de bloquear (solo aplica reglas activas)', async () => {
    const repositorio: RepositorioDlp = {
      reglasActivas: async () => reglas.filter((r) => r.categoria !== 'lenguaje_ofensivo'),
      registrarEvento: async () => {},
    };
    const resultado = await crearServicioDlp({ repositorio, logger }).revisar(
      'eres un idiota',
      CONTEXTO,
    );
    expect(resultado.permitido).toBe(true);
  });
});

describe('Migración 0006 y semilla', () => {
  it('la migración trae exactamente las mismas reglas que reglas_dlp.json', async () => {
    const sql = await readFile(
      fileURLToPath(
        new URL('../db/migraciones/0006_filtros_lenguaje_ofensivo.sql', import.meta.url),
      ),
      'utf8',
    );
    const semilla = new Map((await leerReglasDlpSemilla()).map((r) => [r.codigo, r]));

    // Inserts: ('codigo', 'categoria', 'descripcion', $re$patron$re$)
    const insertadas = [
      ...sql.matchAll(
        /\(\s*'([^']+)',\s*'([a-z_]+)',\s*'((?:[^']|'')*)',\s*\$re\$([\s\S]*?)\$re\$\)/g,
      ),
    ].map(([, codigo, cat, descripcion, patron]) => ({
      codigo: codigo!,
      categoria: cat!,
      descripcion: descripcion!.replaceAll("''", "'"),
      patron: patron!,
    }));
    // Updates: set patron = $re$nuevo$re$ … where codigo = 'x'
    const actualizadas = [
      ...sql.matchAll(
        /set patron = \$re\$([\s\S]*?)\$re\$,\s*descripcion = '((?:[^']|'')*)',[\s\S]*?where codigo = '([^']+)'/g,
      ),
    ].map(([, patron, descripcion, codigo]) => ({
      codigo: codigo!,
      patron: patron!,
      descripcion: descripcion!.replaceAll("''", "'"),
    }));

    expect(insertadas.filter((r) => r.categoria === 'lenguaje_ofensivo')).toHaveLength(5);
    expect(actualizadas.map((r) => r.codigo).sort()).toEqual([
      'redes-plataformas',
      'redes-variantes',
    ]);
    for (const regla of [...insertadas, ...actualizadas]) {
      expect(semilla.get(regla.codigo)).toMatchObject(regla);
    }
    const ofensivasSemilla = [...semilla.values()].filter(
      (r) => r.categoria === 'lenguaje_ofensivo',
    );
    expect(ofensivasSemilla.map((r) => r.codigo).sort()).toEqual(
      insertadas
        .filter((r) => r.categoria === 'lenguaje_ofensivo')
        .map((r) => r.codigo)
        .sort(),
    );
  });

  it('es idempotente: no duplica ni pisa reglas cambiadas', async () => {
    const sql = await readFile(
      fileURLToPath(
        new URL('../db/migraciones/0006_filtros_lenguaje_ofensivo.sql', import.meta.url),
      ),
      'utf8',
    );
    expect(sql.match(/on conflict \(codigo\) do nothing/g)).toHaveLength(3);
    expect(sql.match(/and patron = \$re\$/g)).toHaveLength(2);
    expect(sql).not.toMatch(/\b(delete|truncate|drop)\b/i);
  });
});
