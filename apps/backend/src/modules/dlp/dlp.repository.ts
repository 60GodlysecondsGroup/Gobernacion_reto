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
  id: string;
  codigo: string;
  categoria: CategoriaDlp;
  accion: AccionDlp;
  patron: string;
};

export function crearRepositorioDlp(db: Database, logger: Logger) {
  return {
    /** Reglas activas compiladas. Una regla mal escrita se omite y se avisa, sin tumbar el DLP. */
    async reglasActivas(): Promise<ReglaCompilada[]> {
      const { rows } = await db.query<FilaRegla>(`
        select id_regla as id, codigo, categoria, accion, patron
        from app.regla_dlp
        where estado = 'activa'
        order by codigo`);
      return rows.flatMap((fila) => {
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
