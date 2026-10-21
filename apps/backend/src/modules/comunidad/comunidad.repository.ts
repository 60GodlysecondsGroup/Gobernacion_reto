import type { Database } from '../../db/database.js';
import type { CodigoRango } from '../seguridad/rango-edad.js';

export type Comunidad = {
  id: string;
  nombre: string;
  descripcion: string;
  rango: string;
};

export function crearRepositorioComunidades(db: Database) {
  return {
    /** La única consulta de comunidades: siempre filtrada por el rango de la sesión. */
    async porRango(rango: CodigoRango): Promise<Comunidad | null> {
      const { rows } = await db.query<Comunidad>(
        `select c.id_comunidad as id, c.nombre, c.descripcion, r.etiqueta as rango
         from app.comunidad c
         join app.rango_edad r on r.codigo = c.rango_edad
         where c.rango_edad = $1 and c.estado = 'activa'`,
        [rango],
      );
      return rows[0] ?? null;
    },
  };
}

export type RepositorioComunidades = ReturnType<typeof crearRepositorioComunidades>;
