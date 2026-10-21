import type { Sesion } from '../modules/seguridad/sesion.service.js';

declare global {
  namespace Express {
    interface Locals {
      /** Sesión autenticada de la solicitud; la carga `cargarSesion`. */
      sesion?: Sesion;
      idSolicitud?: string;
    }
  }
}

export {};
