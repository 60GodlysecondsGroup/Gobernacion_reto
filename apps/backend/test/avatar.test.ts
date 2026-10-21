/**
 * Fase 6 · Validación del avatar sin base de datos (repositorio simulado).
 */
import { describe, expect, it, vi } from 'vitest';
import type {
  ConfiguracionAvatar,
  ElementoAvatar,
  RepositorioAvatar,
} from '../src/modules/avatar/avatar.repository.js';
import { crearServicioAvatar } from '../src/modules/avatar/avatar.service.js';
import type { Sesion } from '../src/modules/seguridad/sesion.service.js';

const CATALOGO: ElementoAvatar[] = [
  { id: 'tono-miel', tipo: 'personaje', nombre: 'Tono miel', recurso: 'tono-miel' },
  { id: 'cabello-corto', tipo: 'cabello', nombre: 'Corto', recurso: 'cabello-corto' },
  { id: 'rasgos-sonrisa', tipo: 'rasgo', nombre: 'Sonrisa', recurso: 'rasgos-sonrisa' },
  { id: 'prenda-buzo', tipo: 'prenda', nombre: 'Buzo verde', recurso: 'prenda-buzo' },
  { id: 'accesorio-gafas', tipo: 'accesorio', nombre: 'Gafas', recurso: 'accesorio-gafas' },
];

const VALIDA: ConfiguracionAvatar = {
  personaje: 'tono-miel',
  cabello: 'cabello-corto',
  rasgos: 'rasgos-sonrisa',
  prenda: 'prenda-buzo',
  accesorio: 'accesorio-gafas',
};

const sesion: Sesion = { idUsuario: 'usuario-1', alias: 'LunaDemo', rol: 'usuario', rango: 'B' };

function servicio() {
  const guardar = vi.fn(async () => {});
  const repositorio = {
    catalogo: async () => CATALOGO,
    configuracion: async () => null,
    apariencia: async () => VALIDA,
    guardar,
  } satisfies RepositorioAvatar;
  return { avatar: crearServicioAvatar(repositorio), guardar };
}

describe('Configuración del avatar (F36, RF21, RF22)', () => {
  it('guarda una configuración del catálogo para la persona de la sesión', async () => {
    const { avatar, guardar } = servicio();
    await avatar.guardarPropio(sesion, VALIDA);
    expect(guardar).toHaveBeenCalledWith('usuario-1', VALIDA);
  });

  it('cabello y accesorio pueden quedar vacíos', async () => {
    const { avatar, guardar } = servicio();
    await avatar.guardarPropio(sesion, { ...VALIDA, cabello: null, accesorio: null });
    expect(guardar).toHaveBeenCalledOnce();
  });

  it.each([
    ['una URL', { ...VALIDA, personaje: 'https://ejemplo.com/foto.png' }],
    ['texto libre', { ...VALIDA, cabello: 'mi nombre es Luna' }],
    ['un teléfono', { ...VALIDA, prenda: '3000000000' }],
    ['una imagen en base64', { ...VALIDA, accesorio: 'data:image/png;base64,iVBORw0KGgo=' }],
    ['un campo de foto', { ...VALIDA, foto: 'data:image/jpeg;base64,/9j/4AAQ' }],
    ['un texto en el avatar', { ...VALIDA, texto: 'Hola' }],
    ['el id de otra persona', { ...VALIDA, idUsuario: 'usuario-2' }],
    ['un elemento de otra capa', { ...VALIDA, prenda: 'cabello-corto' }],
    ['un elemento que no existe', { ...VALIDA, rasgos: 'rasgos-inventados' }],
    ['una capa obligatoria vacía', { ...VALIDA, rasgos: null }],
    ['algo que no es un objeto', 'tono-miel'],
  ])('AV-11 · rechaza %s y no guarda nada', async (_caso, entrada) => {
    const { avatar, guardar } = servicio();
    await expect(avatar.guardarPropio(sesion, entrada)).rejects.toMatchObject({
      estado: 400,
      codigo: 'AVATAR_INVALIDO',
    });
    expect(guardar).not.toHaveBeenCalled();
  });

  it('el error no repite el valor recibido', async () => {
    const { avatar } = servicio();
    const error = await avatar
      .guardarPropio(sesion, { ...VALIDA, cabello: 'Llámame al 3000000000' })
      .catch((e: unknown) => e);
    expect(JSON.stringify(error)).not.toContain('3000000000');
  });
});
