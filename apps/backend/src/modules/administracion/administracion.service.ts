import { z } from 'zod';
import { ErrorApp, errores } from '../../http/errores.js';
import { esUuid, validar } from '../../http/validacion.js';
import type { ServicioDlp } from '../dlp/dlp.service.js';
import type { GestorSalas } from '../salas/salas.gestor.js';
import {
  DIRECCIONES,
  esTransitable,
  TIPOS_OBSTACULO,
  type Escenario,
  type Posicion,
} from '../salas/salas.escenario.js';
import { ROLES, tienePermiso } from '../seguridad/permisos.js';
import type { Sesion } from '../seguridad/sesion.service.js';
import { ESTADOS_USUARIO, type RepositorioAdministracion } from './administracion.repository.js';

export const USUARIOS_POR_PAGINA = 20;

const texto = (min: number, max: number) => z.string().trim().min(min).max(max);

const esquemaListadoUsuarios = z.object({
  buscar: texto(2, 30).optional(),
  rol: z.enum(ROLES).optional(),
  estado: z.enum(ESTADOS_USUARIO).optional(),
  pagina: z.coerce.number().int().min(1).max(500).default(1),
});

const esquemaEstadoUsuario = z.object({ estado: z.enum(ESTADOS_USUARIO) }).strict();

const esquemaComunidad = z
  .object({
    nombre: texto(3, 60).optional(),
    descripcion: texto(0, 300).optional(),
    estado: z.enum(['activa', 'inactiva']).optional(),
  })
  .strict()
  .refine((datos) => Object.keys(datos).length > 0, 'Indica al menos un campo.');

const esquemaCategoriaNueva = z
  .object({ nombre: texto(3, 60), descripcion: texto(0, 300).default('') })
  .strict();

const esquemaCategoria = z
  .object({
    nombre: texto(3, 60).optional(),
    descripcion: texto(0, 300).optional(),
    estado: z.enum(['activa', 'inactiva']).optional(),
  })
  .strict()
  .refine((datos) => Object.keys(datos).length > 0, 'Indica al menos un campo.');

const esquemaListadoSalas = z.object({ comunidad: z.enum(['A', 'B', 'C', 'D']).optional() });

const esquemaSala = z
  .object({
    habilitada: z.boolean().optional(),
    // RF10: la capacidad nunca pasa de 10.
    capacidad: z.number().int().min(1).max(10, 'La capacidad máxima es 10.').optional(),
    descripcion: texto(0, 300).optional(),
    reglas: texto(0, 600).optional(),
  })
  .strict()
  .refine((datos) => Object.keys(datos).length > 0, 'Indica al menos un campo.');

const esquemaSalaNueva = z
  .object({
    comunidad: z.enum(['A', 'B', 'C', 'D']),
    categoria: z.string().regex(/^[a-z0-9-]{2,60}$/, 'Elige una categoría.'),
    descripcion: texto(0, 300).default(''),
    reglas: texto(0, 600).default(
      'Trata a todos con respeto. No compartas datos personales, de contacto, ubicaciones ni redes sociales. Los mensajes se revisan antes de mostrarse. Puedes salir cuando quieras.',
    ),
  })
  .strict();

const celda = z.object({ x: z.number().int().min(0), y: z.number().int().min(0) });

const esquemaEscenario = z
  .object({
    obstaculos: z.array(celda.extend({ tipo: z.enum(TIPOS_OBSTACULO) }).strict()).max(200),
    aparicion: celda.strict(),
  })
  .strict();

const esquemaEstadoRegla = z.object({ estado: z.enum(['activa', 'inactiva']) }).strict();

/** Código estable a partir del nombre: «Arte y música» → «arte-y-musica». */
export const codigoDesdeNombre = (nombre: string) =>
  nombre
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/**
 * Valida un escenario: obstáculos dentro del área y sin repetir, punto de aparición libre y
 * todas las celdas libres alcanzables desde él (que nadie quede encerrado).
 */
export function validarEscenario(escenario: Escenario): string | null {
  const vistos = new Set<string>();
  for (const o of escenario.obstaculos) {
    if (o.x >= escenario.ancho || o.y >= escenario.alto) return 'Hay obstáculos fuera del área.';
    const clave = `${o.x},${o.y}`;
    if (vistos.has(clave)) return 'Hay dos obstáculos en la misma celda.';
    vistos.add(clave);
  }
  if (!esTransitable(escenario, escenario.aparicion)) {
    return 'El punto de aparición debe estar dentro del área y libre.';
  }
  const libres = escenario.ancho * escenario.alto - escenario.obstaculos.length;
  const alcanzadas = new Set([`${escenario.aparicion.x},${escenario.aparicion.y}`]);
  const cola: Posicion[] = [escenario.aparicion];
  while (cola.length > 0) {
    const actual = cola.shift()!;
    for (const paso of Object.values(DIRECCIONES)) {
      const vecina = { x: actual.x + paso.x, y: actual.y + paso.y };
      const clave = `${vecina.x},${vecina.y}`;
      if (!alcanzadas.has(clave) && esTransitable(escenario, vecina)) {
        alcanzadas.add(clave);
        cola.push(vecina);
      }
    }
  }
  return alcanzadas.size === libres ? null : 'Los obstáculos dejan zonas sin salida.';
}

type Dependencias = {
  repositorio: RepositorioAdministracion;
  salas: GestorSalas;
  dlp: ServicioDlp;
};

const conflicto = (codigo: string, mensaje: string) => new ErrorApp(409, codigo, mensaje);

/**
 * Administración de la plataforma (F26–F29, F31). Toda medida pasa por aquí: el permiso se
 * vuelve a comprobar en el backend y cada cambio queda en el registro de auditoría.
 */
export function crearServicioAdministracion({ repositorio, salas, dlp }: Dependencias) {
  /**
   * Medida sobre una cuenta. Nadie cambia su propia cuenta; la moderación solo actúa sobre
   * cuentas de jóvenes (gestión «limitada» de la matriz A.2). Suspender saca de las salas.
   */
  async function cambiarEstadoUsuario(
    sesion: Sesion,
    idUsuario: string,
    nuevo: (typeof ESTADOS_USUARIO)[number],
    contexto: { idReporte?: string } = {},
  ) {
    if (!tienePermiso(sesion.rol, 'gestionar_usuarios')) throw errores.prohibido();
    const usuario = esUuid(idUsuario) ? await repositorio.usuario(idUsuario) : null;
    if (!usuario) throw errores.noEncontrado();
    if (usuario.id === sesion.idUsuario) {
      throw new ErrorApp(403, 'PROHIBIDO', 'No puedes aplicar medidas sobre tu propia cuenta.');
    }
    if (sesion.rol !== 'admin_plataforma' && usuario.rol !== 'usuario') {
      throw new ErrorApp(
        403,
        'PROHIBIDO',
        'La moderación solo puede aplicar medidas sobre cuentas de jóvenes.',
      );
    }
    if (usuario.estado === nuevo) return { estado: nuevo, cambio: false };

    const aplicado = await repositorio.cambiarEstadoUsuario({
      idUsuario: usuario.id,
      anterior: usuario.estado,
      nuevo,
      actor: sesion.idUsuario,
      idReporte: contexto.idReporte,
    });
    if (!aplicado) throw conflicto('CAMBIO_CONCURRENTE', 'La cuenta cambió. Vuelve a cargarla.');
    if (nuevo !== 'activo') await salas.retirarUsuario(usuario.id);
    return { estado: nuevo, cambio: true };
  }

  async function actualizarSala(sesion: Sesion, idSala: string, entrada: unknown) {
    if (!tienePermiso(sesion.rol, 'configurar_comunidades')) throw errores.prohibido();
    const datos = validar(esquemaSala, entrada);
    if (!esUuid(idSala)) throw errores.noEncontrado();
    const resultado = await repositorio.actualizarSala({
      id: idSala,
      datos,
      actor: sesion.idUsuario,
    });
    if (resultado === 'no_encontrada') throw errores.noEncontrado();
    if (resultado === 'capacidad_menor_que_ocupacion') {
      throw conflicto(
        'CAPACIDAD_MENOR_QUE_OCUPACION',
        'Hay más personas dentro que la capacidad indicada. Intenta cuando salgan.',
      );
    }
    if (datos.habilitada === false) await salas.retirarTodos(idSala);
    if (datos.capacidad !== undefined) salas.actualizarCapacidad(idSala, datos.capacidad);
    return repositorio.sala(idSala);
  }

  return {
    cambiarEstadoUsuario,
    actualizarSala,

    resumen: () => repositorio.resumen(),

    async listarUsuarios(consulta: unknown) {
      const { pagina, ...filtro } = validar(esquemaListadoUsuarios, consulta);
      const filas = await repositorio.listarUsuarios({
        ...filtro,
        limite: USUARIOS_POR_PAGINA + 1,
        desplazamiento: (pagina - 1) * USUARIOS_POR_PAGINA,
      });
      return {
        usuarios: filas.slice(0, USUARIOS_POR_PAGINA),
        pagina,
        hayMas: filas.length > USUARIOS_POR_PAGINA,
      };
    },

    async actualizarUsuario(sesion: Sesion, idUsuario: string, entrada: unknown) {
      const { estado } = validar(esquemaEstadoUsuario, entrada);
      return cambiarEstadoUsuario(sesion, idUsuario, estado);
    },

    listarComunidades: () => repositorio.listarComunidades(),

    async actualizarComunidad(sesion: Sesion, id: string, entrada: unknown) {
      const datos = validar(esquemaComunidad, entrada);
      if (!esUuid(id)) throw errores.noEncontrado();
      const ok = await repositorio.actualizarComunidad({ id, datos, actor: sesion.idUsuario });
      if (!ok) throw errores.noEncontrado();
      return { comunidades: await repositorio.listarComunidades() };
    },

    listarCategorias: () => repositorio.listarCategorias(),

    async crearCategoria(sesion: Sesion, entrada: unknown) {
      const datos = validar(esquemaCategoriaNueva, entrada);
      const codigo = codigoDesdeNombre(datos.nombre);
      if (codigo.length < 2) {
        throw errores.solicitudInvalida([{ campo: 'nombre', mensaje: 'Usa letras o números.' }]);
      }
      const id = await repositorio.crearCategoria({ ...datos, codigo, actor: sesion.idUsuario });
      if (!id) throw conflicto('CATEGORIA_EXISTENTE', 'Ya existe una categoría con ese nombre.');
      return { categorias: await repositorio.listarCategorias() };
    },

    async actualizarCategoria(sesion: Sesion, id: string, entrada: unknown) {
      const datos = validar(esquemaCategoria, entrada);
      if (!esUuid(id)) throw errores.noEncontrado();
      try {
        const ok = await repositorio.actualizarCategoria({ id, datos, actor: sesion.idUsuario });
        if (!ok) throw errores.noEncontrado();
      } catch (error) {
        if ((error as { code?: string }).code === '23505') {
          throw conflicto('CATEGORIA_EXISTENTE', 'Ya existe una categoría con ese nombre.');
        }
        throw error;
      }
      return { categorias: await repositorio.listarCategorias() };
    },

    async listarSalas(consulta: unknown) {
      const { comunidad } = validar(esquemaListadoSalas, consulta);
      return repositorio.listarSalas(comunidad);
    },

    async crearSala(sesion: Sesion, entrada: unknown) {
      const datos = validar(esquemaSalaNueva, entrada);
      const resultado = await repositorio.crearSala({
        rango: datos.comunidad,
        codigoCategoria: datos.categoria,
        descripcion: datos.descripcion,
        reglas: datos.reglas,
        actor: sesion.idUsuario,
      });
      if (resultado === 'no_encontrada') {
        throw errores.solicitudInvalida([
          { campo: 'categoria', mensaje: 'Elige una categoría activa.' },
        ]);
      }
      if (resultado === 'ya_existe') {
        throw conflicto(
          'SALA_EXISTENTE',
          'Esa comunidad ya tiene una sala abierta de esta categoría.',
        );
      }
      return repositorio.sala(resultado.id);
    },

    async actualizarEscenario(sesion: Sesion, idSala: string, entrada: unknown) {
      const datos = validar(esquemaEscenario, entrada);
      const sala = esUuid(idSala) ? await repositorio.sala(idSala) : null;
      if (!sala || sala.estado === 'cerrada') throw errores.noEncontrado();
      const problema = validarEscenario({
        ancho: sala.escenario.ancho,
        alto: sala.escenario.alto,
        obstaculos: datos.obstaculos,
        aparicion: datos.aparicion,
      });
      if (problema) {
        throw errores.solicitudInvalida([{ campo: 'obstaculos', mensaje: problema }]);
      }
      // Solo con la sala vacía: quien está dentro no ve aparecer un mueble encima.
      if (sala.ocupacion > 0 || !salas.olvidar(idSala)) {
        throw conflicto('SALA_OCUPADA', 'Solo se puede cambiar el escenario con la sala vacía.');
      }
      const ok = await repositorio.actualizarEscenario({
        idSala,
        obstaculos: datos.obstaculos,
        aparicion: datos.aparicion,
        actor: sesion.idUsuario,
      });
      if (!ok) {
        throw conflicto('SALA_OCUPADA', 'Solo se puede cambiar el escenario con la sala vacía.');
      }
      return repositorio.sala(idSala);
    },

    listarReglasDlp: () => repositorio.listarReglasDlp(),

    async cambiarEstadoRegla(sesion: Sesion, idRegla: string, entrada: unknown) {
      const { estado } = validar(esquemaEstadoRegla, entrada);
      if (!esUuid(idRegla) || !(await repositorio.existeRegla(idRegla))) {
        throw errores.noEncontrado();
      }
      await repositorio.cambiarEstadoReglas({
        filtro: { idRegla },
        estado,
        actor: sesion.idUsuario,
      });
      dlp.invalidarCache();
      return { categorias: await repositorio.listarReglasDlp() };
    },

    async cambiarEstadoCategoriaDlp(sesion: Sesion, codigo: string, entrada: unknown) {
      const { estado } = validar(esquemaEstadoRegla, entrada);
      if (!(await repositorio.existeCategoriaDlp(codigo))) throw errores.noEncontrado();
      await repositorio.cambiarEstadoReglas({
        filtro: { categoria: codigo },
        estado,
        actor: sesion.idUsuario,
      });
      dlp.invalidarCache();
      return { categorias: await repositorio.listarReglasDlp() };
    },
  };
}

export type ServicioAdministracion = ReturnType<typeof crearServicioAdministracion>;
