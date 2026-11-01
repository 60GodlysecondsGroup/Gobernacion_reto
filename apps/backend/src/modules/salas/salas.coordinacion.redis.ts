import { createHash, randomUUID } from 'node:crypto';
import { createClient } from 'redis';
import type { Logger } from '../../lib/logger.js';
import {
  conOcupacion,
  type CoordinacionSalas,
  type EventoSala,
  type OrdenControl,
  type Presencia,
  type Propiedad,
} from './salas.coordinacion.js';

/**
 * Coordinación de salas sobre Redis (cualquier proveedor que hable el protocolo de Redis, con
 * `redis://` o `rediss://`). Cada cambio de estado y su evento van en un mismo script Lua: son
 * atómicos y salen en orden. Los vencimientos usan la hora del servidor Redis, no la de cada
 * instancia. Requiere Redis sin clúster (los scripts tocan claves de varias salas).
 *
 * Claves, bajo el prefijo configurado:
 *   sala:{id}:persona:{usuario}  hash   conexion, instancia, participante (JSON), x, y
 *   sala:{id}:miembros           set    usuarios presentes
 *   sala:{id}:seq                número del último evento de la sala
 *   presencias                   zset   «sala|usuario» → vencimiento (ms)
 *   bloqueo:{sala}:{usuario}     exclusión mientras la persona entra o sale
 * Canales: eventos:{sala} (eventos de la sala) y control (órdenes entre instancias).
 */

const DURACION_BLOQUEO_MS = 10_000;
const ESPERA_BLOQUEO_MS = 5_000;

const AHORA = `local t = redis.call('TIME')
local ahora = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)`;

const crearScript = (codigo: string) => ({
  codigo,
  sha: createHash('sha1').update(codigo).digest('hex'),
});

const SCRIPTS = {
  // KEYS: persona, miembros, presencias, seq · ARGV: miembro, usuario, conexion, instancia,
  // participante, x, y, ttl, canal, aviso
  registrar: crearScript(`${AHORA}
redis.call('HSET', KEYS[1], 'conexion', ARGV[3], 'instancia', ARGV[4], 'participante', ARGV[5], 'x', ARGV[6], 'y', ARGV[7])
redis.call('SADD', KEYS[2], ARGV[2])
redis.call('ZADD', KEYS[3], ahora + tonumber(ARGV[8]), ARGV[1])
local ocupacion = redis.call('SCARD', KEYS[2])
local seq = redis.call('INCR', KEYS[4])
redis.call('PUBLISH', ARGV[9], '{"seq":' .. seq .. ',"ocupacion":' .. ocupacion .. ',"mensaje":' .. ARGV[10] .. '}')
return ocupacion`),

  // KEYS: persona, presencias · ARGV: miembro, conexion, instancia, ttl
  reemplazar: crearScript(`${AHORA}
if redis.call('EXISTS', KEYS[1]) == 0 then return false end
local previa = redis.call('HGETALL', KEYS[1])
redis.call('HSET', KEYS[1], 'conexion', ARGV[2], 'instancia', ARGV[3])
redis.call('ZADD', KEYS[2], ahora + tonumber(ARGV[4]), ARGV[1])
return previa`),

  // KEYS: persona, miembros, presencias, seq · ARGV: miembro, usuario, conexion ('' = cualquiera),
  // soloVencida ('1'/'0'), canal, aviso
  retirar: crearScript(`${AHORA}
if redis.call('EXISTS', KEYS[1]) == 0 then
  redis.call('ZREM', KEYS[3], ARGV[1])
  redis.call('SREM', KEYS[2], ARGV[2])
  return false
end
if ARGV[3] ~= '' and redis.call('HGET', KEYS[1], 'conexion') ~= ARGV[3] then return false end
if ARGV[4] == '1' then
  local vence = redis.call('ZSCORE', KEYS[3], ARGV[1])
  if vence and tonumber(vence) > ahora then return false end
end
local presencia = redis.call('HGETALL', KEYS[1])
redis.call('DEL', KEYS[1])
redis.call('SREM', KEYS[2], ARGV[2])
redis.call('ZREM', KEYS[3], ARGV[1])
local ocupacion = redis.call('SCARD', KEYS[2])
local seq = redis.call('INCR', KEYS[4])
redis.call('PUBLISH', ARGV[5], '{"seq":' .. seq .. ',"ocupacion":' .. ocupacion .. ',"mensaje":' .. ARGV[6] .. '}')
return { ocupacion, presencia }`),

  // KEYS: presencias · ARGV: ttl, y por conexión: miembro, clave de persona, conexion
  renovar: crearScript(`${AHORA}
local vence = ahora + tonumber(ARGV[1])
local perdidas = {}
for i = 2, #ARGV, 3 do
  local actual = redis.call('HGET', ARGV[i + 1], 'conexion')
  if actual == ARGV[i + 2] then
    redis.call('ZADD', KEYS[1], 'XX', vence, ARGV[i])
  else
    table.insert(perdidas, ARGV[i + 2])
    table.insert(perdidas, actual and 'reemplazada' or 'sin_presencia')
  end
end
return perdidas`),

  // KEYS: presencias
  vencidas: crearScript(`${AHORA}
return redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ahora)`),

  // KEYS: persona, seq · ARGV: conexion, x, y, canal, aviso
  mover: crearScript(`local actual = redis.call('HGET', KEYS[1], 'conexion')
if not actual then return 'sin_presencia' end
if actual ~= ARGV[1] then return 'reemplazada' end
redis.call('HSET', KEYS[1], 'x', ARGV[2], 'y', ARGV[3])
local seq = redis.call('INCR', KEYS[2])
redis.call('PUBLISH', ARGV[4], '{"seq":' .. seq .. ',"mensaje":' .. ARGV[5] .. '}')
return 'ok'`),

  // KEYS: persona, seq · ARGV: conexion, canal, mensaje
  publicar: crearScript(`local actual = redis.call('HGET', KEYS[1], 'conexion')
if not actual then return 'sin_presencia' end
if actual ~= ARGV[1] then return 'reemplazada' end
local seq = redis.call('INCR', KEYS[2])
redis.call('PUBLISH', ARGV[2], '{"seq":' .. seq .. ',"mensaje":' .. ARGV[3] .. '}')
return 'ok'`),

  // KEYS: miembros, seq · ARGV: prefijo de las claves de persona
  instantanea: crearScript(`local filas = {}
for _, id in ipairs(redis.call('SMEMBERS', KEYS[1])) do
  local datos = redis.call('HGETALL', ARGV[1] .. id)
  if #datos > 0 then table.insert(filas, datos) end
end
return { tonumber(redis.call('GET', KEYS[2]) or '0'), filas }`),

  // KEYS: bloqueo · ARGV: token
  soltar:
    crearScript(`if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0`),
};

type Script = (typeof SCRIPTS)[keyof typeof SCRIPTS];

const comoObjeto = (lista: string[]) => {
  const objeto: Record<string, string> = {};
  for (let i = 0; i < lista.length; i += 2) objeto[lista[i]!] = lista[i + 1]!;
  return objeto;
};

const leerPresencia = (campos: Record<string, string>): Presencia => ({
  participante: JSON.parse(campos.participante!),
  posicion: { x: Number(campos.x), y: Number(campos.y) },
  conexion: campos.conexion!,
  instancia: campos.instancia!,
});

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

export function crearCoordinacionRedis({
  url,
  prefijo,
  presenciaMs,
  logger,
}: {
  url: string;
  prefijo: string;
  presenciaMs: number;
  logger: Logger;
}): CoordinacionSalas {
  const instancia = randomUUID();
  const claves = {
    persona: (idSala: string, idUsuario: string) => `${prefijo}sala:${idSala}:persona:${idUsuario}`,
    personas: (idSala: string) => `${prefijo}sala:${idSala}:persona:`,
    miembros: (idSala: string) => `${prefijo}sala:${idSala}:miembros`,
    seq: (idSala: string) => `${prefijo}sala:${idSala}:seq`,
    presencias: `${prefijo}presencias`,
    bloqueo: (idSala: string, idUsuario: string) => `${prefijo}bloqueo:${idSala}:${idUsuario}`,
    canal: (idSala: string) => `${prefijo}eventos:${idSala}`,
    control: `${prefijo}control`,
  };
  const miembro = (idSala: string, idUsuario: string) => `${idSala}|${idUsuario}`;
  const leerMiembro = (texto: string) => {
    const [idSala = '', idUsuario = ''] = texto.split('|');
    return { idSala, idUsuario };
  };

  // Sin cola fuera de línea: si Redis no responde, las operaciones fallan enseguida en vez de
  // esperar o seguir con un estado local que las demás instancias no verían.
  const cliente = createClient({
    url,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 5_000,
      reconnectStrategy: (intentos) => Math.min(100 * 2 ** intentos, 5_000),
    },
  });
  const suscriptor = cliente.duplicate();

  let inicio: Promise<void> | null = null;
  let alOrden: (orden: OrdenControl) => void = () => {};
  let alReconectar: () => void = () => {};

  // Un aviso por caída y otro al volver, no uno por reintento.
  for (const [nombre, conexion] of [
    ['principal', cliente],
    ['suscripción', suscriptor],
  ] as const) {
    let caida = false;
    let listo = false;
    conexion.on('error', (error: Error) => {
      if (caida) return;
      caida = true;
      logger.warn('Se perdió la conexión con Redis', { conexion: nombre, error: error.message });
    });
    conexion.on('ready', () => {
      const volvio = listo;
      listo = true;
      if (!caida) return;
      caida = false;
      logger.info('Conexión con Redis recuperada', { conexion: nombre });
      // Pub/Sub no guarda eventos: tras la caída del suscriptor, quien siga conectado se resincroniza.
      if (volvio && conexion === suscriptor) alReconectar();
    });
  }

  async function ejecutar(script: Script, keys: string[], argumentos: (string | number)[]) {
    const opciones = { keys, arguments: argumentos.map(String) };
    try {
      return (await cliente.evalSha(script.sha, opciones)) as unknown;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith('NOSCRIPT')) throw error;
      return (await cliente.eval(script.codigo, opciones)) as unknown;
    }
  }

  const leerEvento = (texto: string): EventoSala | null => {
    try {
      const { seq, ocupacion, mensaje } = JSON.parse(texto) as EventoSala & { ocupacion?: number };
      return { seq, mensaje: ocupacion === undefined ? mensaje : conOcupacion(mensaje, ocupacion) };
    } catch (error) {
      logger.warn('Evento de sala ilegible', { error: String(error) });
      return null;
    }
  };

  return {
    instancia,

    iniciar(manejadores) {
      alOrden = manejadores.alOrden;
      alReconectar = manejadores.alReconectar;
      inicio ??= (async () => {
        if (!cliente.isOpen) await cliente.connect();
        if (!suscriptor.isOpen) await suscriptor.connect();
        await suscriptor.subscribe(claves.control, (texto) => {
          try {
            alOrden(JSON.parse(texto) as OrdenControl);
          } catch (error) {
            logger.warn('Orden entre instancias ilegible', { error: String(error) });
          }
        });
        // Precarga de los scripts: el primer movimiento no paga un NOSCRIPT.
        await Promise.all(
          Object.values(SCRIPTS).map((script) => cliente.scriptLoad(script.codigo)),
        );
      })();
      inicio.catch(() => {
        inicio = null;
      });
      return inicio;
    },

    async conBloqueo(idSala, idUsuario, tarea) {
      const clave = claves.bloqueo(idSala, idUsuario);
      const token = randomUUID();
      const limite = Date.now() + ESPERA_BLOQUEO_MS;
      for (;;) {
        const tomado = await cliente.set(clave, token, {
          condition: 'NX',
          expiration: { type: 'PX', value: DURACION_BLOQUEO_MS },
        });
        if (tomado === 'OK') break;
        if (Date.now() > limite)
          throw new Error('Otra entrada o salida de esta persona no termina.');
        await esperar(15 + Math.random() * 20);
      }
      try {
        return await tarea();
      } finally {
        await ejecutar(SCRIPTS.soltar, [clave], [token]).catch((error) =>
          logger.warn('No se pudo soltar un bloqueo de sala', { error: String(error) }),
        );
      }
    },

    async presencia(idSala, idUsuario) {
      const campos = await cliente.hGetAll(claves.persona(idSala, idUsuario));
      return Object.keys(campos).length ? leerPresencia(campos) : null;
    },

    async registrar(idSala, presencia, aviso) {
      const idUsuario = presencia.participante.id;
      const ocupacion = await ejecutar(
        SCRIPTS.registrar,
        [
          claves.persona(idSala, idUsuario),
          claves.miembros(idSala),
          claves.presencias,
          claves.seq(idSala),
        ],
        [
          miembro(idSala, idUsuario),
          idUsuario,
          presencia.conexion,
          presencia.instancia,
          JSON.stringify(presencia.participante),
          presencia.posicion.x,
          presencia.posicion.y,
          presenciaMs,
          claves.canal(idSala),
          JSON.stringify(aviso),
        ],
      );
      return Number(ocupacion);
    },

    async reemplazar(idSala, idUsuario, conexion, nueva) {
      const previa = await ejecutar(
        SCRIPTS.reemplazar,
        [claves.persona(idSala, idUsuario), claves.presencias],
        [miembro(idSala, idUsuario), conexion, nueva, presenciaMs],
      );
      return previa ? leerPresencia(comoObjeto(previa as string[])) : null;
    },

    async retirar(idSala, idUsuario, aviso, { conexion = '', soloVencida = false } = {}) {
      const salida = await ejecutar(
        SCRIPTS.retirar,
        [
          claves.persona(idSala, idUsuario),
          claves.miembros(idSala),
          claves.presencias,
          claves.seq(idSala),
        ],
        [
          miembro(idSala, idUsuario),
          idUsuario,
          conexion,
          soloVencida ? '1' : '0',
          claves.canal(idSala),
          JSON.stringify(aviso),
        ],
      );
      if (!salida) return null;
      const [ocupacion, campos] = salida as [number, string[]];
      return { presencia: leerPresencia(comoObjeto(campos)), ocupacion: Number(ocupacion) };
    },

    async renovar(conexiones) {
      if (conexiones.length === 0) return [];
      const perdidas = (await ejecutar(
        SCRIPTS.renovar,
        [claves.presencias],
        [
          presenciaMs,
          ...conexiones.flatMap(({ idSala, idUsuario, conexion }) => [
            miembro(idSala, idUsuario),
            claves.persona(idSala, idUsuario),
            conexion,
          ]),
        ],
      )) as string[];
      const resultado: { conexion: string; estado: Exclude<Propiedad, 'ok'> }[] = [];
      for (let i = 0; i < perdidas.length; i += 2) {
        resultado.push({
          conexion: perdidas[i]!,
          estado: perdidas[i + 1] as Exclude<Propiedad, 'ok'>,
        });
      }
      return resultado;
    },

    async vencidas() {
      const miembros = (await ejecutar(SCRIPTS.vencidas, [claves.presencias], [])) as string[];
      return miembros.map(leerMiembro);
    },

    async presentes() {
      return (await cliente.zRange(claves.presencias, 0, -1)).map(leerMiembro);
    },

    async mover(idSala, idUsuario, conexion, posicion, aviso) {
      return (await ejecutar(
        SCRIPTS.mover,
        [claves.persona(idSala, idUsuario), claves.seq(idSala)],
        [conexion, posicion.x, posicion.y, claves.canal(idSala), JSON.stringify(aviso)],
      )) as Propiedad;
    },

    async publicar(idSala, idUsuario, conexion, mensaje) {
      return (await ejecutar(
        SCRIPTS.publicar,
        [claves.persona(idSala, idUsuario), claves.seq(idSala)],
        [conexion, claves.canal(idSala), JSON.stringify(mensaje)],
      )) as Propiedad;
    },

    async instantanea(idSala) {
      const [seq, filas] = (await ejecutar(
        SCRIPTS.instantanea,
        [claves.miembros(idSala), claves.seq(idSala)],
        [claves.personas(idSala)],
      )) as [number, string[][]];
      return {
        seq: Number(seq),
        presencias: filas.map((fila) => leerPresencia(comoObjeto(fila))),
      };
    },

    async suscribir(idSala, alEvento) {
      await suscriptor.subscribe(claves.canal(idSala), (texto) => {
        const evento = leerEvento(texto);
        if (evento) alEvento(evento);
      });
    },

    async desuscribir(idSala) {
      await suscriptor.unsubscribe(claves.canal(idSala));
    },

    async ordenar(orden) {
      await cliente.publish(claves.control, JSON.stringify(orden));
    },

    async cerrar() {
      await Promise.allSettled([
        cliente.isOpen ? cliente.close() : undefined,
        suscriptor.isOpen ? suscriptor.close() : undefined,
      ]);
    },
  };
}
