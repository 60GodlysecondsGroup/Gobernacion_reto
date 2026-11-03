/**
 * Markdown de las respuestas de los asistentes, sin dependencias y sin HTML crudo: el texto se
 * convierte en un árbol de bloques que React pinta como elementos normales, así que nada de lo
 * que escriba el modelo se interpreta como marcado. Cubre lo que usan los asistentes: párrafos
 * (con saltos de línea), títulos, listas, citas, tablas, bloques de código, separadores, negrita,
 * cursiva, código en línea y enlaces (solo con destinos seguros).
 */

export type EnLinea =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'fuerte'; hijos: EnLinea[] }
  | { tipo: 'enfasis'; hijos: EnLinea[] }
  | { tipo: 'codigo'; texto: string }
  | { tipo: 'enlace'; href: string; hijos: EnLinea[] }
  | { tipo: 'salto' };

export type Alineacion = 'izquierda' | 'centro' | 'derecha' | null;

export type Bloque =
  | { tipo: 'parrafo'; contenido: EnLinea[] }
  | { tipo: 'titulo'; nivel: 1 | 2 | 3; contenido: EnLinea[] }
  | { tipo: 'lista'; ordenada: boolean; inicio: number; elementos: EnLinea[][] }
  | { tipo: 'codigo'; lenguaje: string; texto: string }
  | { tipo: 'cita'; bloques: Bloque[] }
  | {
      tipo: 'tabla';
      alineacion: Alineacion[];
      cabecera: EnLinea[][];
      filas: EnLinea[][][];
    }
  | { tipo: 'separador' };

/** Destinos permitidos: rutas internas, web, correo y teléfono. Cualquier otro se muestra como texto. */
export function hrefSeguro(href: string) {
  const limpio = href.trim();
  if (/^\/(?!\/)/.test(limpio) || limpio.startsWith('#')) return limpio;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(limpio)) return limpio;
  return null;
}

const PATRON_EN_LINEA = new RegExp(
  [
    '`([^`\\n]+)`', // 1 código
    '\\[([^\\]\\n]+)\\]\\(([^)\\s]+)\\)', // 2 texto, 3 destino del enlace
    '\\*\\*\\*([^*\\n]+?)\\*\\*\\*', // 4 negrita y cursiva
    '\\*\\*([^\\n]+?)\\*\\*', // 5 negrita
    '__([^_\\n]+?)__', // 6 negrita
    '(?<![\\w*])\\*(?![\\s*])([^*\\n]+?)(?<!\\s)\\*(?![\\w*])', // 7 cursiva
    '(?<![\\w_])_(?![\\s_])([^_\\n]+?)(?<!\\s)_(?![\\w_])', // 8 cursiva
    '(https?:\\/\\/[^\\s<>()]*[^\\s<>().,;:!?\'"»])', // 9 dirección suelta
  ].join('|'),
  'g',
);

export function analizarEnLinea(texto: string): EnLinea[] {
  const resultado: EnLinea[] = [];
  const patron = new RegExp(PATRON_EN_LINEA);
  let inicio = 0;
  let c: RegExpExecArray | null;

  const agregarTexto = (fragmento: string) => {
    if (!fragmento) return;
    const ultimo = resultado.at(-1);
    if (ultimo?.tipo === 'texto') ultimo.texto += fragmento;
    else resultado.push({ tipo: 'texto', texto: fragmento });
  };

  while ((c = patron.exec(texto)) !== null) {
    agregarTexto(texto.slice(inicio, c.index));
    if (c[1] !== undefined) {
      resultado.push({ tipo: 'codigo', texto: c[1] });
    } else if (c[2] !== undefined) {
      const href = hrefSeguro(c[3]);
      if (href) resultado.push({ tipo: 'enlace', href, hijos: analizarEnLinea(c[2]) });
      else agregarTexto(c[2]);
    } else if (c[4] !== undefined) {
      resultado.push({
        tipo: 'fuerte',
        hijos: [{ tipo: 'enfasis', hijos: analizarEnLinea(c[4]) }],
      });
    } else if (c[5] !== undefined || c[6] !== undefined) {
      resultado.push({ tipo: 'fuerte', hijos: analizarEnLinea((c[5] ?? c[6])!) });
    } else if (c[7] !== undefined || c[8] !== undefined) {
      resultado.push({ tipo: 'enfasis', hijos: analizarEnLinea((c[7] ?? c[8])!) });
    } else if (c[9] !== undefined) {
      resultado.push({ tipo: 'enlace', href: c[9], hijos: [{ tipo: 'texto', texto: c[9] }] });
    }
    inicio = patron.lastIndex;
  }
  agregarTexto(texto.slice(inicio));
  return resultado;
}

/** Une varias líneas de un mismo párrafo conservando sus saltos (como en un chat). */
function lineasConSaltos(lineas: string[]): EnLinea[] {
  return lineas.flatMap((linea, indice) => [
    ...(indice > 0 ? [{ tipo: 'salto' } as const] : []),
    ...analizarEnLinea(linea),
  ]);
}

const VALLA = /^\s*(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/;
const SEPARADOR = /^\s*(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/;
const TITULO = /^\s*(#{1,6})\s+(.+?)\s*#*\s*$/;
const CITA = /^\s*>\s?(.*)$/;
const ELEMENTO = /^(\s*)(?:([-*+•])|(\d{1,9})[.)])\s+(.*)$/;
const FILA_DIVISORIA = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function celdas(linea: string) {
  let contenido = linea.trim();
  if (contenido.startsWith('|')) contenido = contenido.slice(1);
  if (contenido.endsWith('|') && !contenido.endsWith('\\|')) contenido = contenido.slice(0, -1);
  return contenido.split(/(?<!\\)\|/).map((celda) => celda.trim().replace(/\\\|/g, '|'));
}

function alineacionDe(celda: string): Alineacion {
  const izquierda = celda.startsWith(':');
  const derecha = celda.endsWith(':');
  if (izquierda && derecha) return 'centro';
  if (derecha) return 'derecha';
  if (izquierda) return 'izquierda';
  return null;
}

export function analizarMarkdown(texto: string): Bloque[] {
  const lineas = texto.replace(/\r\n?/g, '\n').split('\n');
  const bloques: Bloque[] = [];
  let parrafo: string[] = [];
  let lista: { ordenada: boolean; inicio: number; elementos: string[][] } | null = null;

  const cerrarParrafo = () => {
    if (parrafo.length) bloques.push({ tipo: 'parrafo', contenido: lineasConSaltos(parrafo) });
    parrafo = [];
  };
  const cerrarLista = () => {
    if (lista) {
      bloques.push({
        tipo: 'lista',
        ordenada: lista.ordenada,
        inicio: lista.inicio,
        elementos: lista.elementos.map(lineasConSaltos),
      });
    }
    lista = null;
  };
  const cerrarTodo = () => {
    cerrarParrafo();
    cerrarLista();
  };

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];

    const valla = linea.match(VALLA);
    if (valla) {
      cerrarTodo();
      const cuerpo: string[] = [];
      const cierre = valla[1];
      i++;
      while (i < lineas.length && !lineas[i].trim().startsWith(cierre)) cuerpo.push(lineas[i++]);
      bloques.push({ tipo: 'codigo', lenguaje: valla[2], texto: cuerpo.join('\n') });
      continue;
    }

    if (!linea.trim()) {
      cerrarTodo();
      continue;
    }

    if (SEPARADOR.test(linea)) {
      cerrarTodo();
      bloques.push({ tipo: 'separador' });
      continue;
    }

    const titulo = linea.match(TITULO);
    if (titulo) {
      cerrarTodo();
      const nivel = Math.min(titulo[1].length, 3) as 1 | 2 | 3;
      bloques.push({ tipo: 'titulo', nivel, contenido: analizarEnLinea(titulo[2]) });
      continue;
    }

    if (linea.includes('|') && i + 1 < lineas.length && FILA_DIVISORIA.test(lineas[i + 1])) {
      const cabecera = celdas(linea);
      const divisoria = celdas(lineas[i + 1]);
      if (divisoria.length === cabecera.length) {
        cerrarTodo();
        i += 2;
        const filas: string[][] = [];
        while (i < lineas.length && lineas[i].includes('|') && lineas[i].trim()) {
          filas.push(celdas(lineas[i++]));
        }
        i--;
        const ancho = cabecera.length;
        bloques.push({
          tipo: 'tabla',
          alineacion: divisoria.map(alineacionDe),
          cabecera: cabecera.map(analizarEnLinea),
          filas: filas.map((fila) =>
            Array.from({ length: ancho }, (_, j) => analizarEnLinea(fila[j] ?? '')),
          ),
        });
        continue;
      }
    }

    if (CITA.test(linea)) {
      cerrarTodo();
      const citadas: string[] = [];
      while (i < lineas.length && CITA.test(lineas[i])) citadas.push(lineas[i++].match(CITA)![1]);
      i--;
      bloques.push({ tipo: 'cita', bloques: analizarMarkdown(citadas.join('\n')) });
      continue;
    }

    const elemento = linea.match(ELEMENTO);
    if (elemento) {
      cerrarParrafo();
      const ordenada = elemento[3] !== undefined;
      if (lista && lista.ordenada !== ordenada) cerrarLista();
      if (!lista) lista = { ordenada, inicio: ordenada ? Number(elemento[3]) : 1, elementos: [] };
      lista.elementos.push([elemento[4]]);
      continue;
    }

    // Una línea sangrada justo después de un elemento lo continúa.
    if (lista && /^\s+/.test(linea)) {
      lista.elementos.at(-1)!.push(linea.trim());
      continue;
    }

    cerrarLista();
    parrafo.push(linea.trim());
  }
  cerrarTodo();
  return bloques;
}

/** Texto plano de una respuesta (para copiarla): quita el marcado más común. */
export function textoPlano(texto: string) {
  return texto
    .replace(/\r\n?/g, '\n')
    .replace(/^\s*(`{3,}|~{3,}).*$/gm, '')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, '$1 ($2)')
    .replace(/(\*\*\*|\*\*|__)(.+?)\1/g, '$2')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
