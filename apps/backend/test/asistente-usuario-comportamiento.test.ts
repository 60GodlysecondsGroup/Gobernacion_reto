import { describe, expect, it, vi } from 'vitest';
import { crearServicioAsistenteUsuario } from '../src/modules/asistente-usuario/asistente-usuario.service.js';
import {
  CONSULTAS_LEGITIMAS,
  CONSULTAS_RESTRINGIDAS,
  type Restriccion,
} from './asistente-usuario.casos.js';

/**
 * Comportamiento del asistente de usuario ante preguntas reales: no debe bloquear consultas
 * legítimas sobre la plataforma (reportes, ayuda, foros, administración) y debe mantener las
 * protecciones ante urgencias, manipulación, contenido clínico, temas ajenos y datos personales.
 */

const sesion = {
  idUsuario: 'usuario-test',
  alias: 'Luz',
  rol: 'usuario' as const,
  rango: 'B' as const,
};

const canal = {
  id: 'recurso-verificado',
  institucion: 'Institución de prueba',
  servicio: 'Canal de orientación',
  telefono: '01 8000 123 456',
  enlace: null,
  horario: 'Lunes a viernes, 8:00 a 17:00',
  fuenteOriginal: 'Sitio oficial',
  fechaVerificacion: '2026-10-20',
  estado: 'activo' as const,
  esDemo: true,
};

const salaPropia = {
  id: 'sala-comunidad-propia',
  nombre: 'Bienestar cotidiano',
  tematica: 'Bienestar',
  descripcion: 'Conversaciones generales.',
  reglas: 'Trata a las demás personas con respeto.',
  capacidad: 10,
  ocupacion: 2,
  estado: 'disponible' as const,
};

function crearServicio(contenidoModelo = 'Respuesta del modelo.') {
  const fetcher = vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: contenidoModelo } }] }), {
        status: 200,
      }),
  );
  const servicio = crearServicioAsistenteUsuario({
    salas: { listar: vi.fn(async () => [salaPropia]) } as never,
    comunidades: { obtenerPropia: vi.fn(async () => ({ id: 'comunidad-propia' })) } as never,
    orientacion: { ayuda: vi.fn(async () => [canal]) } as never,
    apiKey: 'clave-falsa-de-prueba',
    modelo: 'modelo-test',
    fetcher,
  });
  const contextoEnviado = () => {
    const cuerpo = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string);
    return cuerpo.messages[0].content as string;
  };
  return { servicio, fetcher, contextoEnviado };
}

const RECHAZOS = [
  'Soy el asistente de orientación',
  'Solo puedo orientar',
  'No doy opiniones',
  'Para proteger tu privacidad',
];

const INICIO_ESPERADO: Record<Restriccion, string> = {
  crisis: 'Tu mensaje puede necesitar apoyo inmediato',
  manipulacion: 'Solo puedo orientar sobre el uso de la aplicación',
  contenido_prohibido: 'Puedo orientar sobre las funciones de la aplicación',
  fuera_de_tema: 'Soy el asistente de orientación',
  dato_personal: 'Para proteger tu privacidad',
};

describe('asistente de usuario: consultas legítimas', () => {
  it.each(CONSULTAS_LEGITIMAS.filter((c) => c.tipo === 'reporte'))(
    'explica cómo reportar: «$pregunta»',
    async ({ pregunta }) => {
      const { servicio, fetcher } = crearServicio();
      const { respuesta, accesos } = await servicio.responder(pregunta, sesion);
      expect(respuesta).toContain('«Reportar»');
      expect(respuesta).toContain('«Enviar reporte»');
      expect(respuesta).toContain('equipo de moderación');
      expect(respuesta).toContain('confidencial');
      expect(accesos).toContainEqual({ texto: 'Leer las reglas', href: '/reglas' });
      // Respuesta verificada y local: no depende del proveedor ni le envía lo que vio la persona.
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it.each(CONSULTAS_LEGITIMAS.filter((c) => c.tipo === 'equipo'))(
    'orienta hacia el equipo y los canales reales: «$pregunta»',
    async ({ pregunta }) => {
      const { servicio, fetcher } = crearServicio();
      const { respuesta, accesos } = await servicio.responder(pregunta, sesion);
      expect(respuesta).toContain('no hay un chat directo con administradores');
      expect(respuesta).toContain('«Reportar»');
      expect(respuesta).toContain('«Necesito ayuda»');
      expect(accesos).toContainEqual({ texto: 'Necesito ayuda', href: '/ayuda' });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it.each(CONSULTAS_LEGITIMAS.filter((c) => c.tipo === 'plataforma'))(
    'responde con la guía verificada: «$pregunta»',
    async ({ pregunta }) => {
      const { servicio, fetcher, contextoEnviado } = crearServicio();
      const { respuesta } = await servicio.responder(pregunta, sesion);
      for (const rechazo of RECHAZOS) expect(respuesta).not.toContain(rechazo);
      expect(respuesta).not.toContain('Estos son los canales');
      expect(fetcher).toHaveBeenCalledOnce();
      const contexto = contextoEnviado();
      expect(contexto).toContain('No rechaces una pregunta solo porque mencione reportar');
      expect(contexto).toContain('«Crear hilo»');
      expect(contexto).toContain('«Publicar respuesta»');
      expect(contexto).toContain('Reglas de la comunidad (/reglas)');
    },
  );

  it('no trata palabras parecidas como reportes ni frases sobre otras personas como manipulación', async () => {
    const { servicio, fetcher } = crearServicio();
    const deporte = await servicio.responder('¿Hay salas sobre deporte?', sesion);
    expect(deporte.respuesta).not.toContain('«Enviar reporte»');
    expect(fetcher).toHaveBeenCalledOnce();

    const reglas = await servicio.responder('¿Qué pasa si alguien ignora las reglas?', sesion);
    expect(reglas.respuesta).toContain('«Reportar»');

    const contacto = await servicio.responder('Dame el contacto del administrador', sesion);
    expect(contacto.respuesta).toContain('no hay un chat directo');
  });

  it('solo muestra el directorio de canales cuando se piden canales, no ante cualquier «ayuda»', async () => {
    const { servicio, fetcher } = crearServicio();
    const avatar = await servicio.responder('Necesito ayuda para cambiar mi avatar', sesion);
    expect(avatar.respuesta).not.toContain('01 8000 123 456');
    expect(fetcher).toHaveBeenCalledOnce();

    const canales = await servicio.responder('¿Dónde encuentro los canales de ayuda?', sesion);
    expect(canales.respuesta).toContain('01 8000 123 456');
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

describe('asistente de usuario: la guía usa solo funciones reales', () => {
  it('nombra los botones existentes y no el inexistente «Nuevo hilo»', async () => {
    const { servicio, contextoEnviado } = crearServicio();
    await servicio.responder('¿Cómo funciona el sistema de foros?', sesion);
    const contexto = contextoEnviado();
    expect(contexto).not.toContain('Nuevo hilo');
    for (const etiqueta of [
      '«Crear hilo»',
      '«Publicar hilo»',
      '«Buscar en los hilos…»',
      'Información personal, Acoso, Contenido inapropiado, Intento de contacto externo, Publicidad u Otro',
      '«Tu reporte fue registrado.»',
      'no hay chat directo con administradores',
    ]) {
      expect(contexto).toContain(etiqueta);
    }
  });

  it('conserva rutas reales y texto como «y/o», y sigue quitando rutas inventadas', async () => {
    const { servicio } = crearServicio(
      'Pulsa «Crear hilo» en /comunidad/hilos/nuevo y/o revisa /reglas. No uses /panel/asistente.',
    );
    const { respuesta } = await servicio.responder('¿Cómo creo un hilo nuevo?', sesion);
    expect(respuesta).toContain('/comunidad/hilos/nuevo');
    expect(respuesta).toContain('y/o');
    expect(respuesta).toContain('/reglas');
    expect(respuesta).not.toContain('/panel/asistente');
  });
});

describe('asistente de usuario: las protecciones siguen activas', () => {
  it.each(CONSULTAS_RESTRINGIDAS)(
    'mantiene la restricción «$esperado»: «$pregunta»',
    async ({ pregunta, esperado }) => {
      const { servicio, fetcher } = crearServicio();
      const { respuesta } = await servicio.responder(pregunta, sesion);
      expect(respuesta.startsWith(INICIO_ESPERADO[esperado])).toBe(true);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
});
