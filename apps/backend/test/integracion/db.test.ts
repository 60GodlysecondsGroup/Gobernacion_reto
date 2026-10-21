/**
 * Pruebas de integración contra la base real del .env (npm run test:db).
 * Solo leen datos; lo que escriben se hace dentro de transacciones que se revierten.
 * Requieren haber ejecutado antes `npm run db:reset`.
 */
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cargarConfig } from '../../src/config/env.js';
import { crearPool, type PoolDeDatos } from '../../src/db/database.js';

let pool: PoolDeDatos;

beforeAll(() => {
  pool = crearPool(cargarConfig().baseDeDatos);
});

afterAll(async () => {
  await pool.end();
});

/** Ejecuta `prueba` en una transacción que siempre se revierte. */
async function enTransaccionRevertida(prueba: (cliente: pg.PoolClient) => Promise<void>) {
  const cliente = await pool.connect();
  try {
    await cliente.query('begin');
    await prueba(cliente);
  } finally {
    await cliente.query('rollback');
    cliente.release();
  }
}

const SQL_HILO = `
  insert into app.hilo (id_usuario, id_comunidad, id_categoria, titulo, contenido)
  select u.id_usuario, c.id_comunidad, cat.id_categoria, 'Hilo de prueba', 'Contenido ficticio'
  from app.usuario u, app.comunidad c, app.categoria cat
  where u.codigo = 'Usuario_001' and c.rango_edad = $1 and cat.codigo = 'bienestar-cotidiano'`;

describe('Esquema y datos sintéticos', () => {
  it('tiene aplicada la migración inicial', async () => {
    const { rows } = await pool.query('select nombre from app.migraciones order by nombre');
    expect(rows.map((fila) => fila.nombre)).toContain('0001_esquema_inicial.sql');
  });

  it('tiene una comunidad por cada rango de edad', async () => {
    const { rows } = await pool.query('select rango_edad from app.comunidad order by rango_edad');
    expect(rows.map((fila) => fila.rango_edad)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('carga Usuario_001 (LunaDemo) en la comunidad 13–15, sin edad exacta', async () => {
    const { rows } = await pool.query(`
      select u.alias, c.nombre as comunidad, r.etiqueta as rango
      from app.usuario u
      join app.comunidad c on c.rango_edad = u.rango_edad
      join app.rango_edad r on r.codigo = u.rango_edad
      where u.codigo = 'Usuario_001'`);
    expect(rows).toEqual([{ alias: 'LunaDemo', comunidad: 'Comunidad B', rango: '13–15 años' }]);

    const columnas = await pool.query(`
      select column_name from information_schema.columns
      where table_schema = 'app' and table_name = 'usuario'`);
    const nombres = columnas.rows.map((fila) => fila.column_name);
    expect(nombres).not.toContain('edad');
    expect(nombres).not.toContain('fecha_nacimiento');
  });

  it('carga la sala «Bienestar cotidiano» de la comunidad B con capacidad 10', async () => {
    const { rows } = await pool.query(`
      select s.capacidad_maxima, s.estado, c.rango_edad
      from app.sala s join app.comunidad c on c.id_comunidad = s.id_comunidad
      where s.nombre = 'Bienestar cotidiano'`);
    expect(rows).toEqual([{ capacidad_maxima: 10, estado: 'disponible', rango_edad: 'B' }]);
  });

  it('carga InstituciónDemo · CanalDemo marcada como demostración y con su bitácora', async () => {
    const { rows } = await pool.query(`
      select f.es_demo, f.estado, f.fecha_verificacion is not null as verificada,
             (select count(*)::int from app.bitacora_fuente b where b.id_fuente = f.id_fuente) as cambios
      from app.fuente_institucional f
      where f.institucion = 'InstituciónDemo' and f.nombre_servicio = 'CanalDemo'`);
    expect(rows).toEqual([{ es_demo: true, estado: 'activo', verificada: true, cambios: 1 }]);
  });
});

describe('Reglas de seguridad reforzadas en la base', () => {
  it('rechaza un hilo de un usuario del rango B en la comunidad C', async () => {
    await enTransaccionRevertida(async (cliente) => {
      await expect(cliente.query(SQL_HILO, ['C'])).rejects.toMatchObject({ code: '42501' });
    });
  });

  it('acepta el mismo hilo en la comunidad propia', async () => {
    await enTransaccionRevertida(async (cliente) => {
      const resultado = await cliente.query(SQL_HILO, ['B']);
      expect(resultado.rowCount).toBe(1);
    });
  });

  it('impide que una sala supere 10 participantes', async () => {
    await enTransaccionRevertida(async (cliente) => {
      await expect(
        cliente.query(
          `update app.sala set usuarios_actuales = 11 where nombre = 'Bienestar cotidiano'`,
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('impide modificar la bitácora de fuentes', async () => {
    await enTransaccionRevertida(async (cliente) => {
      await expect(
        cliente.query(`update app.bitacora_fuente set observacion = 'x'`),
      ).rejects.toMatchObject({
        code: '42501',
      });
    });
  });

  it('no da acceso al esquema a los roles públicos de Supabase', async () => {
    const { rows } = await pool.query(
      `select exists (select 1 from pg_roles where rolname = 'anon') as hay`,
    );
    if (!rows[0].hay) return; // PostgreSQL local sin Supabase

    const privilegios = await pool.query(`
      select has_schema_privilege('anon', 'app', 'USAGE') as anon,
             has_schema_privilege('authenticated', 'app', 'USAGE') as autenticado`);
    expect(privilegios.rows[0]).toEqual({ anon: false, autenticado: false });
  });
});
