import reglasSemilla from '../../../db/seed/reglas_dlp.json' with { type: 'json' };
import type { Database } from '../../db/database.js';
import type { Logger } from '../../lib/logger.js';
import {
  compilarPatron,
  type AccionDlp,
  type CategoriaDlp,
  type ReglaCompilada,
  type TipoContenido,
} from './dlp.analizador.js';

/** Evento técnico de B.5. No lleva el texto: solo quién, dónde, qué categoría, regla y resultado. */
export type EventoDlp = {
  idUsuario: string | null;
  tipoContenido: TipoContenido;
  categoria: CategoriaDlp;
  idRegla: string | null;
  accion: AccionDlp;
  resultado: 'bloqueado' | 'advertido' | 'registrado';
};

type FilaRegla = {
  id: string | null;
  codigo: string;
  categoria: CategoriaDlp;
  accion: AccionDlp;
  patron: string;
};

/**
 * Reglas predeterminadas del proyecto: la misma lista que cargan el seed y las migraciones
 * (`db/seed/reglas_dlp.json`). Se importa con el código para que viaje con cada despliegue.
 */
const SEMILLA = reglasSemilla as {
  codigo: string;
  categoria: CategoriaDlp;
  patron: string;
  accion?: AccionDlp;
}[];

export function crearRepositorioDlp(db: Database, logger: Logger) {
  let ultimoAviso = '';

  return {
    /**
     * Reglas activas compiladas. Una regla mal escrita se omite y se avisa, sin tumbar el DLP.
     *
     * Las migraciones no corren al desplegar (`npm run db:migrate`): en una base sin migrar
     * faltarían reglas y el texto se publicaría sin revisarlas. Por eso las reglas del seed que
     * NO existen en la base se aplican igual (sin id) y se avisa en el registro. Las que existen
     * mandan con su estado: una regla desactivada desde el panel (F31) sigue desactivada.
     */
    async reglasActivas(): Promise<ReglaCompilada[]> {
      const { rows } = await db.query<FilaRegla & { activa: boolean }>(`
        select id_regla as id, codigo, categoria, accion, patron, estado = 'activa' as activa
        from app.regla_dlp
        order by codigo`);
      const enBase = new Set(rows.map((fila) => fila.codigo));
      const faltantes = SEMILLA.filter((regla) => !enBase.has(regla.codigo));

      const aviso = faltantes.map((regla) => regla.codigo).join(', ');
      if (aviso && aviso !== ultimoAviso) {
        logger.warn('Faltan reglas DLP en la base; se usan las del seed (npm run db:migrate)', {
          reglas: aviso,
        });
      }
      ultimoAviso = aviso;

      const filas: FilaRegla[] = [
        ...rows.filter((fila) => fila.activa),
        ...faltantes.map(({ codigo, categoria, patron, accion }) => ({
          id: null,
          codigo,
          categoria,
          accion: accion ?? 'bloquear',
          patron,
        })),
      ];
      return filas.flatMap((fila) => {
        try {
          return [{ ...fila, patron: compilarPatron(fila.patron) }];
        } catch {
          logger.error('Regla DLP con patrón inválido; se omite', { codigo: fila.codigo });
          return [];
        }
      });
    },

    async registrarEvento(evento: EventoDlp): Promise<void> {
      await db.query(
        `insert into app.evento_dlp (id_usuario, tipo_contenido, categoria, id_regla, accion, resultado)
         values ($1, $2, $3, $4, $5, $6)`,
        [
          evento.idUsuario,
          evento.tipoContenido,
          evento.categoria,
          evento.idRegla,
          evento.accion,
          evento.resultado,
        ],
      );
    },
  };
}

export type RepositorioDlp = ReturnType<typeof crearRepositorioDlp>;
