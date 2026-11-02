/**
 * Validación de la salida de la IA de Cocuyo. La IA solo puede reformular la respuesta autorizada
 * del tema: si la salida trae algo que no está en esa fuente (enlaces, rutas, cifras, teléfonos,
 * nombres, temas sensibles, vocabulario ajeno o formato), se descarta y se usa la respuesta
 * predeterminada. Funciones puras.
 */
import type { TemaCocuyo } from './cocuyo.catalogo.js';
import { normalizarTexto } from './cocuyo.clasificador.js';

export const LARGO_MAXIMO_RESPUESTA = 600;
const LARGO_MINIMO_RESPUESTA = 15;

export type MotivoRechazo =
  | 'vacia'
  | 'larga'
  | 'enlace'
  | 'ruta'
  | 'formato'
  | 'cifra'
  | 'telefono'
  | 'nombre'
  | 'tema'
  | 'contenido_nuevo';

export type Validacion = { valida: true; texto: string } | { valida: false; motivo: MotivoRechazo };

const NUMEROS_EN_PALABRAS: Record<string, string> = {
  dos: '2',
  tres: '3',
  cuatro: '4',
  cinco: '5',
  seis: '6',
  siete: '7',
  ocho: '8',
  nueve: '9',
  diez: '10',
  once: '11',
  doce: '12',
  trece: '13',
  catorce: '14',
  quince: '15',
  dieciseis: '16',
  diecisiete: '17',
  dieciocho: '18',
  diecinueve: '19',
  veinte: '20',
  veintiuno: '21',
  veintidos: '22',
  treinta: '30',
  cuarenta: '40',
  cincuenta: '50',
  cien: '100',
  ciento: '100',
  mil: '1000',
  millon: '1000000',
  millones: '1000000',
};

/**
 * Temas que la IA no puede introducir si la fuente no los menciona: salud, política, dinero,
 * contactos y redes, emergencias y detalles del propio sistema de IA.
 */
const TERMINOS_SENSIBLES = [
  'medicament',
  'pastilla',
  'dosis',
  'terapia',
  'terapeut',
  'tratamiento',
  'psicolog',
  'psiquiatr',
  'diagnostic',
  'suicid',
  'droga',
  'alcohol',
  'sexual',
  'politic',
  'president',
  'eleccion',
  'religi',
  'dinero',
  'precio',
  'gratis',
  'pago',
  'policia',
  'emergencia',
  'llamar',
  'llama al',
  'whatsapp',
  'instagram',
  'facebook',
  'tiktok',
  'telegram',
  'openai',
  'chatgpt',
  'gpt',
  'inteligencia artificial',
  'modelo de lenguaje',
  'prompt',
  'instruccion',
  'programad',
  'codigo',
  'contrasena',
  'pelicula',
  'serie ',
  'series',
  'musica',
  'cancion',
  'videojuego',
  'futbol',
  'chiste',
  'receta',
  'noticia',
  'recomiendo',
  'recomendacion',
  'opinion',
];

/** Palabras de enlace habituales al reformular; no cuentan como contenido nuevo. */
const VOCABULARIO_COMUN = new Set(
  [
    'puedes',
    'pueden',
    'puedo',
    'podras',
    'claro',
    'tambien',
    'ademas',
    'cuando',
    'quieras',
    'quieres',
    'siempre',
    'nunca',
    'ninguna',
    'ningun',
    'alguna',
    'alguien',
    'primero',
    'despues',
    'luego',
    'entonces',
    'mientras',
    'dentro',
    'mismo',
    'misma',
    'solamente',
    'simplemente',
    'ejemplo',
    'pregunta',
    'ayudarte',
    'explico',
    'plataforma',
    'espacio',
    'lugar',
    'parte',
    'forma',
    'manera',
    'momento',
    'tienes',
    'tiene',
    'necesitas',
    'encuentras',
    'encontrar',
    'veras',
    'revisa',
    'recuerda',
    'importante',
    'persona',
    'personas',
    'cualquier',
    'ahora',
    'aqui',
    'donde',
    'cerca',
    'facil',
    'seguro',
    'segura',
    'tranquilo',
    'tranquila',
    'decir',
    'saber',
    'hacer',
    'estar',
    'estas',
    'sobre',
    'segun',
    'gente',
    'jovenes',
    'usuarios',
    'otras',
    'otros',
    'ellos',
    'ellas',
    'nadie',
    'mientras',
    'cocuyo',
    'respuesta',
    'informacion',
    'botón',
    'boton',
    'opcion',
    'seccion',
    'pagina',
  ].map((palabra) => raiz(normalizarTexto(palabra))),
);

function raiz(palabra: string) {
  return palabra.slice(0, 5);
}

/** Inicio de oración: después de estos signos una mayúscula no indica un nombre propio. */
const FIN_DE_ORACION = /[.!?:;¿¡«"“(\n]$/;

export function validarRespuestaGenerada(salida: string, tema: TemaCocuyo): Validacion {
  const texto = salida
    .replace(/\r/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/^\s*#+\s*/gm, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const fuente = [tema.pregunta, ...tema.parrafos, tema.enlace?.texto ?? ''].join('\n');
  const fuenteNormalizada = normalizarTexto(fuente);
  const palabrasFuente = new Set(fuenteNormalizada.split(' '));
  const raicesFuente = new Set([...palabrasFuente].filter((p) => p.length >= 4).map(raiz));
  const normalizado = normalizarTexto(texto);
  const rechazo = (motivo: MotivoRechazo): Validacion => ({ valida: false, motivo });

  if (texto.length < LARGO_MINIMO_RESPUESTA) return rechazo('vacia');
  if (texto.length > LARGO_MAXIMO_RESPUESTA) return rechazo('larga');
  if (/https?:|www\.|@|\b[\w-]+\.(com|co|org|net|gov|edu|io|app|info|me|ly)\b/i.test(texto)) {
    return rechazo('enlace');
  }
  if (/(^|[\s(«"'“])\/[a-z0-9]/i.test(texto)) return rechazo('ruta');
  if (/[<>`{}[\]|\\]/.test(texto)) return rechazo('formato');
  if (/(?:\+?\d[\s.-]?){7,}/.test(texto)) return rechazo('telefono');

  const numerosFuente = new Set(fuente.match(/\d+/g) ?? []);
  if ((texto.match(/\d+/g) ?? []).some((numero) => !numerosFuente.has(numero))) {
    return rechazo('cifra');
  }
  for (const palabra of normalizado.split(' ')) {
    const numero = NUMEROS_EN_PALABRAS[palabra];
    if (numero && !numerosFuente.has(numero) && !palabrasFuente.has(palabra)) {
      return rechazo('cifra');
    }
  }

  // Los nombres de botones y mensajes entre comillas deben existir tal cual en la fuente.
  for (const [, citado] of texto.matchAll(/[«"“]([^»"”]{1,80})[»"”]/g)) {
    if (!fuenteNormalizada.includes(normalizarTexto(citado ?? ''))) return rechazo('nombre');
  }

  // Nombres propios: una mayúscula en medio de la oración que la fuente no tiene.
  const fragmentos = texto.split(/\s+/);
  for (let i = 0; i < fragmentos.length; i++) {
    const limpio = fragmentos[i]!.replace(/^[¿¡«"“(]+/, '');
    const anterior = i === 0 ? '.' : fragmentos[i - 1]!;
    const empiezaOracion = FIN_DE_ORACION.test(anterior) || limpio !== fragmentos[i];
    if (!/^\p{Lu}/u.test(limpio) || empiezaOracion) continue;
    const palabra = normalizarTexto(limpio).split(' ')[0] ?? '';
    if (palabra && !palabrasFuente.has(palabra) && palabra !== 'cocuyo') return rechazo('nombre');
  }

  const conEspacios = ` ${normalizado} `;
  if (
    TERMINOS_SENSIBLES.some(
      (termino) =>
        conEspacios.includes(` ${termino}`) && !` ${fuenteNormalizada}`.includes(` ${termino}`),
    )
  ) {
    return rechazo('tema');
  }

  // Vocabulario: una reformulación usa sobre todo palabras de la fuente.
  const contenido = normalizado.split(' ').filter((palabra) => palabra.length >= 5);
  const nuevas = contenido.filter(
    (palabra) => !raicesFuente.has(raiz(palabra)) && !VOCABULARIO_COMUN.has(raiz(palabra)),
  );
  if (nuevas.length > Math.max(4, Math.ceil(contenido.length * 0.3))) {
    return rechazo('contenido_nuevo');
  }

  return { valida: true, texto };
}
