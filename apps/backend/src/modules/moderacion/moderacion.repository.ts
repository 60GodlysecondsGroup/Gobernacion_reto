import type { Database } from '../../db/database.js';

export type ResumenCategoria = { categoria: string; nombre: string; total: number };

export type IncidenciaDlp = {
  fecha: string;
  categoria: string;
  nombreCategoria: string;
  tipoContenido: string;
  regla: string | null;
  accion: string;
  resultado: string;
};

export function crearRepositorioModeracion(db: Database) {
  return {
    /**
     * Incidencias DLP (F35) agregadas por categoría y las más recientes. Por minimización
     * no se incluye quién escribió ni, por diseño, el texto: nunca se guardó.
     */
    async incidenciasDlp(dias: number) {
      const [resumen, recientes] = await Promise.all([
        db.query<ResumenCategoria>(
          `select c.codigo as categoria, c.nombre, count(e.id_evento)::int as total
           from app.categoria_dlp c
           left join app.evento_dlp e
             on e.categoria = c.codigo and e.fecha >= now() - make_interval(days => $1)
           group by c.codigo, c.nombre, c.orden
           order by c.orden`,
          [dias],
        ),
        db.query<IncidenciaDlp>(
          `select e.fecha, e.categoria, c.nombre as "nombreCategoria",
                  e.tipo_contenido as "tipoContenido", r.codigo as regla, e.accion, e.resultado
           from app.evento_dlp e
           join app.categoria_dlp c on c.codigo = e.categoria
           left join app.regla_dlp r on r.id_regla = e.id_regla
           where e.fecha >= now() - make_interval(days => $1)
           order by e.fecha desc
           limit 50`,
          [dias],
        ),
      ]);
      return { dias, resumen: resumen.rows, recientes: recientes.rows };
    },
  };
}

export type RepositorioModeracion = ReturnType<typeof crearRepositorioModeracion>;
