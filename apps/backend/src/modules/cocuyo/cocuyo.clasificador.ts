/**
 * Clasificador local de Cocuyo: funciones puras, sin red ni IA. Decide ANTES de cualquier llamada
 * al proveedor si un mensaje es una urgencia, un intento de manipulación, un pedido de acciones,
 * un tema del catálogo, una intención de conversación o algo fuera de alcance.
 *
 * Tolera errores de ortografía y coloquialismos: compara palabras sin tildes, con una clave
 * fonética del español (b/v, s/z/c, k/qu, j/g, h muda, ll/y, letras repetidas), abreviaturas de
 * chat («q», «xq», «pa», «msj») y una distancia de edición pequeña.
 */
import { esCrisis } from '../asistente-usuario/asistente-usuario.service.js';
import {
  IDS_META,
  RESPUESTAS_META,
  SENALES_FUERA_DE_ALCANCE,
  TEMAS,
  type IdMeta,
  type IdTema,
  type Senal,
} from './cocuyo.catalogo.js';

export type Clasificacion =
  | { tipo: 'crisis' }
  | { tipo: 'manipulacion' }
  | { tipo: 'accion' }
  | { tipo: 'tema'; tema: IdTema; fueraDeAlcance: boolean }
  | { tipo: 'meta'; meta: IdMeta }
  | { tipo: 'fuera_de_alcance' }
  /** Sin tema claro: `candidatos` vacío significa que no hubo ninguna señal. */
  | { tipo: 'ambigua'; candidatos: IdTema[] };

/** Minúsculas, sin tildes ni signos, espacios simples (como el DLP). */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const ABREVIATURAS: Record<string, string> = {
  q: 'que',
  k: 'que',
  ke: 'que',
  xq: 'porque',
  pq: 'porque',
  porq: 'porque',
  x: 'por',
  d: 'de',
  tb: 'tambien',
  tmb: 'tambien',
  pa: 'para',
  xa: 'para',
  msj: 'mensaje',
  msg: 'mensaje',
  msjs: 'mensajes',
  dnd: 'donde',
  cm: 'como',
  kmo: 'como',
  toy: 'estoy',
  tng: 'tengo',
  aki: 'aqui',
  xfa: '',
  porfa: '',
  pls: '',
  plis: '',
};

/** Clave fonética: dos escrituras que suenan igual en español producen la misma clave. */
export function clave(palabra: string): string {
  return palabra
    .replace(/^h/, '')
    .replace(/([^cs])h/g, '$1')
    .replace(/qu(?=[ei])/g, 'k')
    .replace(/q/g, 'k')
    .replace(/c(?=[ei])/g, 's')
    .replace(/c(?!h)/g, 'k')
    .replace(/z/g, 's')
    .replace(/v/g, 'b')
    .replace(/g(?=[ei])/g, 'j')
    .replace(/ll/g, 'y')
    .replace(/y$/, 'i')
    .replace(/(.)\1+/g, '$1');
}

/** Palabras del mensaje, ya normalizadas, sin abreviaturas y en clave fonética. */
export function palabrasClave(texto: string): string[] {
  return normalizarTexto(texto)
    .split(' ')
    .map((palabra) => ABREVIATURAS[palabra] ?? palabra)
    .flatMap((palabra) => palabra.split(' '))
    .filter(Boolean)
    .map(clave);
}

export function distancia(a: string, b: string): number {
  if (a === b) return 0;
  const previa = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previa[0]!;
    previa[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const arriba = previa[j]!;
      previa[j] = Math.min(
        previa[j]! + 1,
        previa[j - 1]! + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = arriba;
    }
  }
  return previa[b.length]!;
}

const tolerancia = (largo: number) => (largo <= 4 ? 0 : largo <= 7 ? 1 : 2);

type Alternativa = { base: string; prefijo: boolean; exacta: boolean };
type SenalCompilada = { peso: number; grupos: Alternativa[][] };

function compilar([peso, expresion]: Senal): SenalCompilada {
  return {
    peso,
    grupos: expresion.split('+').map((grupo) =>
      grupo
        .split('|')
        .map((alternativa) => alternativa.trim())
        .filter(Boolean)
        .map((alternativa) => ({
          base: clave(normalizarTexto(alternativa.replace(/^=|\*$/g, ''))),
          prefijo: alternativa.endsWith('*'),
          exacta: alternativa.startsWith('='),
        })),
    ),
  };
}

function coincide(palabra: string, { base, prefijo, exacta }: Alternativa): boolean {
  if (exacta) return palabra === base;
  if (prefijo) {
    if (palabra.startsWith(base)) return true;
    // Raíces cortas con un error se confunden con otras palabras («cuanto» y «cuento»).
    if (base.length < 7) return false;
    // Un error de una letra dentro de la raíz («inkomda» por «incomoda»).
    return [base.length - 1, base.length, base.length + 1].some(
      (largo) => palabra.length >= largo && distancia(palabra.slice(0, largo), base) <= 1,
    );
  }
  return palabra === base || distancia(palabra, base) <= tolerancia(base.length);
}

function puntuar(palabras: string[], senales: SenalCompilada[]): number {
  let total = 0;
  for (const senal of senales) {
    const cumple = senal.grupos.every((grupo) =>
      grupo.some((alternativa) => palabras.some((palabra) => coincide(palabra, alternativa))),
    );
    if (cumple) total += senal.peso;
  }
  return total;
}

const SENALES_TEMAS = TEMAS.map((tema) => ({ id: tema.id, senales: tema.senales.map(compilar) }));
const SENALES_META = IDS_META.map((id) => ({
  id,
  senales: RESPUESTAS_META[id].senales.map(compilar),
}));
const SENALES_FUERA = SENALES_FUERA_DE_ALCANCE.map(compilar);

// ─── Detectores sobre el texto normalizado ────────────────────────────────────

/** Posible peligro inmediato: tiene prioridad sobre todo lo demás y nunca va a la IA. */
const CRISIS =
  /\b(suicid\w*|matarme|me voy a matar|quitarme la vida|me quiero morir|quiero morir\w*|no quiero (seguir )?vivir|hacerme dano|me quiero hacer dano|cortarme|me corto|autolesion\w*|estoy en peligro|me (estan )?(pegando|golpeando)|me pegan?|me golpean?|abusa\w* de mi|abuso sexual|me violo|me violaron|me quieren hacer dano|me amenazan de muerte)\b/;

/** Intentos de cambiar el rol, saltarse las reglas o extraer instrucciones (prompt injection). */
const MANIPULACION = [
  /\b(ignora\w*|ignore|olvida\w*|omite|omitir|desobedece|saltate|salta|descarta|anula|no sigas|no hagas caso|deja de seguir)\b.{0,60}\b(instrucci\w*|reglas?|restricci\w*|indicaci\w*|anterior\w*|previ\w*|todo|programacion|directrices|politicas?|filtros?|limites?)\b/,
  /\b(a partir de ahora|desde ahora|de ahora en adelante)\b.{0,40}\b(eres|seras|actua\w*|responde\w*|habla\w*|vas a)\b/,
  /\b(actua|actuar|comportate|finge|fingir|simula|hazte pasar|juega a ser|pretende ser|imagina que eres|interpreta el papel)\s+(como|que eres|ser|por|de)\b/,
  /\b(eres ahora|ahora eres|ahora seras|tu nuevo rol|nuevo rol|cambia de rol|cambia tu rol|cambiar de rol|cambiar tu rol)\b/,
  /\b(system prompt|prompt|jailbreak|modo dan|dan mode|modo desarrollador|developer mode|modo dios|sin restricciones|sin filtros?|sin limites|sin censura)\b/,
  /\b(revela\w*|muestra\w*|dime|imprime|repite|copia|ensena\w*|dame|cuales son)\b.{0,40}\b(tus instrucciones|las instrucciones|instrucciones internas|reglas internas|tu configuracion|codigo fuente|mensaje del sistema|api ?key|tu clave|secreto|token)\b/,
  /\btus (instrucciones|reglas|programacion|restricciones|directrices)\b/,
  /\b(ignore (all |the )?(previous|above|prior)|you are now|act as|pretend (to be|you are)|disregard|new instructions)\b/,
  /\b(responde|contesta|habla)\b.{0,30}\b(cualquier (cosa|tema|pregunta)|lo que (sea|quieras|te pida)|sin limites|en ingles)\b/,
];

/** Marcas de formato con las que se intenta inyectar mensajes de sistema. Sobre el texto crudo. */
const MARCAS_INYECCION =
  /<\/?\s*(system|assistant|user|developer|instrucciones|sistema)\s*>|\[\/?inst\]|###|```|\{\{|<\||\b(system|assistant|developer)\s*:/i;

/** Evita confundir una pregunta («¿cómo se cambia mi avatar?») con una orden a Cocuyo. */
const NO_PREGUNTA = String.raw`(?<!\b(?:se|como|donde|puedo|podemos|cuando|si|que|quien) )`;
const orden = (patron: string) => new RegExp(NO_PREGUNTA + patron);

/** Pedidos para que Cocuyo haga cosas que no hace (ampliar capacidades). */
const ACCIONES = [
  /\b(busca\w*|googlea\w*|consulta) (en|por) (internet|google|la web|la red)\b/,
  /\b(enviame|mandame|enviale|mandale|escribele|reenviale) (un |una |el |la )?(correo|email|mail|mensaje|whatsapp|sms|carta)\b/,
  /\b(llamame|llamale|llamen|contactame|contactalo|contactala|contacten|avisale|avisales)\b/,
  /\b(puedes|podrias|quiero que) (llamar|contactar|avisar|enviar|mandar|cambiar|borrar|eliminar|modificar|editar|crear|publicar|reportar|bloquear|banear|suspender|desbloquear|entrar|acceder|revisar|ver|buscar)\b/,
  /\b(agendame|reservame|pideme|agenda|reserva) (una |la |un )?(cita|turno|consulta|hora)\b/,
  orden(
    String.raw`\b(cambia|borra|elimina|modifica|edita|resetea|restablece|recupera) (mi|mis) (cuenta|contrasena|clave|perfil|alias|avatar|usuario|mensajes?|hilos?|publicacion\w*|reportes?)\b`,
  ),
  /\b(cambiame|borrame|eliminame|editame)\b/,
  orden(
    String.raw`\b(accede|entra|ingresa|revisa|abre) (a |en )?(mi|su|otra|otras|sus) (cuenta|mensajes|chats?|conversacion\w*)\b`,
  ),
  /\bdatos? de (otro|otra|otros|otras|un|una|esa|ese) (usuari\w*|persona|cuenta|joven)\b/,
  /\b(quien|quienes) (me )?(reporto|reportaron|denuncio)\b/,
  /\b(recuerdame|guardame|anota|apunta|recuerda (mi|esto|que))\b/,
  /\b(publicalo|publicame|reportalo|bloquealo|banealo|suspendelo)\b/,
];

/** Datos personales evidentes (además de las reglas DLP de la base, ver cocuyo.privacidad.ts). */
const CORREO = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;
const DATO_PERSONAL = [
  /(?:\+?\d[\s.-]?){7,}/,
  /\b(me llamo|mi nombre es|mi numero es|mi telefono es|mi celular es|mi correo es|vivo en|mi direccion|mi colegio es|estudio en el colegio)\b/,
  /\btengo \d{1,2} anos\b/,
];

export const esManipulacion = (texto: string) => {
  const normalizado = normalizarTexto(texto);
  return MARCAS_INYECCION.test(texto) || MANIPULACION.some((patron) => patron.test(normalizado));
};

export const esPedidoDeAccion = (texto: string) => {
  const normalizado = normalizarTexto(texto);
  return ACCIONES.some((patron) => patron.test(normalizado));
};

export const esUrgencia = (texto: string) => esCrisis(texto) || CRISIS.test(normalizarTexto(texto));

export const pareceDatoPersonal = (texto: string) => {
  const normalizado = normalizarTexto(texto);
  return CORREO.test(texto) || DATO_PERSONAL.some((patron) => patron.test(normalizado));
};

/** Puntaje de cada tema (para pruebas y diagnóstico). */
export function puntajes(texto: string) {
  const palabras = palabrasClave(texto);
  return {
    temas: SENALES_TEMAS.map(({ id, senales }) => ({ id, puntaje: puntuar(palabras, senales) }))
      .filter(({ puntaje }) => puntaje > 0)
      .sort((a, b) => b.puntaje - a.puntaje),
    meta: SENALES_META.map(({ id, senales }) => ({ id, puntaje: puntuar(palabras, senales) }))
      .filter(({ puntaje }) => puntaje > 0)
      .sort((a, b) => b.puntaje - a.puntaje),
    fuera: puntuar(palabras, SENALES_FUERA),
    palabras: palabras.length,
  };
}

/** Puntaje mínimo para elegir un tema sin ayuda de la IA, y ventaja mínima sobre el segundo. */
const UMBRAL = 2;
const VENTAJA = 1;

/**
 * Clasificación local, en este orden de prioridad: urgencia → manipulación → pedido de acciones →
 * fuera de alcance → tema → intención de conversación → ambigua.
 */
export function clasificar(texto: string): Clasificacion {
  if (esUrgencia(texto)) return { tipo: 'crisis' };
  if (esManipulacion(texto)) return { tipo: 'manipulacion' };
  if (esPedidoDeAccion(texto)) return { tipo: 'accion' };

  const { temas, meta, fuera, palabras } = puntajes(texto);
  const primero = temas[0]?.puntaje ?? 0;
  const segundo = temas[1]?.puntaje ?? 0;

  // Con un tema igual de claro se responde el tema y se avisa que lo demás no se atiende.
  if (fuera >= UMBRAL && fuera > primero) return { tipo: 'fuera_de_alcance' };
  if (primero >= UMBRAL && primero - segundo >= VENTAJA) {
    return { tipo: 'tema', tema: temas[0]!.id, fueraDeAlcance: fuera >= UMBRAL };
  }
  if (primero >= UMBRAL) {
    const candidatos = temas.filter(({ puntaje }) => puntaje >= primero - 1).slice(0, 3);
    return { tipo: 'ambigua', candidatos: candidatos.map(({ id }) => id) };
  }
  const capacidades = meta.find(({ id }) => id === 'capacidades');
  if (capacidades && capacidades.puntaje >= UMBRAL) return { tipo: 'meta', meta: 'capacidades' };
  if (primero === 0 && palabras <= 6) {
    const conversacion = meta.find(({ id }) => id !== 'capacidades');
    if (conversacion) return { tipo: 'meta', meta: conversacion.id };
  }
  return { tipo: 'ambigua', candidatos: temas.slice(0, 3).map(({ id }) => id) };
}
