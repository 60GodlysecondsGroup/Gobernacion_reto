import type { Database } from '../../db/database.js';
import type { CodigoRango } from '../seguridad/rango-edad.js';

export type TipoReportable = 'hilo' | 'respuesta' | 'perfil';

export type NuevoReporte = {
  idUsuario: string;
  idComunidad: string;
  tipoContenido: TipoReportable;
  idContenido: string;
  categoria: string;
  descripcion: string | null;
};

type Ambito = { idContenido: string; idComunidad: string; rango: CodigoRango };

/** Consulta (y sus parámetros) que confirma que el contenido está visible en la comunidad propia. */
const CONTENIDO_EN_COMUNIDAD: Record<TipoReportable, (a: Ambito) => [string, unknown[]]> = {
  hilo: ({ idContenido, idComunidad }) => [
    `select 1 from app.hilo
     where id_hilo = $1 and id_comunidad = $2 and estado <> 'oculto'`,
    [idContenido, idComunidad],
  ],
  respuesta: ({ idContenido, idComunidad }) => [
    `select 1 from app.respuesta r
     join app.hilo h on h.id_hilo = r.id_hilo
     where r.id_respuesta = $1 and h.id_comunidad = $2
       and r.estado = 'publicada' and h.estado <> 'oculto'`,
    [idContenido, idComunidad],
  ],
  perfil: ({ idContenido, rango }) => [
    `select 1 from app.usuario
     where id_usuario = $1 and rango_edad = $2 and rol = 'usuario' and estado = 'activo'`,
    [idContenido, rango],
  ],
};

export function crearRepositorioReportes(db: Database) {
  return {
    async contenidoEnComunidad(
      tipo: TipoReportable,
      idContenido: string,
      idComunidad: string,
      rango: CodigoRango,
    ): Promise<boolean> {
      const [sql, parametros] = CONTENIDO_EN_COMUNIDAD[tipo]({ idContenido, idComunidad, rango });
      const { rows } = await db.query(sql, parametros);
      return rows.length > 0;
    },

    /** Registra el reporte. Uno repetido mientras el anterior sigue abierto no crea otra fila. */
    async registrar(reporte: NuevoReporte): Promise<void> {
      await db.query(
        `insert into app.reporte
           (id_usuario_reportante, id_comunidad, tipo_contenido, id_contenido, categoria, descripcion)
         values ($1, $2, $3, $4, $5, $6)
         on conflict do nothing`,
        [
          reporte.idUsuario,
          reporte.idComunidad,
          reporte.tipoContenido,
          reporte.idContenido,
          reporte.categoria,
          reporte.descripcion,
        ],
      );
    },
  };
}

export type RepositorioReportes = ReturnType<typeof crearRepositorioReportes>;
