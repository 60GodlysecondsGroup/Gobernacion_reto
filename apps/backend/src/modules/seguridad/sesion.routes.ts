import { Router, type CookieOptions, type Request, type Response } from 'express';
import { leerCookie, NOMBRE_COOKIE_SESION } from './sesion.middleware.js';
import type { ServicioSesion, SesionAbierta } from './sesion.service.js';

type Opciones = {
  cookieSegura: boolean;
  cookieSameSite?: 'lax' | 'none' | 'strict';
};

/**
 * «Iniciar con mi Avatar»: registro, inicio y cierre de sesión. El token viaja solo en la cookie
 * HttpOnly (el JavaScript del navegador no puede leerlo) y nunca en el cuerpo de la respuesta.
 */
export function rutasSesion(servicio: ServicioSesion, opciones: Opciones): Router {
  const router = Router();
  const sameSite = opciones.cookieSameSite ?? 'lax';
  const cookie: CookieOptions = {
    httpOnly: true,
    sameSite,
    secure: sameSite === 'none' ? true : opciones.cookieSegura,
    path: '/',
  };

  /** Cierra la sesión que la solicitud traiga, para no dejarla abierta al entrar con otra. */
  async function cerrarAnterior(req: Request) {
    const anterior = leerCookie(req.headers.cookie, NOMBRE_COOKIE_SESION);
    if (anterior) await servicio.cerrar(anterior);
  }

  async function responderConSesion(res: Response, abierta: SesionAbierta) {
    // Sin «Recordarme» la cookie es de sesión del navegador; el servidor la vence igual a las 8 h.
    res
      .cookie(NOMBRE_COOKIE_SESION, abierta.token, {
        ...cookie,
        ...(abierta.persistente && { maxAge: abierta.duracionMs }),
      })
      .set('Cache-Control', 'no-store')
      .status(201)
      .json({ usuario: await servicio.describir(abierta.sesion) });
  }

  router.get('/sesion', async (_req, res) => {
    const sesion = res.locals.sesion;
    res.set('Cache-Control', 'no-store').json({
      usuario: sesion ? await servicio.describir(sesion) : null,
    });
  });

  router.post('/sesion', async (req, res) => {
    const abierta = await servicio.iniciar(req.body, req.ip ?? 'desconocida');
    await cerrarAnterior(req);
    await responderConSesion(res, abierta);
  });

  // Rangos de edad y catálogo de avatar: públicos, los necesita el formulario antes de la cuenta.
  router.get('/sesion/registro', async (_req, res) => {
    res.json(await servicio.opcionesRegistro());
  });

  router.post('/sesion/registro', async (req, res) => {
    const abierta = await servicio.registrar(req.body, req.ip ?? 'desconocida');
    await cerrarAnterior(req);
    await responderConSesion(res, abierta);
  });

  router.delete('/sesion', async (req, res) => {
    await cerrarAnterior(req);
    res
      .clearCookie(NOMBRE_COOKIE_SESION, cookie)
      .set('Cache-Control', 'no-store')
      .status(204)
      .end();
  });

  return router;
}
