/**
 * Analizador DLP: funciones puras, sin base de datos ni red.
 * Combina reglas (expresiones regulares guardadas en app.regla_dlp) sobre el texto normalizado.
 * No detecta todas las formas posibles de compartir información (sección 16.2).
 */

export const CATEGORIAS_DLP = [
  'contacto',
  'redes_externas',
  'ubicacion',
  'identidad',
  'edad',
  'publicidad_comercio',
] as const;
export type CategoriaDlp = (typeof CATEGORIAS_DLP)[number];
export type AccionDlp = 'bloquear' | 'advertir' | 'registrar';
export type TipoContenido = 'perfil' | 'hilo' | 'respuesta' | 'sala' | 'reporte';

/** Mensaje de bloqueo exacto (F22). Nunca repite el dato detectado. */
export const MENSAJE_BLOQUEO =
  'Este mensaje contiene información que no puede compartirse en la plataforma para proteger tu privacidad y la de otros usuarios.';

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
 * Minúsculas, sin tildes ni diéresis (ñ → n) y espacios simples. Las reglas se escriben
 * sobre este texto normalizado. La detección de evasión (F23) trabaja sobre variantes de este
 * texto: ver `variantesEvasion`.
 */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
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

  // 3. Letras o dígitos sueltos separados («i n s t a», «w.h.a.t.s»): se juntan si son 3 o más.
  const juntas = normalizado.replace(/\b(?:[a-z0-9][\s.\-_*|·]){2,}[a-z0-9]\b/g, (grupo) =>
    grupo.replace(/[\s.\-_*|·]/g, ''),
  );
  variantes.push(juntas);

  // 4. Números y símbolos en lugar de letras dentro de palabras («1nst4gr4m», «wh@ts»).
  //    Solo en palabras que ya tienen letras; un «@» inicial (usuario externo) se conserva.
  const sinSustituciones = (texto: string) =>
    texto.replace(/[a-z0-9@$]*[a-z][a-z0-9@$]*/g, (palabra) => {
      const arroba = palabra.startsWith('@') ? '@' : '';
      const resto = palabra.slice(arroba.length);
      return /[0-9@$]/.test(resto)
        ? arroba + [...resto].map((c) => SUSTITUCIONES[c] ?? c).join('')
        : palabra;
    });
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

/** La detección más grave entre las reglas que coinciden, o null si ninguna coincide. */
export function analizar(texto: string, reglas: ReglaCompilada[]): DeteccionDlp | null {
  const normalizado = normalizar(texto);
  const textos = [normalizado, ...variantesEvasion(normalizado)];
  let resultado: DeteccionDlp | null = null;
  for (const regla of reglas) {
    if (!textos.some((t) => regla.patron.test(t))) continue;
    resultado = masGrave(resultado, {
      categoria: regla.categoria,
      accion: regla.accion,
      regla: { id: regla.id, codigo: regla.codigo },
    });
    if (resultado?.accion === 'bloquear') break;
  }
  return resultado;
}
