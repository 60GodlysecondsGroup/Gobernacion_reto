import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { Database } from '../../db/database.js';
import { ErrorApp, errores } from '../../http/errores.js';
import { validar } from '../../http/validacion.js';
import type { ServicioAvatar } from '../avatar/avatar.service.js';
import type { RepositorioComunidades } from '../comunidad/comunidad.repository.js';
import type { ServicioDlp } from '../dlp/dlp.service.js';
import { esquemaAlias, esquemaIntereses, sinRepetidos } from '../perfil/perfil.service.js';
import {
  hashDeRelleno,
  hashearContrasena,
  LARGO_MAXIMO_CONTRASENA,
  problemaDeContrasena,
  verificarContrasena,
} from './contrasena.js';
import { crearLimitador } from './limitador.js';
import { permisosDe, type Permiso, type Rol } from './permisos.js';
import { CODIGOS_RANGO, type CodigoRango, type ProveedorRangoEdad } from './rango-edad.js';
import { crearRepositorioSesiones, type RepositorioSesiones } from './sesiones.repository.js';
import { crearToken, verificarToken } from './sesion.token.js';
import type { RepositorioUsuarios, UsuarioRegistrado } from './usuarios.repository.js';

/** Identidad autenticada de una solicitud. La comunidad se deriva SIEMPRE de `rango`. */
export type Sesion = {
  idUsuario: string;
  alias: string;
  rol: Rol;
  rango: CodigoRango | null;
};

/** Lo que el frontend recibe de su propia sesión. Nunca incluye edad exacta. */
export type SesionPublica = {
  id: string;
  alias: string;
  rol: Rol;
  comunidad: { id: string; nombre: string } | null;
  permisos: Permiso[];
};

/** Sesión recién abierta: el token va solo en la cookie HttpOnly, nunca en el cuerpo. */
export type SesionAbierta = {
  token: string;
  sesion: Sesion;
  /** true con «Recordarme»: la cookie sobrevive al cierre del navegador. */
  persistente: boolean;
  duracionMs: number;
};

const contrasena = z
  .string({ error: 'Escribe tu contraseña.' })
  .min(1, 'Escribe tu contraseña.')
  .max(LARGO_MAXIMO_CONTRASENA, `Usa máximo ${LARGO_MAXIMO_CONTRASENA} caracteres.`);

const esquemaInicio = z
  .object({
    alias: z.string({ error: 'Escribe tu nametag.' }).trim().min(1, 'Escribe tu nametag.').max(60),
    contrasena,
    recordar: z.boolean().default(false),
  })
  .strict();

/** Correo de una cuenta de personal: se guarda y se busca sin espacios y en minúsculas. */
export const esquemaCorreo = z
  .string({ error: 'Escribe el correo.' })
  .trim()
  .toLowerCase()
  .min(1, 'Escribe el correo.')
  .max(254, 'Usa máximo 254 caracteres.')
  .pipe(z.email({ error: 'Escribe un correo válido (nombre@dominio.co).' }));

/** Acceso del personal: correo y contraseña. Sin avatar ni nametag. */
const esquemaInicioPersonal = z
  .object({
    correo: z
      .string({ error: 'Escribe tu correo.' })
      .trim()
      .toLowerCase()
      .min(1, 'Escribe tu correo.')
      .max(254),
    contrasena,
    recordar: z.boolean().default(false),
  })
  .strict();

/**
 * Registro: nametag, contraseña, rango de edad, hobbies y avatar. `.strict()` rechaza cualquier
 * otro campo, en particular `rol`, `estado` o `codigo`: la cuenta siempre nace como joven activo.
 */
const esquemaRegistro = z
  .object({
    alias: esquemaAlias,
    contrasena,
    rango: z.enum(CODIGOS_RANGO, { error: 'Elige tu rango de edad.' }),
    intereses: esquemaIntereses,
    // Aquí solo se exige que venga; la validación completa la hace el módulo de avatar.
    avatar: z.record(z.string(), z.unknown(), { error: 'Elige tu avatar.' }),
    recordar: z.boolean().default(false),
  })
  .strict();

const credencialesInvalidas = (identificador = 'El nametag') =>
  new ErrorApp(401, 'CREDENCIALES_INVALIDAS', `${identificador} o la contraseña no son correctos.`);

const demasiadosIntentos = (segundos: number) =>
  new ErrorApp(
    429,
    'DEMASIADOS_INTENTOS',
    `Hiciste demasiados intentos. Espera ${Math.ceil(segundos / 60)} min y vuelve a intentarlo.`,
    { reintentarEnSegundos: segundos },
  );

export type LimitesAcceso = {
  /** Intentos fallidos por IP + nametag antes de bloquear ese par. */
  fallosPorCuenta: number;
  /** Intentos fallidos por IP, sumando todos los nametags. */
  fallosPorIp: number;
  /** Registros (exitosos o no) por IP. */
  registrosPorIp: number;
  /** Consultas de disponibilidad de nametag por IP (paso 1 del registro). */
  consultasAliasPorIp?: number;
  ventanaMs: number;
};

export const LIMITES_ACCESO: LimitesAcceso = {
  fallosPorCuenta: 5,
  fallosPorIp: 30,
  registrosPorIp: 10,
  consultasAliasPorIp: 60,
  ventanaMs: 15 * 60 * 1000,
};

const aliasEnUso = () =>
  new ErrorApp(409, 'ALIAS_EN_USO', 'Ese nametag ya está en uso. Prueba con otro.', {
    campo: 'alias',
  });

type Dependencias = {
  usuarios: RepositorioUsuarios;
  sesiones: RepositorioSesiones;
  comunidades: RepositorioComunidades;
  avatar: Pick<ServicioAvatar, 'validarConfiguracion' | 'catalogo'>;
  dlp: Pick<ServicioDlp, 'exigirPermitido'>;
  proveedorRango: ProveedorRangoEdad;
  secreto: string;
  duracionMs: number;
  duracionRecordadaMs: number;
  limites?: LimitesAcceso;
};

/** Código interno de una cuenta creada por la plataforma (registro o administración). */
export const nuevoCodigo = () => `Cuenta_${randomBytes(5).toString('hex').toUpperCase()}`;

export function crearServicioSesion({
  usuarios,
  sesiones,
  comunidades,
  avatar,
  dlp,
  proveedorRango,
  secreto,
  duracionMs,
  duracionRecordadaMs,
  limites = LIMITES_ACCESO,
}: Dependencias) {
  const fallosPorCuenta = crearLimitador({
    maximo: limites.fallosPorCuenta,
    ventanaMs: limites.ventanaMs,
  });
  const fallosPorIp = crearLimitador({ maximo: limites.fallosPorIp, ventanaMs: limites.ventanaMs });
  const registros = crearLimitador({
    maximo: limites.registrosPorIp,
    ventanaMs: limites.ventanaMs,
  });
  const consultasAlias = crearLimitador({
    maximo: limites.consultasAliasPorIp ?? LIMITES_ACCESO.consultasAliasPorIp!,
    ventanaMs: limites.ventanaMs,
  });

  async function aSesion(usuario: UsuarioRegistrado): Promise<Sesion> {
    const rango = await proveedorRango.determinarRango(usuario);
    return { idUsuario: usuario.idUsuario, alias: usuario.alias, rol: usuario.rol, rango };
  }

  async function abrir(usuario: UsuarioRegistrado, recordar: boolean): Promise<SesionAbierta> {
    const duracion = recordar ? duracionRecordadaMs : duracionMs;
    await sesiones.purgar();
    const idSesion = await sesiones.abrir(usuario.idUsuario, duracion, recordar);
    return {
      token: crearToken(idSesion, secreto, duracion),
      sesion: await aSesion(usuario),
      persistente: recordar,
      duracionMs: duracion,
    };
  }

  /**
   * Verificación común a los dos accesos (nametag y correo). Si la cuenta no existe o no tiene
   * contraseña, se hace igual una verificación de relleno y se responde el mismo 401: ni el
   * mensaje ni el tiempo revelan qué cuentas existen.
   */
  async function autenticar({
    ip,
    clave,
    contrasena,
    recordar,
    buscar,
    identificador,
  }: {
    ip: string;
    /** Clave del límite de intentos por cuenta (junto a la IP). */
    clave: string;
    contrasena: string;
    recordar: boolean;
    buscar: () => ReturnType<RepositorioUsuarios['paraIniciarSesion']>;
    /** Sujeto del mensaje de error: «El nametag» o «El correo». */
    identificador: string;
  }): Promise<SesionAbierta> {
    const claveCuenta = `${ip}|${clave}`;
    const espera = Math.max(
      fallosPorCuenta.bloqueadoPor(claveCuenta),
      fallosPorIp.bloqueadoPor(ip),
    );
    if (espera > 0) throw demasiadosIntentos(espera);

    const encontrada = await buscar();
    const correcta = await verificarContrasena(
      contrasena,
      encontrada?.hash ?? (await hashDeRelleno()),
    );
    if (!encontrada?.hash || !correcta) {
      fallosPorCuenta.registrar(claveCuenta);
      fallosPorIp.registrar(ip);
      throw credencialesInvalidas(identificador);
    }

    fallosPorCuenta.reiniciar(claveCuenta);
    if (encontrada.usuario.estado !== 'activo') {
      throw new ErrorApp(
        403,
        'CUENTA_NO_ACTIVA',
        'Tu cuenta no está activa en este momento. Si crees que es un error, habla con quien administra la plataforma.',
      );
    }
    return abrir(encontrada.usuario, recordar);
  }

  return {
    /**
     * Sesión vigente a partir del token de la cookie, o null. Exige que la sesión exista en la
     * base, no haya vencido ni sido revocada, y que la cuenta siga activa.
     */
    async resolver(token: string): Promise<Sesion | null> {
      const idSesion = verificarToken(token, secreto);
      if (!idSesion) return null;
      const usuario = await sesiones.usuarioDe(idSesion);
      if (!usuario || usuario.estado !== 'activo') return null;
      return aSesion(usuario);
    },

    /**
     * «Iniciar con mi Avatar»: nametag y contraseña. Las cuentas de personal no entran por aquí
     * (responden como si no existieran): tienen su propio acceso con correo.
     */
    async iniciar(entrada: unknown, ip: string): Promise<SesionAbierta> {
      const datos = validar(esquemaInicio, entrada);
      return autenticar({
        ip,
        clave: datos.alias.toLowerCase(),
        contrasena: datos.contrasena,
        recordar: datos.recordar,
        buscar: () => usuarios.paraIniciarSesion(datos.alias),
        identificador: 'El nametag',
      });
    },

    /**
     * Acceso del personal (moderación, gestión de fuentes): correo y contraseña. Usa las mismas
     * sesiones, cookie y límites de intentos que el acceso con nametag.
     */
    async iniciarPersonal(entrada: unknown, ip: string): Promise<SesionAbierta> {
      const datos = validar(esquemaInicioPersonal, entrada);
      return autenticar({
        ip,
        clave: `correo:${datos.correo}`,
        contrasena: datos.contrasena,
        recordar: datos.recordar,
        buscar: () => usuarios.paraIniciarSesionConCorreo(datos.correo),
        identificador: 'El correo',
      });
    },

    /**
     * Paso 1 del registro: falla con el mismo 409 `ALIAS_EN_USO` del registro si el nametag ya
     * está tomado. Es solo un aviso temprano: entre esta consulta y el registro otra persona
     * puede tomarlo, y entonces el índice único lo rechaza al registrar.
     */
    async comprobarAlias(entrada: unknown, ip: string): Promise<void> {
      const espera = consultasAlias.bloqueadoPor(ip);
      if (espera > 0) throw demasiadosIntentos(espera);
      consultasAlias.registrar(ip);

      const { alias } = validar(z.object({ alias: esquemaAlias }).strict(), entrada);
      if (await usuarios.aliasEnUso(alias)) throw aliasEnUso();
    },

    /** Crea una cuenta de joven y abre su sesión. */
    async registrar(entrada: unknown, ip: string): Promise<SesionAbierta> {
      const espera = registros.bloqueadoPor(ip);
      if (espera > 0) throw demasiadosIntentos(espera);
      registros.registrar(ip);

      const datos = validar(esquemaRegistro, entrada);
      const problema = problemaDeContrasena(datos.contrasena, datos.alias);
      if (problema) throw errores.solicitudInvalida([{ campo: 'contrasena', mensaje: problema }]);
      const configuracionAvatar = await avatar.validarConfiguracion(datos.avatar);
      const intereses = sinRepetidos(datos.intereses);

      // El nametag y los hobbies son públicos: pasan por el DLP como el resto del perfil (RF04).
      await dlp.exigirPermitido(
        { alias: datos.alias, intereses },
        { tipoContenido: 'perfil', idUsuario: null },
      );

      const hashContrasena = await hashearContrasena(datos.contrasena);
      let usuario: UsuarioRegistrado | undefined;
      for (let intento = 0; !usuario; intento++) {
        try {
          usuario = await usuarios.registrar({
            codigo: nuevoCodigo(),
            alias: datos.alias,
            rango: datos.rango,
            intereses,
            hashContrasena,
            avatar: configuracionAvatar,
          });
        } catch (error) {
          const { code, constraint } = error as { code?: string; constraint?: string };
          if (code === '23505' && constraint === 'usuario_alias_unico') throw aliasEnUso();
          // Choque (improbable) del código interno aleatorio: se intenta con otro.
          if (code === '23505' && constraint === 'usuario_codigo_key' && intento < 2) continue;
          throw error;
        }
      }
      return abrir(usuario, datos.recordar);
    },

    /** Revoca la sesión del token. Un token inválido o vencido no tiene nada que revocar. */
    async cerrar(token: string): Promise<void> {
      const idSesion = verificarToken(token, secreto);
      if (idSesion) await sesiones.revocar(idSesion);
    },

    /** Lo que necesita el formulario de registro antes de tener sesión. */
    async opcionesRegistro() {
      const [rangos, catalogo] = await Promise.all([usuarios.rangos(), avatar.catalogo()]);
      return { rangos, catalogo };
    },

    async describir(sesion: Sesion): Promise<SesionPublica> {
      const comunidad = sesion.rango ? await comunidades.porRango(sesion.rango) : null;
      return {
        id: sesion.idUsuario,
        alias: sesion.alias,
        rol: sesion.rol,
        comunidad: comunidad ? { id: comunidad.id, nombre: comunidad.nombre } : null,
        permisos: permisosDe(sesion.rol),
      };
    },
  };
}

export type ServicioSesion = ReturnType<typeof crearServicioSesion>;

/**
 * Abre una sesión SIN contraseña para una cuenta existente y devuelve su token. Solo para
 * herramientas internas (pruebas automatizadas y `npm run salas:simular`): ninguna ruta HTTP la
 * expone.
 */
export async function abrirSesionInterna(
  db: Database,
  secreto: string,
  idUsuario: string,
  duracionMs: number,
): Promise<string> {
  const idSesion = await crearRepositorioSesiones(db).abrir(idUsuario, duracionMs, false);
  return crearToken(idSesion, secreto, duracionMs);
}
