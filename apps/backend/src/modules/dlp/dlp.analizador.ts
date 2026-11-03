/**
 * Analizador DLP: funciones puras, sin base de datos ni red.
 * Combina reglas (expresiones regulares guardadas en app.regla_dlp) sobre el texto normalizado.
 * No detecta todas las formas posibles de compartir información ni de escribir groserías
 * (sección 16.2): lo que se escape llega a moderación por los reportes (segunda capa).
 */

export const CATEGORIAS_DLP = [
  'contacto',
  'redes_externas',
  'ubicacion',
  'identidad',
  'edad',
  'publicidad_comercio',
  'lenguaje_ofensivo',
  'contenido_sexual',
] as const;
export type CategoriaDlp = (typeof CATEGORIAS_DLP)[number];
export type AccionDlp = 'bloquear' | 'advertir' | 'registrar';
export type TipoContenido = 'perfil' | 'hilo' | 'respuesta' | 'sala' | 'reporte';

/**
 * Categorías de convivencia (groserías, insultos, lenguaje sexual y doble sentido). Sus reglas se
 * comparan además con variantes más agresivas del texto (`variantesLenguaje`) y su bloqueo usa
 * `MENSAJE_BLOQUEO_LENGUAJE`.
 */
export const CATEGORIAS_LENGUAJE: readonly CategoriaDlp[] = [
  'lenguaje_ofensivo',
  'contenido_sexual',
];

export const esCategoriaLenguaje = (categoria: CategoriaDlp) =>
  CATEGORIAS_LENGUAJE.includes(categoria);

/** Mensaje de bloqueo exacto (F22). Nunca repite el dato detectado. */
export const MENSAJE_BLOQUEO =
  'Este mensaje contiene información que no puede compartirse en la plataforma para proteger tu privacidad y la de otros usuarios.';

/**
 * Mensaje de bloqueo por lenguaje ofensivo o sexual. Tampoco repite la palabra detectada; el de
 * privacidad confundiría a quien escribió una grosería, que no compartió ningún dato.
 */
export const MENSAJE_BLOQUEO_LENGUAJE =
  'Este mensaje contiene lenguaje ofensivo, vulgar o sexual que no está permitido en la comunidad. Revisa las reglas de convivencia y escríbelo de otra forma.';

export const mensajeBloqueo = (categoria: CategoriaDlp) =>
  esCategoriaLenguaje(categoria) ? MENSAJE_BLOQUEO_LENGUAJE : MENSAJE_BLOQUEO;

export type ReglaCompilada = {
  id: string | null;
  codigo: string;
  categoria: CategoriaDlp;
  accion: AccionDlp;
  patron: RegExp;
};

export type DeteccionDlp = {
  categoria: CategoriaDlp;
  accion: AccionDlp;
  regla: { id: string | null; codigo: string };
};

const PRIORIDAD: Record<AccionDlp, number> = { bloquear: 3, advertir: 2, registrar: 1 };

export const masGrave = (a: DeteccionDlp | null, b: DeteccionDlp | null) =>
  !a || (b && PRIORIDAD[b.accion] > PRIORIDAD[a.accion]) ? b : a;

/**
 * Letras de otros alfabetos que se ven iguales a las latinas (cirílico y griego) y letras latinas
 * sin descomposición canónica. Se usan para esquivar filtros: «рutа» con р y а cirílicas.
 */
const HOMOGLIFOS: Record<string, string> = {
  а: 'a',
  в: 'b',
  е: 'e',
  ё: 'e',
  к: 'k',
  м: 'm',
  н: 'h',
  о: 'o',
  р: 'p',
  с: 'c',
  т: 't',
  у: 'y',
  х: 'x',
  і: 'i',
  ї: 'i',
  ј: 'j',
  ѕ: 's',
  ԁ: 'd',
  ӏ: 'l',
  ɡ: 'g',
  А: 'a',
  В: 'b',
  Е: 'e',
  К: 'k',
  М: 'm',
  Н: 'h',
  О: 'o',
  Р: 'p',
  С: 'c',
  Т: 't',
  У: 'y',
  Х: 'x',
  І: 'i',
  Ј: 'j',
  Ѕ: 's',
  α: 'a',
  β: 'b',
  ε: 'e',
  η: 'n',
  ι: 'i',
  κ: 'k',
  ν: 'v',
  ο: 'o',
  ρ: 'p',
  τ: 't',
  υ: 'u',
  χ: 'x',
  Α: 'a',
  Β: 'b',
  Ε: 'e',
  Ζ: 'z',
  Η: 'h',
  Ι: 'i',
  Κ: 'k',
  Μ: 'm',
  Ν: 'n',
  Ο: 'o',
  Ρ: 'p',
  Τ: 't',
  Υ: 'y',
  Χ: 'x',
  ø: 'o',
  Ø: 'o',
  ł: 'l',
  Ł: 'l',
  đ: 'd',
  Đ: 'd',
  ı: 'i',
  ß: 'ss',
  æ: 'ae',
  Æ: 'ae',
  œ: 'oe',
  Œ: 'oe',
  // Versalitas («ᴘᴜᴛᴀ»): NFKC no las convierte.
  ᴀ: 'a',
  ʙ: 'b',
  ᴄ: 'c',
  ᴅ: 'd',
  ᴇ: 'e',
  ꜰ: 'f',
  ɢ: 'g',
  ʜ: 'h',
  ɪ: 'i',
  ᴊ: 'j',
  ᴋ: 'k',
  ʟ: 'l',
  ᴍ: 'm',
  ɴ: 'n',
  ᴏ: 'o',
  ᴘ: 'p',
  ʀ: 'r',
  ꜱ: 's',
  ᴛ: 't',
  ᴜ: 'u',
  ᴠ: 'v',
  ᴡ: 'w',
  ʏ: 'y',
  ᴢ: 'z',
};
const RE_HOMOGLIFOS = new RegExp(`[${Object.keys(HOMOGLIFOS).join('')}]`, 'g');

/**
 * Letras en emoji que NFKC tampoco convierte: indicadores regionales («🇵🇺🇹🇦») y letras en
 * círculo o cuadrado negro («🅟🅤🅣🅐», «🅿🆄🆃🅰»). Cada bloque tiene las 26 letras en orden.
 */
const LETRAS_EMOJI: [inicio: number, fin: number][] = [
  [0x1f1e6, 0x1f1ff],
  [0x1f150, 0x1f169],
  [0x1f170, 0x1f189],
];
const RE_LETRAS_EMOJI = /[\u{1f1e6}-\u{1f1ff}\u{1f150}-\u{1f169}\u{1f170}-\u{1f189}]/gu;
const letraDeEmoji = (emoji: string) => {
  const codigo = emoji.codePointAt(0)!;
  const bloque = LETRAS_EMOJI.find(([inicio, fin]) => codigo >= inicio && codigo <= fin);
  return bloque ? String.fromCharCode(97 + codigo - bloque[0]) : emoji;
};

/**
 * Caracteres invisibles (ancho cero, guion suave, marcas de dirección) que parten palabras. Las
 * marcas combinantes invisibles (U+034F, U+17B4…) ya las quita el paso NFD que elimina \p{M}.
 */
const INVISIBLES =
  /[\u00ad\u061c\u115f\u1160\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u206a-\u206f\ufeff]/g;

/**
 * Minúsculas, sin tildes ni diéresis (ñ → n) y espacios simples. Antes unifica formas Unicode
 * equivalentes (NFKC: «ｐｕｔａ» de ancho completo → «puta»), cambia homoglifos, versalitas y letras
 * en emoji por su letra latina y quita caracteres invisibles. Las reglas se escriben sobre este texto normalizado. La detección
 * de evasión (F23) trabaja sobre variantes de este texto: ver `variantesEvasion` y
 * `variantesLenguaje`.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFKC')
    .replace(INVISIBLES, '')
    .replace(RE_HOMOGLIFOS, (letra) => HOMOGLIFOS[letra] ?? letra)
    .replace(RE_LETRAS_EMOJI, letraDeEmoji)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function compilarPatron(patron: string): RegExp {
  return new RegExp(patron, 'i');
}

// ─── Detección básica de evasión (F23, Fase 8) ─────────────────────────────────
// Intentos comunes de esquivar las reglas: números dictados en palabras, dígitos separados con
// símbolos, letras sueltas («i n s t a»), números en lugar de letras («1nst4»), letras repetidas
// («whaaatsapp») y correos escritos con «arroba» y «punto». Cada variante se analiza con las
// mismas reglas. NO detecta todas las formas posibles de evasión (secciones 16.2 y B.5).

const DIGITOS_EN_PALABRAS: Record<string, string> = {
  cero: '0',
  uno: '1',
  una: '1',
  dos: '2',
  tres: '3',
  cuatro: '4',
  cinco: '5',
  seis: '6',
  siete: '7',
  ocho: '8',
  nueve: '9',
};

const PALABRA_DIGITO = Object.keys(DIGITOS_EN_PALABRAS).join('|');

/**
 * Secuencias de al menos 4 dígitos dictados en palabras («tres cero cero cero…») → «3000…».
 * Con menos de 4 no se toca: «tengo dos hermanos y tres gatos» sigue igual.
 */
const SECUENCIA_DICTADA = new RegExp(
  `\\b(?:(?:${PALABRA_DIGITO}|\\d)[\\s,.-]+){3,}(?:${PALABRA_DIGITO}|\\d)\\b`,
  'g',
);

const SUSTITUCIONES: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  $: 's',
};

const unicas = (lista: string[]) => [...new Set(lista)];

/** Letras o dígitos sueltos separados («i n s t a», «w.h.a.t.s»): se juntan si son 3 o más. */
const juntarSueltas = (normalizado: string) =>
  normalizado.replace(/\b(?:[a-z0-9][\s.\-_*|·]){2,}[a-z0-9]\b/g, (grupo) =>
    grupo.replace(/[\s.\-_*|·]/g, ''),
  );

/**
 * Números y símbolos en lugar de letras dentro de palabras («1nst4gr4m», «wh@ts»). Solo en
 * palabras que ya tienen letras; un «@» inicial (usuario externo) se conserva.
 */
const sinSustituciones = (texto: string) =>
  texto.replace(/[a-z0-9@$]*[a-z][a-z0-9@$]*/g, (palabra) => {
    const arroba = palabra.startsWith('@') ? '@' : '';
    const resto = palabra.slice(arroba.length);
    return /[0-9@$]/.test(resto)
      ? arroba + [...resto].map((c) => SUSTITUCIONES[c] ?? c).join('')
      : palabra;
  });

export function variantesEvasion(normalizado: string): string[] {
  const variantes: string[] = [];

  // 1. Números dictados en palabras, sin separadores entre los dígitos.
  const dictado = normalizado.replace(SECUENCIA_DICTADA, (secuencia) =>
    secuencia
      .split(/[\s,.-]+/)
      .map((p) => DIGITOS_EN_PALABRAS[p] ?? p)
      .join(''),
  );
  variantes.push(dictado);

  // 2. Dígitos separados por símbolos o varios espacios («300 - 000 * 0000»). La barra «/» no
  //    se quita, para no confundir fechas como 21/10/2026 con un teléfono.
  variantes.push(dictado.replace(/(\d)[\s.\-_*|·,~+()]+(?=\d)/g, '$1'));

  // 3. Letras o dígitos sueltos separados.
  const juntas = juntarSueltas(normalizado);
  variantes.push(juntas);

  // 4. Números y símbolos en lugar de letras dentro de palabras.
  variantes.push(sinSustituciones(juntas));

  // 5. Letras repetidas tres o más veces («whaaatsapp» → «whatsapp»).
  variantes.push(sinSustituciones(juntas).replace(/([a-z])\1{2,}/g, '$1'));

  // 6. Correos escritos con palabras: «prueba arroba example punto test».
  variantes.push(
    normalizado
      .replace(/\s*(?:\barroba\b|\(at\)|\[at\])\s*/g, '@')
      .replace(/\s*(?:\bpunto\b|\(dot\)|\[dot\])\s*(?=[a-z]{2,}\b)/g, '.'),
  );

  return unicas(variantes).filter((v) => v !== normalizado);
}

// ─── Variantes para las reglas de lenguaje ofensivo y sexual ───────────────────
// Más agresivas que las de evasión: solo las ven las reglas de CATEGORIAS_LENGUAJE. En datos de
// contacto producirían falsos positivos (quitar signos dentro de palabras convierte una fecha en
// un número largo), pero una grosería no cambia de sentido por quitarle los puntos.

/** Símbolos que reemplazan una letra cuando están entre letras o dígitos («pu+a», «p!to»). */
const SUSTITUCIONES_ENTRE_LETRAS: Record<string, string> = {
  '+': 't',
  '!': 'i',
  '¡': 'i',
  '|': 'i',
  '€': 'e',
};

const sinSustitucionesExtendidas = (texto: string) =>
  sinSustituciones(
    texto.replace(/(?<=[a-z0-9])[+!¡|€](?=[a-z0-9])/g, (c) => SUSTITUCIONES_ENTRE_LETRAS[c] ?? c),
  );

/** Signos intercalados dentro de una palabra: «hijue.puta», «m-a-l-p-a-r-i-d-o», «p/u/t/a». */
const sinSignosInternos = (texto: string) =>
  texto.replace(/(?<=[a-z0-9])[^a-z0-9\s]+(?=[a-z0-9])/g, '');

/** Toda letra repetida queda una sola vez: «puuta» → «puta», «mieeerda» → «mierda». */
const sinRepeticiones = (texto: string) => texto.replace(/([a-z])\1+/g, '$1');

/**
 * Palabras función cortas que no se pegan a sus vecinas. Sin esto, «la gonorrea es una its»
 * quedaba «esunaits» y la excepción de salud (que busca «its») dejaba de verse; lo mismo con
 * «en la», «con la» o «de la» en las demás excepciones de contexto.
 */
const PALABRAS_FUNCION = new Set(
  'a al de del el en es la las le les lo los me mi nos no o por que se si su te tu un una y ya'.split(
    ' ',
  ),
);

/**
 * Fragmentos cortos separados por espacios: «hi jue pu ta» → «hijueputa», «hi jo de pu ta» →
 * «hijo de puta». Las palabras función quedan sueltas y parten el grupo.
 */
const pegarFragmentos = (texto: string) =>
  texto.replace(/(?<![a-z0-9])[a-z]{1,3}(?: [a-z]{1,3})+(?![a-z0-9])/g, (grupo) =>
    grupo
      .split(' ')
      .reduce<string[]>((partes, fragmento) => {
        const anterior = partes.at(-1);
        if (
          anterior !== undefined &&
          !PALABRAS_FUNCION.has(fragmento) &&
          !PALABRAS_FUNCION.has(anterior)
        ) {
          partes[partes.length - 1] = anterior + fragmento;
        } else {
          partes.push(fragmento);
        }
        return partes;
      }, [])
      .join(' '),
  );

/**
 * Letras ocultas con asterisco o numeral («p*ta», «m*erda», «hijuep*ta»): prueba las letras más
 * frecuentes en esa posición. La misma elección se aplica a la vez a todas las palabras
 * enmascaradas, así que el costo no crece con el número de palabras: 7 variantes, o 49 si alguna
 * palabra tiene dos comodines. Las palabras con más de dos comodines no se rellenan.
 */
const LETRAS_COMODIN = ['a', 'e', 'i', 'o', 'u', 'r', 't'];
const PALABRA_CON_COMODIN = /(?<![a-z*#])(?=[a-z*#]*[a-z][a-z*#]*[a-z])[a-z]*[*#][a-z*#]*/g;

function rellenarComodines(texto: string): string[] {
  const palabras = [...texto.matchAll(PALABRA_CON_COMODIN)].filter(
    ([palabra]) => (palabra.match(/[*#]/g)?.length ?? 0) <= 2,
  );
  if (palabras.length === 0) return [];
  const dosComodines = palabras.some(([palabra]) => palabra.match(/[*#]/g)!.length === 2);
  const pares = LETRAS_COMODIN.flatMap((primera) =>
    dosComodines ? LETRAS_COMODIN.map((segunda) => [primera, segunda]) : [[primera, primera]],
  );
  return pares.map(([primera, segunda]) => {
    let resultado = '';
    let desde = 0;
    for (const { 0: palabra, index } of palabras) {
      let n = 0;
      resultado +=
        texto.slice(desde, index) +
        palabra.replace(/[*#]/g, () => (n++ === 0 ? primera! : segunda!));
      desde = index + palabra.length;
    }
    return resultado + texto.slice(desde);
  });
}

/**
 * Emoji y signos sueltos entre letras («p 🍆 u t a», «pu 🍑 ta»): se quitan y quedan las letras y
 * los espacios, que luego se juntan con `juntarSueltas` y `pegarFragmentos`.
 */
const soloLetrasYEspacios = (texto: string) =>
  texto
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Variantes del texto normalizado para las reglas de lenguaje: leetspeak extendido, comodines,
 * signos y emoji intercalados, letras repetidas, fragmentos separados por espacios y el texto
 * entero sin espacios («mi erda» → «mierda»; como las reglas usan \b, esta última solo coincide
 * si TODO el mensaje forma la palabra, así que no convierte frases legítimas en groserías). Se
 * combinan entre sí («h1jue.puuta» → «hijueputa»). NO detecta todas las formas posibles de
 * escribir una grosería.
 */
export function variantesLenguaje(normalizado: string): string[] {
  const variantes: string[] = [];
  const conLeet = sinSustitucionesExtendidas(normalizado);
  const bases = unicas([
    normalizado,
    juntarSueltas(normalizado),
    juntarSueltas(soloLetrasYEspacios(conLeet)),
  ]);
  for (const base of bases) {
    const leet = sinSustitucionesExtendidas(base);
    const sinSignos = sinSignosInternos(leet);
    const sinRepetir = sinRepeticiones(sinSignos);
    variantes.push(
      leet,
      sinSignos,
      sinRepetir,
      pegarFragmentos(sinRepetir),
      sinRepetir.replace(/ /g, ''),
    );
    // Con comodines basta quitar signos y repeticiones: los rellenos ya son palabras completas.
    for (const relleno of rellenarComodines(leet)) {
      variantes.push(relleno, sinRepeticiones(sinSignosInternos(relleno)));
    }
  }
  return unicas(variantes).filter((v) => v !== normalizado);
}

/**
 * Textos que ven las reglas de lenguaje. Normalizar convierte la «ñ» en «n», y «coño» quedaría
 * igual a «cono» (de helado); si el texto trae «ñ», se agrega otra versión con «ñ» → «ny» para
 * que las reglas distingan «cony[oa]» sin bloquear «cono».
 */
function textosParaLenguaje(texto: string, normalizado: string, textos: string[]): string[] {
  const conEnie = texto.normalize('NFC');
  const variantes = [...textos, ...variantesLenguaje(normalizado)];
  if (/[ñÑ]/.test(conEnie)) {
    const conNy = normalizar(conEnie.replace(/ñ/g, 'ny').replace(/Ñ/g, 'NY'));
    variantes.push(conNy, ...variantesLenguaje(conNy));
  }
  return unicas(variantes);
}

/** La detección más grave entre las reglas que coinciden, o null si ninguna coincide. */
export function analizar(texto: string, reglas: ReglaCompilada[]): DeteccionDlp | null {
  const normalizado = normalizar(texto);
  const textos = [normalizado, ...variantesEvasion(normalizado)];
  // Solo se calculan si hay alguna regla de lenguaje activa.
  let textosLenguaje: string[] | undefined;
  let resultado: DeteccionDlp | null = null;
  for (const regla of reglas) {
    const candidatos = esCategoriaLenguaje(regla.categoria)
      ? (textosLenguaje ??= textosParaLenguaje(texto, normalizado, textos))
      : textos;
    if (!candidatos.some((t) => regla.patron.test(t))) continue;
    resultado = masGrave(resultado, {
      categoria: regla.categoria,
      accion: regla.accion,
      regla: { id: regla.id, codigo: regla.codigo },
    });
    if (resultado?.accion === 'bloquear') break;
  }
  return resultado;
}
