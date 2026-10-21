import { beforeAll, describe, expect, it, vi } from 'vitest';
import { leerReglasDlpSemilla } from '../src/db/migraciones.js';
import { ErrorApp } from '../src/http/errores.js';
import { crearLogger } from '../src/lib/logger.js';
import {
  analizar,
  compilarPatron,
  MENSAJE_BLOQUEO,
  normalizar,
  type CategoriaDlp,
  type ReglaCompilada,
} from '../src/modules/dlp/dlp.analizador.js';
import type { EventoDlp, RepositorioDlp } from '../src/modules/dlp/dlp.repository.js';
import { crearServicioDlp } from '../src/modules/dlp/dlp.service.js';

let reglas: ReglaCompilada[];

beforeAll(async () => {
  // Las mismas reglas que el seed carga en app.regla_dlp.
  reglas = (await leerReglasDlpSemilla()).map((regla) => ({
    id: `id-${regla.codigo}`,
    codigo: regla.codigo,
    categoria: regla.categoria as CategoriaDlp,
    accion: regla.accion ?? 'bloquear',
    patron: compilarPatron(regla.patron),
  }));
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

const logger = crearLogger('silencioso');
const CONTEXTO = { tipoContenido: 'perfil', idUsuario: 'usuario-prueba' } as const;

describe('Reglas DLP predeterminadas', () => {
  it.each([
    ['TRL-04 · contacto', 'Escríbeme al 3000000000.', 'contacto'],
    ['TRL-05 · redes sociales', 'Búscame en Instagram como usuario_prueba.', 'redes_externas'],
    ['TRL-06 · ubicación', 'Nos vemos en la dirección de prueba 123.', 'ubicacion'],
    ['correo', 'Mi correo es prueba@example.test', 'contacto'],
    ['enlace', 'Mira esto: https://sitio-ejemplo.test/perfil', 'contacto'],
    ['edad propia', 'Tengo 14 años.', 'edad'],
    ['pedir la edad', '¿Cuántos años tienes exactamente?', 'edad'],
    ['venta', 'Vendo audífonos baratos, en buen estado', 'publicidad_comercio'],
    ['teléfono con espacios', 'Mi número: 300 000 0000', 'contacto'],
    ['usuario externo (B.7)', 'Agrégame, soy @usuario_prueba', 'contacto'],
    ['dirección (B.7)', 'Vivo en la Calle Ficticia 123', 'ubicacion'],
    ['sígueme en', 'Sígueme en TikTok', 'redes_externas'],
    ['mi usuario es', 'Mi usuario es luna_2026', 'redes_externas'],
    ['nombre completo', 'Me llamo Juan Pérez', 'identidad'],
    ['colegio', 'Estudio en el colegio San Ejemplo', 'identidad'],
    ['barrio', 'Mi barrio es La Esperanza', 'ubicacion'],
    ['pedir el número', 'Pásame tu número', 'contacto'],
    ['pedir dinero', 'Mándame plata por Nequi', 'publicidad_comercio'],
  ])('bloquea %s', (_caso, texto, categoria) => {
    expect(analizar(texto, reglas)).toMatchObject({ categoria, accion: 'bloquear' });
  });

  it.each([
    'Hoy me fue bien en el colegio y quiero contarlo.',
    'Me gusta leer y escuchar música.',
    'Tengo 2 hermanos y un perro.',
    'Nos vemos en la próxima sala.',
    'Me llamo Luna y me gusta dibujar.',
    'A veces me cuesta adaptarme a los cambios.',
    '¿Alguien tiene consejos para organizar el tiempo de estudio?',
    'El examen es el 20 de octubre.',
  ])('permite un mensaje inocuo: «%s»', (texto) => {
    expect(analizar(texto, reglas)).toBeNull();
  });

  it('todas las reglas del seed compilan y cubren las seis categorías', () => {
    const categorias = new Set(reglas.map((regla) => regla.categoria));
    expect([...categorias].sort()).toEqual([
      'contacto',
      'edad',
      'identidad',
      'publicidad_comercio',
      'redes_externas',
      'ubicacion',
    ]);
  });

  it('normaliza tildes, mayúsculas y espacios antes de comparar', () => {
    expect(normalizar('  ¿Cuántos   AÑOS tienes? ')).toBe('¿cuantos anos tienes?');
  });
});

describe('Servicio DLP', () => {
  it('bloquea, devuelve el mensaje estándar y registra el evento sin el texto', async () => {
    const { repositorio, eventos } = repositorioFalso(() => reglas);
    const dlp = crearServicioDlp({ repositorio, logger });

    const resultado = await dlp.revisar('Escríbeme al 3000000000.', CONTEXTO);

    expect(resultado).toMatchObject({ permitido: false, mensaje: MENSAJE_BLOQUEO });
    expect(MENSAJE_BLOQUEO).toBe(
      'Este mensaje contiene información que no puede compartirse en la plataforma para proteger tu privacidad y la de otros usuarios.',
    );
    expect(eventos).toEqual([
      {
        idUsuario: 'usuario-prueba',
        tipoContenido: 'perfil',
        categoria: 'contacto',
        idRegla: expect.stringMatching(/^id-contacto-/),
        accion: 'bloquear',
        resultado: 'bloqueado',
      },
    ]);
    expect(JSON.stringify(eventos)).not.toContain('3000000000');
  });

  it('no registra nada cuando el texto es inocuo', async () => {
    const { repositorio, eventos } = repositorioFalso(() => reglas);
    const resultado = await crearServicioDlp({ repositorio, logger }).revisar(
      'Me gusta dibujar.',
      CONTEXTO,
    );
    expect(resultado).toEqual({ permitido: true, deteccion: null });
    expect(eventos).toEqual([]);
  });

  it('solo aplica las reglas activas que entrega la base', async () => {
    const sinTelefono = () => reglas.filter((regla) => regla.codigo !== 'contacto-telefono');
    const { repositorio } = repositorioFalso(sinTelefono);
    const resultado = await crearServicioDlp({ repositorio, logger }).revisar(
      '3000000000',
      CONTEXTO,
    );
    expect(resultado.permitido).toBe(true);
  });

  it('exigirPermitido lanza 422 con el campo, sin el dato ni la categoría', async () => {
    const { repositorio } = repositorioFalso(() => reglas);
    const dlp = crearServicioDlp({ repositorio, logger });

    const error = await dlp
      .exigirPermitido({ alias: 'LunaDemo', intereses: ['música', 'Tengo 14 años'] }, CONTEXTO)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ErrorApp);
    expect(error).toMatchObject({
      estado: 422,
      codigo: 'CONTENIDO_BLOQUEADO',
      message: MENSAJE_BLOQUEO,
      detalles: { campo: 'intereses' },
    });
    expect(JSON.stringify((error as ErrorApp).detalles)).not.toMatch(/14|edad/);
  });

  it('falla cerrado: si no puede leer las reglas, no deja publicar (503)', async () => {
    const repositorio: RepositorioDlp = {
      reglasActivas: async () => {
        throw new Error('sin conexión');
      },
      registrarEvento: async () => {},
    };
    const error = await crearServicioDlp({ repositorio, logger })
      .revisar('hola', CONTEXTO)
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ estado: 503, codigo: 'DLP_NO_DISPONIBLE' });
  });

  it('admite un clasificador adicional como punto de extensión', async () => {
    const { repositorio, eventos } = repositorioFalso(() => reglas);
    const dlp = crearServicioDlp({
      repositorio,
      logger,
      clasificadores: [
        async (texto) =>
          texto.includes('palabra clave de prueba')
            ? {
                categoria: 'identidad',
                accion: 'bloquear',
                regla: { id: null, codigo: 'clasificador' },
              }
            : null,
      ],
    });

    expect((await dlp.revisar('Palabra clave de prueba', CONTEXTO)).permitido).toBe(false);
    expect(eventos[0]).toMatchObject({ categoria: 'identidad', idRegla: null });
  });
});
