import type { Rol } from './sesion';
import { api } from './cliente';

export type ResumenAdministracion = {
  usuarios: Partial<Record<'activo' | 'suspendido' | 'bloqueado', number>>;
  reportes: Partial<Record<'pendiente' | 'en_revision' | 'resuelto' | 'descartado', number>>;
  salas: { abiertas: number; deshabilitadas: number; personas: number };
  reglas: { activas: number; total: number };
  fuentes: Partial<Record<'activo' | 'requiere_revision' | 'inactivo', number>>;
  dlp7d: number;
  contenidoOculto: number;
};

export type EstadoUsuario = 'activo' | 'suspendido' | 'bloqueado';

export const NOMBRE_ESTADO_USUARIO: Record<EstadoUsuario, string> = {
  activo: 'Activa',
  suspendido: 'Suspendida',
  bloqueado: 'Bloqueada',
};

export type UsuarioAdministrado = {
  id: string;
  alias: string;
  rol: Rol;
  comunidad: string | null;
  estado: EstadoUsuario;
  fechaRegistro: string;
  reportesAbiertos: number;
  bloqueosDlp30d: number;
};

export type ComunidadAdministrada = {
  id: string;
  codigoRango: string;
  rango: string;
  nombre: string;
  descripcion: string;
  estado: 'activa' | 'inactiva';
  jovenes: number;
  hilos: number;
  salasAbiertas: number;
};

export type CategoriaAdministrada = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  orden: number;
  estado: 'activa' | 'inactiva';
  hilos: number;
  salasAbiertas: number;
};

export type TipoObstaculo = 'planta' | 'mesa' | 'sofa' | 'cojin' | 'estante' | 'caja';

export type SalaAdministrada = {
  id: string;
  nombre: string;
  descripcion: string;
  reglas: string;
  comunidad: { id: string; nombre: string; rango: string };
  categoria: { codigo: string; nombre: string };
  capacidad: number;
  ocupacion: number;
  estado: string;
  habilitada: boolean;
  escenario: {
    ancho: number;
    alto: number;
    obstaculos: { x: number; y: number; tipo: TipoObstaculo }[];
    aparicion: { x: number; y: number };
  };
};

export type ReglaDlp = {
  id: string;
  codigo: string;
  descripcion: string;
  patron: string;
  accion: string;
  estado: 'activa' | 'inactiva';
  bloqueos30d: number;
};

export type CategoriaDlp = {
  codigo: string;
  nombre: string;
  descripcion: string;
  reglas: ReglaDlp[];
};

export type RegistroAuditoria = {
  id: number;
  fecha: string;
  accion: string;
  entidad: string;
  idEntidad: string | null;
  detalle: Record<string, unknown>;
  actor: { id: string | null; alias: string | null; rol: Rol | null };
};

export const obtenerResumen = () => api.get<ResumenAdministracion>('/api/admin/resumen');

export const listarUsuarios = (filtro: {
  buscar?: string;
  rol?: string;
  estado?: string;
  pagina?: number;
}) => {
  const parametros = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtro)) {
    if (valor !== undefined && valor !== '') parametros.set(clave, String(valor));
  }
  return api.get<{ usuarios: UsuarioAdministrado[]; pagina: number; hayMas: boolean }>(
    `/api/admin/usuarios?${parametros}`,
  );
};

export const cambiarEstadoUsuario = (id: string, estado: EstadoUsuario) =>
  api.patch<{ estado: EstadoUsuario; cambio: boolean }>(
    `/api/admin/usuarios/${encodeURIComponent(id)}`,
    { estado },
  );

export const listarComunidades = () =>
  api.get<{ comunidades: ComunidadAdministrada[] }>('/api/admin/comunidades');

export const actualizarComunidad = (
  id: string,
  datos: Partial<Pick<ComunidadAdministrada, 'nombre' | 'descripcion' | 'estado'>>,
) =>
  api.patch<{ comunidades: ComunidadAdministrada[] }>(
    `/api/admin/comunidades/${encodeURIComponent(id)}`,
    datos,
  );

export const listarCategorias = () =>
  api.get<{ categorias: CategoriaAdministrada[] }>('/api/admin/categorias');

export const crearCategoria = (datos: { nombre: string; descripcion: string }) =>
  api.post<{ categorias: CategoriaAdministrada[] }>('/api/admin/categorias', datos);

export const actualizarCategoria = (
  id: string,
  datos: Partial<Pick<CategoriaAdministrada, 'nombre' | 'descripcion' | 'estado'>>,
) =>
  api.patch<{ categorias: CategoriaAdministrada[] }>(
    `/api/admin/categorias/${encodeURIComponent(id)}`,
    datos,
  );

export const listarSalasAdmin = (comunidad?: string) =>
  api.get<{ salas: SalaAdministrada[] }>(
    `/api/admin/salas${comunidad ? `?comunidad=${comunidad}` : ''}`,
  );

export const crearSalaAdmin = (datos: { comunidad: string; categoria: string }) =>
  api.post<{ sala: SalaAdministrada }>('/api/admin/salas', datos);

export const actualizarSalaAdmin = (
  id: string,
  datos: Partial<{ habilitada: boolean; capacidad: number; descripcion: string; reglas: string }>,
) => api.patch<{ sala: SalaAdministrada }>(`/api/admin/salas/${encodeURIComponent(id)}`, datos);

export const actualizarEscenarioAdmin = (
  id: string,
  datos: Pick<SalaAdministrada['escenario'], 'obstaculos' | 'aparicion'>,
) =>
  api.put<{ sala: SalaAdministrada }>(
    `/api/admin/salas/${encodeURIComponent(id)}/escenario`,
    datos,
  );

export const listarReglasDlp = () =>
  api.get<{ categorias: CategoriaDlp[] }>('/api/admin/reglas-dlp');

export const cambiarEstadoRegla = (id: string, estado: 'activa' | 'inactiva') =>
  api.patch<{ categorias: CategoriaDlp[] }>(`/api/admin/reglas-dlp/${encodeURIComponent(id)}`, {
    estado,
  });

export const cambiarEstadoCategoriaDlp = (codigo: string, estado: 'activa' | 'inactiva') =>
  api.patch<{ categorias: CategoriaDlp[] }>(
    `/api/admin/reglas-dlp/categorias/${encodeURIComponent(codigo)}`,
    { estado },
  );

export const listarAuditoria = (pagina = 1, entidad?: string) =>
  api.get<{ registros: RegistroAuditoria[]; pagina: number; hayMas: boolean }>(
    `/api/admin/auditoria?pagina=${pagina}${entidad ? `&entidad=${entidad}` : ''}`,
  );
