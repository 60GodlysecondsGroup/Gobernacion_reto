/**
 * Contrato de la coordinación de salas: las mismas pruebas para la implementación en memoria
 * (test/coordinacion.test.ts) y para Redis (test/integracion/coordinacion-redis.test.ts). Cada
 * prueba usa dos coordinaciones que comparten estado, como dos instancias del backend.
 */
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  CoordinacionSalas,
  EventoSala,
  OrdenControl,
  Presencia,
} from '../src/modules/salas/salas.coordinacion.js';
import type { MensajeServidor } from '../src/modules/salas/salas.protocolo.js';

export type CrearInstancias = (presenciaMs: number) => Promise<{
  uno: CoordinacionSalas;
  dos: CoordinacionSalas;
  cerrar: () => Promise<void>;
}>;

const PRESENCIA_MS = 600;
const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

async function esperarQue(condicion: () => boolean | Promise<boolean>, limiteMs = 3000) {
  const inicio = Date.now();
  while (!(await condicion())) {
    if (Date.now() - inicio > limiteMs) throw new Error('La condición no se cumplió a tiempo');
    await esperar(10);
  }
}

const presencia = (
  idUsuario: string,
  conexion: string,
  instancia: string,
  posicion = { x: 0, y: 0 },
): Presencia => ({
  participante: { id: idUsuario, alias: `Alias-${idUsuario}`, avatar: null },
  posicion,
  conexion,
  instancia,
});

const entro = (p: Presencia): MensajeServidor => ({
  tipo: 'entro',
  participante: { ...p.participante, ...p.posicion },
  ocupacion: 0,
});
const salio = (idUsuario: string): MensajeServidor => ({
  tipo: 'salio',
  id: idUsuario,
  ocupacion: 0,
});

export function contratoCoordinacion(nombre: string, crearInstancias: CrearInstancias) {
  describe(`Coordinación de salas · ${nombre}`, () => {
    let uno: CoordinacionSalas;
    let dos: CoordinacionSalas;
    let cerrar: () => Promise<void>;
    let sala: string;
    const vistos: { uno: EventoSala[]; dos: EventoSala[] } = { uno: [], dos: [] };
    const ordenes: { uno: OrdenControl[]; dos: OrdenControl[] } = { uno: [], dos: [] };

    beforeEach(async () => {
      ({ uno, dos, cerrar } = await crearInstancias(PRESENCIA_MS));
      sala = randomUUID();
      for (const lado of ['uno', 'dos'] as const) {
        vistos[lado] = [];
        ordenes[lado] = [];
        const coordinacion = lado === 'uno' ? uno : dos;
        await coordinacion.iniciar({
          alOrden: (orden) => ordenes[lado].push(orden),
          alReconectar: () => {},
        });
        await coordinacion.suscribir(sala, (evento) => vistos[lado].push(evento));
      }
    });

    afterEach(async () => {
      await cerrar();
    });

    it('registrar avisa «entro» con la ocupación real y otra instancia ve la presencia', async () => {
      const a = presencia('a', 'c-a', uno.instancia, { x: 2, y: 3 });
      expect(await uno.registrar(sala, a, entro(a))).toBe(1);
      await esperarQue(() => vistos.dos.length === 1);
      expect(vistos.dos[0]!.mensaje).toEqual({
        tipo: 'entro',
        participante: { id: 'a', alias: 'Alias-a', avatar: null, x: 2, y: 3 },
        ocupacion: 1,
      });

      const { seq, presencias } = await dos.instantanea(sala);
      expect(presencias).toEqual([a]);
      expect(seq).toBe(vistos.dos[0]!.seq);
      expect(await dos.presencia(sala, 'a')).toEqual(a);
      expect(await dos.presencia(sala, 'nadie')).toBeNull();
    });

    it('reemplazar pasa la presencia a otra conexión y devuelve la anterior; sin presencia, null', async () => {
      const a = presencia('a', 'pestaña-1', uno.instancia);
      await uno.registrar(sala, a, entro(a));
      expect(await dos.reemplazar(sala, 'a', 'pestaña-2', dos.instancia)).toEqual(a);
      expect(await uno.presencia(sala, 'a')).toMatchObject({
        conexion: 'pestaña-2',
        instancia: dos.instancia,
      });
      expect(await dos.reemplazar(sala, 'b', 'c-b', dos.instancia)).toBeNull();
    });

    it('retirar con otra conexión no quita nada; con la dueña quita una sola vez y avisa «salio»', async () => {
      const a = presencia('a', 'c-a', uno.instancia);
      const b = presencia('b', 'c-b', dos.instancia);
      await uno.registrar(sala, a, entro(a));
      await dos.registrar(sala, b, entro(b));

      expect(await dos.retirar(sala, 'a', salio('a'), { conexion: 'otra' })).toBeNull();
      const [primera, segunda] = await Promise.all([
        uno.retirar(sala, 'a', salio('a'), { conexion: 'c-a' }),
        dos.retirar(sala, 'a', salio('a'), { conexion: 'c-a' }),
      ]);
      expect([primera, segunda].filter(Boolean)).toEqual([{ presencia: a, ocupacion: 1 }]);
      await esperarQue(() => vistos.uno.some((e) => e.mensaje.tipo === 'salio'));
      expect(vistos.uno.filter((e) => e.mensaje.tipo === 'salio').map((e) => e.mensaje)).toEqual([
        { tipo: 'salio', id: 'a', ocupacion: 1 },
      ]);
      expect((await uno.instantanea(sala)).presencias).toEqual([b]);
    });

    it('una presencia sin renovar vence; renovarla la mantiene', async () => {
      const a = presencia('a', 'c-a', uno.instancia);
      const b = presencia('b', 'c-b', dos.instancia);
      await uno.registrar(sala, a, entro(a));
      await dos.registrar(sala, b, entro(b));

      expect(await uno.retirar(sala, 'a', salio('a'), { soloVencida: true })).toBeNull();
      await esperar(PRESENCIA_MS * 0.6);
      expect(await dos.renovar([{ idSala: sala, idUsuario: 'b', conexion: 'c-b' }])).toEqual([]);
      await esperar(PRESENCIA_MS * 0.6);

      const vencidas = (await uno.vencidas()).filter((v) => v.idSala === sala);
      expect(vencidas).toEqual([{ idSala: sala, idUsuario: 'a' }]);
      expect(await dos.retirar(sala, 'b', salio('b'), { soloVencida: true })).toBeNull();
      expect(await dos.retirar(sala, 'a', salio('a'), { soloVencida: true })).toMatchObject({
        ocupacion: 1,
      });
      expect((await uno.presentes()).filter((p) => p.idSala === sala)).toEqual([
        { idSala: sala, idUsuario: 'b' },
      ]);
    });

    it('renovar informa las conexiones que ya no son dueñas de su presencia', async () => {
      const a = presencia('a', 'pestaña-1', uno.instancia);
      await uno.registrar(sala, a, entro(a));
      await dos.reemplazar(sala, 'a', 'pestaña-2', dos.instancia);
      const perdidas = await uno.renovar([
        { idSala: sala, idUsuario: 'a', conexion: 'pestaña-1' },
        { idSala: sala, idUsuario: 'b', conexion: 'c-b' },
      ]);
      expect(perdidas).toEqual([
        { conexion: 'pestaña-1', estado: 'reemplazada' },
        { conexion: 'c-b', estado: 'sin_presencia' },
      ]);
    });

    it('mover y publicar: solo la conexión dueña, y todas las instancias reciben en el mismo orden', async () => {
      const a = presencia('a', 'c-a', uno.instancia);
      const b = presencia('b', 'c-b', dos.instancia);
      await uno.registrar(sala, a, entro(a));
      await dos.registrar(sala, b, entro(b));
      const inicio = vistos.uno.length;

      const resultados = await Promise.all([
        uno.mover(sala, 'a', 'c-a', { x: 1, y: 0 }, { tipo: 'movio', id: 'a', x: 1, y: 0 }),
        dos.mover(sala, 'b', 'c-b', { x: 0, y: 1 }, { tipo: 'movio', id: 'b', x: 0, y: 1 }),
        uno.mover(sala, 'a', 'c-a', { x: 2, y: 0 }, { tipo: 'movio', id: 'a', x: 2, y: 0 }),
        dos.publicar(sala, 'b', 'c-b', {
          tipo: 'mensaje',
          id: 'm1',
          autor: { id: 'b', alias: 'Alias-b' },
          texto: 'Hola',
          fecha: '2026-01-01T00:00:00.000Z',
        }),
        uno.mover(sala, 'a', 'c-a', { x: 3, y: 0 }, { tipo: 'movio', id: 'a', x: 3, y: 0 }),
      ]);
      expect(resultados).toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
      // Una conexión que no es dueña no mueve ni publica.
      expect(
        await dos.mover(sala, 'a', 'c-b', { x: 9, y: 9 }, { tipo: 'movio', id: 'a', x: 9, y: 9 }),
      ).toBe('reemplazada');
      expect(await dos.publicar(sala, 'z', 'c-z', { tipo: 'salio', id: 'z', ocupacion: 0 })).toBe(
        'sin_presencia',
      );

      await esperarQue(() => vistos.uno.length - inicio === 5 && vistos.dos.length - inicio === 5);
      const orden = (eventos: EventoSala[]) => eventos.slice(inicio).map((e) => e.seq);
      expect(orden(vistos.uno)).toEqual(orden(vistos.dos));
      expect([...orden(vistos.uno)].sort((x, y) => x - y)).toEqual(orden(vistos.uno));
      // Los pasos de una misma conexión llegan en el orden en que se dieron.
      const pasosDeA = vistos.dos
        .slice(inicio)
        .flatMap((e) => (e.mensaje.tipo === 'movio' && e.mensaje.id === 'a' ? [e.mensaje.x] : []));
      expect(pasosDeA).toEqual([1, 2, 3]);
      expect((await uno.presencia(sala, 'a'))?.posicion).toEqual({ x: 3, y: 0 });
    });

    it('cada sala tiene su canal: los eventos de una no llegan a quien escucha otra', async () => {
      const otra = randomUUID();
      const enOtra: EventoSala[] = [];
      await dos.suscribir(otra, (evento) => enOtra.push(evento));
      const a = presencia('a', 'c-a', uno.instancia);
      await uno.registrar(otra, a, entro(a));
      await uno.mover(otra, 'a', 'c-a', { x: 1, y: 0 }, { tipo: 'movio', id: 'a', x: 1, y: 0 });
      await esperarQue(() => enOtra.length === 2);
      await esperar(50);
      expect(vistos.uno).toEqual([]);
      expect(vistos.dos).toEqual([]);
      expect((await uno.instantanea(sala)).presencias).toEqual([]);
    });

    it('al desuscribirse deja de recibir eventos de la sala', async () => {
      await dos.desuscribir(sala);
      const a = presencia('a', 'c-a', uno.instancia);
      await uno.registrar(sala, a, entro(a));
      await esperarQue(() => vistos.uno.length === 1);
      await esperar(50);
      expect(vistos.dos).toEqual([]);
    });

    it('el bloqueo de una persona en una sala excluye entre instancias', async () => {
      const tramos: string[] = [];
      const tarea = (quien: string) => async () => {
        tramos.push(`${quien}:inicio`);
        await esperar(40);
        tramos.push(`${quien}:fin`);
        return quien;
      };
      const resultados = await Promise.all([
        uno.conBloqueo(sala, 'a', tarea('uno')),
        dos.conBloqueo(sala, 'a', tarea('dos')),
        dos.conBloqueo(sala, 'b', tarea('otra-persona')),
      ]);
      expect(resultados).toEqual(['uno', 'dos', 'otra-persona']);
      const deA = tramos.filter((t) => !t.startsWith('otra-persona'));
      // Nunca empieza una mientras la otra sigue dentro.
      expect([
        ['uno:inicio', 'uno:fin', 'dos:inicio', 'dos:fin'],
        ['dos:inicio', 'dos:fin', 'uno:inicio', 'uno:fin'],
      ]).toContainEqual(deA);
      // Un error dentro suelta el bloqueo.
      await expect(
        uno.conBloqueo(sala, 'a', async () => {
          throw new Error('falla');
        }),
      ).rejects.toThrow('falla');
      expect(await dos.conBloqueo(sala, 'a', async () => 'libre')).toBe('libre');
    });

    it('las órdenes llegan a todas las instancias, incluida la que las envía', async () => {
      const orden: OrdenControl = {
        tipo: 'cerrar',
        conexion: 'c-x',
        codigo: 4000,
        error: { codigo: 'REEMPLAZADA', mensaje: 'Entraste desde otra pestaña.' },
      };
      await uno.ordenar(orden);
      await esperarQue(() => ordenes.uno.length === 1 && ordenes.dos.length === 1);
      expect(ordenes.dos).toEqual([orden]);
    });
  });
}
