import { Router } from 'express';
import { z } from 'zod';
import { ErrorApp } from '../../http/errores.js';
import { validar } from '../../http/validacion.js';
import { crearLimitador } from '../seguridad/limitador.js';
import { requerirPermiso } from '../seguridad/permisos.js';
import { exigirSesion } from '../seguridad/sesion.middleware.js';
import type { ClienteLugares } from './fuentes.lugares.js';
import type { ServicioFuentes } from './fuentes.service.js';

/** Token de sesión de búsqueda (agrupa sugerencias y detalle en una sola sesión de Google). */
const sesionBusqueda = z
  .string()
  .regex(/^[A-Za-z0-9_-]{8,64}$/, 'La sesión de búsqueda no es válida.')
  .optional()
  .transform((valor) => valor ?? null);

const esquemaSugerencias = z.object({
  texto: z
    .string()
    .trim()
    .min(3, 'Escribe al menos 3 caracteres para buscar.')
    .max(120, 'Usa como máximo 120 caracteres.'),
  sesion: sesionBusqueda,
});

const esquemaLugar = z.object({
  placeId: z.string().regex(/^[A-Za-z0-9_-]{10,300}$/, 'El identificador del lugar no es válido.'),
  sesion: sesionBusqueda,
});

/** Panel del gestor de fuentes: solo los roles con `gestionar_fuentes` (A.2). */
export function rutasFuentes(
  servicio: ServicioFuentes,
  lugares: ClienteLugares,
  { consultasLugaresPorMinuto = 60 }: { consultasLugaresPorMinuto?: number } = {},
): Router {
  const router = Router();
  router.use('/gestion/fuentes', requerirPermiso('gestionar_fuentes'));

  // ── Búsqueda de lugares (Google Places) para ubicar una fuente presencial ──────────────────
  // Van antes de `/gestion/fuentes/:id` para que «lugares» no se lea como un id. Cada cuenta
  // tiene un tope por minuto: protege la cuota y la facturación de la clave del servidor.
  const limitadorLugares = crearLimitador({
    maximo: consultasLugaresPorMinuto,
    ventanaMs: 60_000,
  });
  const contarConsulta = (idUsuario: string, res: { set(campo: string, valor: string): void }) => {
    const clave = `lugares:${idUsuario}`;
    const espera = limitadorLugares.bloqueadoPor(clave);
    if (espera > 0) {
      res.set('Retry-After', String(espera));
      throw new ErrorApp(
        429,
        'LIMITE_LUGARES',
        'Hiciste muchas búsquedas seguidas. Espera un minuto e intenta de nuevo.',
      );
    }
    limitadorLugares.registrar(clave);
  };

  router.get('/gestion/fuentes/lugares', (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ disponible: lugares.disponible });
  });

  router.get('/gestion/fuentes/lugares/sugerencias', async (req, res) => {
    const { texto, sesion } = validar(esquemaSugerencias, req.query);
    contarConsulta(exigirSesion(res).idUsuario, res);
    res.set('Cache-Control', 'no-store').json({
      sugerencias: await lugares.sugerencias(texto, sesion),
    });
  });

  router.get('/gestion/fuentes/lugares/:placeId', async (req, res) => {
    const { placeId, sesion } = validar(esquemaLugar, {
      placeId: req.params.placeId,
      sesion: req.query.sesion,
    });
    contarConsulta(exigirSesion(res).idUsuario, res);
    res.set('Cache-Control', 'no-store').json({ lugar: await lugares.lugar(placeId, sesion) });
  });

  router.get('/gestion/fuentes', async (req, res) => {
    res.set('Cache-Control', 'no-store').json(await servicio.listar(req.query));
  });

  router.post('/gestion/fuentes', async (req, res) => {
    res.status(201).json(await servicio.crear(exigirSesion(res), req.body));
  });

  router.get('/gestion/fuentes/:id', async (req, res) => {
    res.set('Cache-Control', 'no-store').json(await servicio.detalle(req.params.id));
  });

  router.put('/gestion/fuentes/:id', async (req, res) => {
    res.json(await servicio.editar(exigirSesion(res), req.params.id, req.body));
  });

  router.post('/gestion/fuentes/:id/revision', async (req, res) => {
    res.json(
      await servicio.cambiarEstado(exigirSesion(res), req.params.id, 'marcar_revision', req.body),
    );
  });

  router.post('/gestion/fuentes/:id/verificacion', async (req, res) => {
    res.json(await servicio.cambiarEstado(exigirSesion(res), req.params.id, 'verificar', req.body));
  });

  router.post('/gestion/fuentes/:id/desactivacion', async (req, res) => {
    res.json(
      await servicio.cambiarEstado(exigirSesion(res), req.params.id, 'desactivar', req.body),
    );
  });

  return router;
}
