import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Logger } from '../../lib/logger.js';
import { leerCookie, NOMBRE_COOKIE_SESION } from '../seguridad/sesion.middleware.js';
import type { ServicioSesion } from '../seguridad/sesion.service.js';
import type { Conexion, GestorSalas } from './salas.gestor.js';

type Dependencias = {
  gestor: GestorSalas;
  sesiones: ServicioSesion;
  origenesPermitidos: string[];
  logger: Logger;
  /** Cada cuánto se comprueba que la conexión sigue viva. */
  latidoMs?: number;
};

const RUTA = /^\/ws\/salas\/([^/?#]+)(?:[?#].*)?$/;

function rechazarHandshake(socket: Duplex, estado: string) {
  socket.write(`HTTP/1.1 ${estado}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

/**
 * WebSocket de salas en `/ws/salas/:id`, sobre el mismo servidor HTTP del backend.
 * Se autentica con la cookie de sesión y rechaza orígenes ajenos (secuestro de WebSocket).
 */
export function crearTiempoRealSalas({
  gestor,
  sesiones,
  origenesPermitidos,
  logger,
  latidoMs = 15_000,
}: Dependencias) {
  const servidor = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 });
  const vivas = new WeakMap<WebSocket, boolean>();
  let latido: NodeJS.Timeout | null = null;

  // Una conexión que no responde al ping se da por perdida: la persona sale de la sala.
  function iniciarLatido() {
    if (latido) return;
    latido = setInterval(() => {
      for (const ws of servidor.clients) {
        if (vivas.get(ws) === false) {
          ws.terminate();
          continue;
        }
        vivas.set(ws, false);
        ws.ping();
      }
    }, latidoMs);
    latido.unref();
  }

  function atender(
    ws: WebSocket,
    sesion: Awaited<ReturnType<ServicioSesion['resolver']>>,
    idSala: string,
  ) {
    iniciarLatido();
    vivas.set(ws, true);
    ws.on('pong', () => vivas.set(ws, true));

    const conexion: Conexion = {
      enviar: (mensaje) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(mensaje));
      },
      cerrar: (codigo, motivo) => ws.close(codigo, motivo),
      get abierta() {
        return ws.readyState === ws.OPEN;
      },
    };

    // Los mensajes que lleguen mientras se completa la entrada esperan a que termine.
    const entrada = gestor.conectar(conexion, sesion, idSala);
    ws.on('message', (datos) => {
      void entrada.then((idUsuario) => {
        if (idUsuario) return gestor.recibir(idSala, idUsuario, conexion, datos.toString());
      });
    });
    ws.on('close', () => {
      void entrada.then((idUsuario) => {
        if (idUsuario) return gestor.desconectar(idSala, idUsuario, conexion);
      });
    });
    ws.on('error', (error) =>
      logger.warn('Error en un WebSocket de sala', { error: error.message }),
    );
  }

  return {
    manejarUpgrade(req: IncomingMessage, socket: Duplex, cabecera: Buffer) {
      const ruta = RUTA.exec(req.url ?? '');
      if (!ruta) return rechazarHandshake(socket, '404 Not Found');

      const origen = req.headers.origin;
      if (origen && !origenesPermitidos.includes(origen)) {
        return rechazarHandshake(socket, '403 Forbidden');
      }

      const idSala = decodeURIComponent(ruta[1]!);
      const token = leerCookie(req.headers.cookie, NOMBRE_COOKIE_SESION);
      (token ? sesiones.resolver(token) : Promise.resolve(null))
        .then((sesion) => {
          servidor.handleUpgrade(req, socket, cabecera, (ws) => atender(ws, sesion, idSala));
        })
        .catch((error: unknown) => {
          logger.error('No se pudo abrir el WebSocket de sala', { error: String(error) });
          rechazarHandshake(socket, '500 Internal Server Error');
        });
    },

    cerrar() {
      if (latido) clearInterval(latido);
      for (const ws of servidor.clients) ws.terminate();
      servidor.close();
    },
  };
}

export type TiempoRealSalas = ReturnType<typeof crearTiempoRealSalas>;
