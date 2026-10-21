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
 * sobre este texto normalizado. No es detección de evasión (eso es F23, Fase 8).
 */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function compilarPatron(patron: string): RegExp {
  return new RegExp(patron, 'i');
}

/** La detección más grave entre las reglas que coinciden, o null si ninguna coincide. */
export function analizar(texto: string, reglas: ReglaCompilada[]): DeteccionDlp | null {
  const normalizado = normalizar(texto);
  let resultado: DeteccionDlp | null = null;
  for (const regla of reglas) {
    if (!regla.patron.test(normalizado)) continue;
    resultado = masGrave(resultado, {
      categoria: regla.categoria,
      accion: regla.accion,
      regla: { id: regla.id, codigo: regla.codigo },
    });
    if (resultado?.accion === 'bloquear') break;
  }
  return resultado;
}
