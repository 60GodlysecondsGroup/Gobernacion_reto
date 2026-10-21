import type { Database } from '../../db/database.js';

export type ConteoDatosDemo = {
  comunidades: number;
  usuarios: number;
  categorias: number;
  salas: number;
  fuentes: number;
};

export function crearRepositorioSistema(db: Database) {
  return {
    async verificarConexion(): Promise<void> {
      await db.query('select 1');
    },

    async contarDatosDemo(): Promise<ConteoDatosDemo> {
      const { rows } = await db.query<ConteoDatosDemo>(`
        select
          (select count(*) from app.comunidad)::int            as comunidades,
          (select count(*) from app.usuario)::int              as usuarios,
          (select count(*) from app.categoria)::int            as categorias,
          (select count(*) from app.sala)::int                 as salas,
          (select count(*) from app.fuente_institucional)::int as fuentes
      `);
      return rows[0]!;
    },
  };
}

export type RepositorioSistema = ReturnType<typeof crearRepositorioSistema>;
