import { Router } from 'express';
import { validar } from '../../http/validacion.js';
import { z } from 'zod';
import type { RepositorioAuditoria } from '../auditoria/auditoria.js';
import { exigirPermiso, type Rol } from '../seguridad/permisos.js';
import type { ServicioAdministracion } from './administracion.service.js';

const REGISTROS_POR_PAGINA = 25;

/**
 * Qué parte del registro de acciones consulta cada rol («Consultar registros administrativos»,
 * matriz A.2). La moderación ve lo que ella misma gestiona; la administración, todo. El gestor de
 * fuentes ya tiene la bitácora de fuentes (F33) en su propio panel.
 */
const ENTIDADES_VISIBLES: Partial<Record<Rol, readonly string[]>> = {
  moderador: ['reporte', 'hilo', 'respuesta', 'usuario'],
  admin_plataforma: [
    'reporte',
    'hilo',
    'respuesta',
    'usuario',
    'sala',
    'escenario',
    'categoria',
    'comunidad',
    'regla_dlp',
  ],
};

const esquemaAuditoria = z.object({
  entidad: z
    .string()
    .regex(/^[a-z_]{3,30}$/)
    .optional(),
  pagina: z.coerce.number().int().min(1).max(500).default(1),
});

/** Panel administrativo simplificado (Fase 7). Cada ruta exige su permiso de la matriz A.2. */
export function rutasAdministracion(
  servicio: ServicioAdministracion,
  auditoria: RepositorioAuditoria,
): Router {
  const router = Router();
  const sinCache = { 'Cache-Control': 'no-store' };

  router.get('/admin/resumen', async (_req, res) => {
    exigirPermiso(res, 'revisar_reportes');
    res.set(sinCache).json(await servicio.resumen());
  });

  // ── Usuarios (F26) ──
  router.get('/admin/usuarios', async (req, res) => {
    exigirPermiso(res, 'gestionar_usuarios');
    res.set(sinCache).json(await servicio.listarUsuarios(req.query));
  });
  router.patch('/admin/usuarios/:id', async (req, res) => {
    const sesion = exigirPermiso(res, 'gestionar_usuarios');
    res.json(await servicio.actualizarUsuario(sesion, req.params.id, req.body));
  });

  // ── Comunidades (F27) y categorías (F28) ──
  router.get('/admin/comunidades', async (_req, res) => {
    exigirPermiso(res, 'configurar_comunidades');
    res.set(sinCache).json({ comunidades: await servicio.listarComunidades() });
  });
  router.patch('/admin/comunidades/:id', async (req, res) => {
    const sesion = exigirPermiso(res, 'configurar_comunidades');
    res.json(await servicio.actualizarComunidad(sesion, req.params.id, req.body));
  });
  router.get('/admin/categorias', async (_req, res) => {
    exigirPermiso(res, 'configurar_comunidades');
    res.set(sinCache).json({ categorias: await servicio.listarCategorias() });
  });
  router.post('/admin/categorias', async (req, res) => {
    const sesion = exigirPermiso(res, 'configurar_comunidades');
    res.status(201).json(await servicio.crearCategoria(sesion, req.body));
  });
  router.patch('/admin/categorias/:id', async (req, res) => {
    const sesion = exigirPermiso(res, 'configurar_comunidades');
    res.json(await servicio.actualizarCategoria(sesion, req.params.id, req.body));
  });

  // ── Salas (F29) ──
  router.get('/admin/salas', async (req, res) => {
    exigirPermiso(res, 'configurar_comunidades');
    res.set(sinCache).json({ salas: await servicio.listarSalas(req.query) });
  });
  router.post('/admin/salas', async (req, res) => {
    const sesion = exigirPermiso(res, 'crear_sala_tematica');
    res.status(201).json({ sala: await servicio.crearSala(sesion, req.body) });
  });
  router.patch('/admin/salas/:id', async (req, res) => {
    const sesion = exigirPermiso(res, 'configurar_comunidades');
    res.json({ sala: await servicio.actualizarSala(sesion, req.params.id, req.body) });
  });
  router.put('/admin/salas/:id/escenario', async (req, res) => {
    const sesion = exigirPermiso(res, 'configurar_comunidades');
    res.json({ sala: await servicio.actualizarEscenario(sesion, req.params.id, req.body) });
  });

  // ── Reglas DLP (F31): la moderación consulta, solo la administración cambia ──
  router.get('/admin/reglas-dlp', async (_req, res) => {
    exigirPermiso(res, 'consultar_reglas_dlp');
    res.set(sinCache).json({ categorias: await servicio.listarReglasDlp() });
  });
  router.patch('/admin/reglas-dlp/categorias/:codigo', async (req, res) => {
    const sesion = exigirPermiso(res, 'gestionar_reglas_dlp');
    res.json(await servicio.cambiarEstadoCategoriaDlp(sesion, req.params.codigo, req.body));
  });
  router.patch('/admin/reglas-dlp/:id', async (req, res) => {
    const sesion = exigirPermiso(res, 'gestionar_reglas_dlp');
    res.json(await servicio.cambiarEstadoRegla(sesion, req.params.id, req.body));
  });

  // ── Registro de acciones administrativas (punto 7 de la Fase 7) ──
  router.get('/admin/auditoria', async (req, res) => {
    const sesion = exigirPermiso(res, 'consultar_registros_administrativos');
    const { entidad, pagina } = validar(esquemaAuditoria, req.query);
    const entidades = ENTIDADES_VISIBLES[sesion.rol] ?? [];
    const filas = await auditoria.listar({
      entidades,
      entidad,
      limite: REGISTROS_POR_PAGINA + 1,
      desplazamiento: (pagina - 1) * REGISTROS_POR_PAGINA,
    });
    res.set(sinCache).json({
      registros: filas.slice(0, REGISTROS_POR_PAGINA),
      pagina,
      hayMas: filas.length > REGISTROS_POR_PAGINA,
    });
  });

  return router;
}
