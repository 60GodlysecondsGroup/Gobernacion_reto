import type { Database } from '../../db/database.js';

export const CAPAS = ['personaje', 'cabello', 'rasgos', 'prenda', 'accesorio'] as const;
export type Capa = (typeof CAPAS)[number];

/** Tipo de ELEMENTO_AVATAR que admite cada capa de la configuración. */
export const TIPO_DE_CAPA = {
  personaje: 'personaje',
  cabello: 'cabello',
  rasgos: 'rasgo',
  prenda: 'prenda',
  accesorio: 'accesorio',
} as const satisfies Record<Capa, string>;

export type TipoElemento = (typeof TIPO_DE_CAPA)[Capa];

export type ElementoAvatar = { id: string; tipo: TipoElemento; nombre: string; recurso: string };

/** Lo que elige la persona: identificadores del catálogo (CONFIGURACION_AVATAR). */
export type ConfiguracionAvatar = {
  personaje: string;
  cabello: string | null;
  rasgos: string | null;
  prenda: string | null;
  accesorio: string | null;
};

/**
 * Lo que se dibuja: la clave del recurso gráfico de cada capa. Es lo único del avatar que viaja
 * junto al alias en perfiles, hilos, respuestas y salas (F37).
 */
export type Apariencia = ConfiguracionAvatar;

/**
 * Expresión SQL con la apariencia del usuario cuya columna se indica (o null si no tiene).
 * Es la única definición: perfiles, hilos y salas la usan para mostrar el mismo avatar.
 */
export const sqlApariencia = (columnaUsuario: string) => `(
  select json_build_object(
    'personaje', p.recurso_grafico, 'cabello', c.recurso_grafico, 'rasgos', r.recurso_grafico,
    'prenda', pr.recurso_grafico, 'accesorio', a.recurso_grafico)
  from app.configuracion_avatar ca
  join app.elemento_avatar p on p.id_elemento = ca.id_personaje
  left join app.elemento_avatar c on c.id_elemento = ca.id_cabello
  left join app.elemento_avatar r on r.id_elemento = ca.id_rasgos
  left join app.elemento_avatar pr on pr.id_elemento = ca.id_prenda
  left join app.elemento_avatar a on a.id_elemento = ca.id_accesorio
  where ca.id_usuario = ${columnaUsuario})`;

export function crearRepositorioAvatar(db: Database) {
  return {
    /** Catálogo activo, en el orden en que se muestra (F36). */
    async catalogo(): Promise<ElementoAvatar[]> {
      const { rows } = await db.query<ElementoAvatar>(
        `select id_elemento as id, tipo, nombre, recurso_grafico as recurso
         from app.elemento_avatar
         where estado = 'activo'
         order by array_position(array['personaje', 'cabello', 'rasgo', 'prenda', 'accesorio'], tipo),
                  orden, id_elemento`,
      );
      return rows;
    },

    async configuracion(idUsuario: string): Promise<ConfiguracionAvatar | null> {
      const { rows } = await db.query<ConfiguracionAvatar>(
        `select id_personaje as personaje, id_cabello as cabello, id_rasgos as rasgos,
                id_prenda as prenda, id_accesorio as accesorio
         from app.configuracion_avatar where id_usuario = $1`,
        [idUsuario],
      );
      return rows[0] ?? null;
    },

    async apariencia(idUsuario: string): Promise<Apariencia | null> {
      const { rows } = await db.query<{ apariencia: Apariencia | null }>(
        `select ${sqlApariencia('$1::uuid')} as apariencia`,
        [idUsuario],
      );
      return rows[0]?.apariencia ?? null;
    },

    /** Guarda la configuración de la propia persona: el id sale siempre de la sesión. */
    async guardar(idUsuario: string, c: ConfiguracionAvatar): Promise<void> {
      await db.query(
        `insert into app.configuracion_avatar
           (id_usuario, id_personaje, id_cabello, id_rasgos, id_prenda, id_accesorio)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (id_usuario) do update set
           id_personaje = excluded.id_personaje, id_cabello = excluded.id_cabello,
           id_rasgos = excluded.id_rasgos, id_prenda = excluded.id_prenda,
           id_accesorio = excluded.id_accesorio`,
        [idUsuario, c.personaje, c.cabello, c.rasgos, c.prenda, c.accesorio],
      );
    },
  };
}

export type RepositorioAvatar = ReturnType<typeof crearRepositorioAvatar>;
