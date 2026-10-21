import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Database } from '../../db/database.js';
import { esquemaEntradaCarga, type EntradaFuente } from './fuentes.esquemas.js';
import { accionParaCambio, calcularCambios } from './fuentes.reglas.js';
import { aCompleta, crearRepositorioFuentes } from './fuentes.repository.js';

/** Archivo que el equipo edita para reemplazar las fuentes de demostración por reales. */
export const ARCHIVO_FUENTES = fileURLToPath(
  new URL('../../../db/seed/fuentes_institucionales.json', import.meta.url),
);

export type ResumenCarga = {
  creadas: string[];
  actualizadas: string[];
  desactivadas: string[];
  sinCambios: string[];
};

/** Lee y valida el archivo completo. Si algo falla, no se carga nada y se dice qué y dónde. */
export async function leerFuentes(ruta = ARCHIVO_FUENTES): Promise<EntradaFuente[]> {
  const contenido: unknown = JSON.parse(await readFile(ruta, 'utf8'));
  if (!Array.isArray(contenido)) throw new Error(`${ruta}: debe ser una lista de fuentes.`);

  const problemas: string[] = [];
  const entradas: EntradaFuente[] = [];
  contenido.forEach((entrada, i) => {
    const resultado = esquemaEntradaCarga.safeParse(entrada);
    if (resultado.success) {
      entradas.push(resultado.data);
      return;
    }
    const codigo = (entrada as { codigo?: unknown })?.codigo ?? 'sin código';
    for (const issue of resultado.error.issues) {
      problemas.push(
        `  - registro ${i + 1} (${String(codigo)}) · ${issue.path.join('.')}: ${issue.message}`,
      );
    }
  });

  const codigos = entradas.map((entrada) => entrada.codigo);
  for (const repetido of new Set(codigos.filter((c, i) => codigos.indexOf(c) !== i))) {
    problemas.push(`  - el código «${repetido}» está repetido`);
  }
  if (problemas.length > 0) {
    throw new Error(`${ruta} tiene errores; no se cargó nada:\n${problemas.join('\n')}`);
  }
  return entradas;
}

/**
 * Sincroniza las fuentes con el archivo: crea las nuevas, actualiza las que cambian y
 * desactiva las que ya no figuran. Nunca borra: todo queda en la bitácora.
 * Debe ejecutarse dentro de una transacción (todo o nada).
 */
export async function cargarFuentes(
  db: Database,
  entradas: EntradaFuente[],
  observacion: string,
): Promise<ResumenCarga> {
  const repositorio = crearRepositorioFuentes(db);
  const resumen: ResumenCarga = { creadas: [], actualizadas: [], desactivadas: [], sinCambios: [] };
  const existentes = new Map((await repositorio.listar()).map((fuente) => [fuente.codigo, fuente]));

  for (const { codigo, ...fuente } of entradas) {
    const actual = existentes.get(codigo);
    if (!actual) {
      await repositorio.crear({ ...fuente, codigo }, { responsable: null, observacion });
      resumen.creadas.push(codigo);
      continue;
    }
    const antes = aCompleta(actual);
    const cambios = calcularCambios(antes, fuente);
    if (Object.keys(cambios).length === 0) {
      resumen.sinCambios.push(codigo);
      continue;
    }
    await repositorio.guardar(actual.id, fuente, {
      accion: accionParaCambio(antes, fuente),
      responsable: null,
      observacion,
      cambios,
      estadoEsperado: actual.estado,
    });
    resumen.actualizadas.push(codigo);
  }

  const enArchivo = new Set(entradas.map((entrada) => entrada.codigo));
  for (const [codigo, actual] of existentes) {
    if (enArchivo.has(codigo) || actual.estado === 'inactivo') continue;
    const antes = aCompleta(actual);
    const despues = { ...antes, estado: 'inactivo' as const };
    await repositorio.guardar(actual.id, despues, {
      accion: 'desactivar',
      responsable: null,
      observacion: 'No figura en el archivo de carga de fuentes.',
      cambios: calcularCambios(antes, despues),
      estadoEsperado: actual.estado,
    });
    resumen.desactivadas.push(codigo);
  }

  return resumen;
}
