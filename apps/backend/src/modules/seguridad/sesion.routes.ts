import { Router, type CookieOptions, type RequestHandler } from 'express';
import { z } from 'zod';
import { errores } from '../../http/errores.js';
import { validar } from '../../http/validacion.js';
import { NOMBRE_COOKIE_SESION } from './sesion.middleware.js';
import type { ServicioSesion } from './sesion.service.js';

type Opciones = {
  accesoDemo: boolean;
  duracionMs: number;
  cookieSegura: boolean;
};

const esquemaInicio = z.object({ codigo: z.string().regex(/^[A-Za-z]+_\d{3}$/) }).strict();

export function rutasSesion(servicio: ServicioSesion, opciones: Opciones): Router {
  const router = Router();
  const cookie: CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: opciones.cookieSegura,
    path: '/',
  };
  // El acceso por selector de usuarios sintéticos solo existe en modo demo.
  const soloDemo: RequestHandler = (_req, _res, next) =>
    next(opciones.accesoDemo ? undefined : errores.noEncontrado());

  router.get('/sesion', async (_req, res) => {
    const sesion = res.locals.sesion;
    res.set('Cache-Control', 'no-store').json({
      usuario: sesion ? await servicio.describir(sesion) : null,
    });
  });

  router.post('/sesion', soloDemo, async (req, res) => {
    const { codigo } = validar(esquemaInicio, req.body);
    const { token, sesion } = await servicio.iniciarDemo(codigo);
    res
      .cookie(NOMBRE_COOKIE_SESION, token, { ...cookie, maxAge: opciones.duracionMs })
      .status(201)
      .json({ usuario: await servicio.describir(sesion) });
  });

  router.delete('/sesion', (_req, res) => {
    res.clearCookie(NOMBRE_COOKIE_SESION, cookie).status(204).end();
  });

  router.get('/sesion/usuarios-demo', soloDemo, async (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ usuarios: await servicio.listarUsuariosDemo() });
  });

  return router;
}
