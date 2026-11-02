import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const directorioBackend = fileURLToPath(new URL('../../', import.meta.url));
const cliTsx = path.join(
  path.dirname(createRequire(import.meta.url).resolve('tsx/package.json')),
  'dist',
  'cli.mjs',
);
const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));
const procesos: ChildProcess[] = [];

function puertoLibre() {
  return new Promise<number>((resolver, rechazar) => {
    const sonda = createServer();
    sonda.once('error', rechazar);
    sonda.listen(0, '127.0.0.1', () => {
      const { port } = sonda.address() as { port: number };
      sonda.close(() => resolver(port));
    });
  });
}

async function detener(proceso: ChildProcess) {
  if (proceso.exitCode !== null || proceso.killed) return;
  const fin = new Promise<void>((resolver) => proceso.once('exit', () => resolver()));
  proceso.kill();
  await Promise.race([fin, esperar(7_000)]);
  if (proceso.exitCode === null) proceso.kill('SIGKILL');
}

afterEach(async () => {
  await Promise.all(procesos.splice(0).map(detener));
});

describe('Backend con Redis no disponible', () => {
  it('mantiene /api/salud disponible y registra el fallo de coordinación Redis', async () => {
    const puertoBackend = await puertoLibre();
    const puertoRedisCerrado = await puertoLibre();
    let salida = '';
    const proceso = spawn(process.execPath, [cliTsx, 'src/server.ts'], {
      cwd: directorioBackend,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        BACKEND_PORT: String(puertoBackend),
        SESSION_SECRET: 'secreto-local-para-pruebas-000000000000',
        FRONTEND_ORIGIN: 'http://localhost:3000',
        DATABASE_URL: process.env.DATABASE_URL,
        DATABASE_SSL: 'disable',
        REDIS_URL: `redis://127.0.0.1:${puertoRedisCerrado}`,
        REDIS_PREFIJO: 'prueba-redis-no-disponible:',
        LOG_LEVEL: 'info',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    procesos.push(proceso);
    proceso.stdout!.on('data', (datos) => (salida += String(datos)));
    proceso.stderr!.on('data', (datos) => (salida += String(datos)));

    const limite = Date.now() + 20_000;
    let salud: Response | undefined;
    while (Date.now() < limite && proceso.exitCode === null) {
      try {
        salud = await fetch(`http://127.0.0.1:${puertoBackend}/api/salud`, {
          signal: AbortSignal.timeout(1_000),
        });
        if (salud.ok) break;
      } catch {
        // El proceso todavía está cargando TypeScript o esperando a PostgreSQL.
      }
      await esperar(150);
    }

    expect(salud?.status, salida).toBe(200);
    const limiteRedis = Date.now() + 10_000;
    while (
      Date.now() < limiteRedis &&
      !salida.includes('backend.redis.inicializacion_salas.fallida') &&
      proceso.exitCode === null
    ) {
      await esperar(100);
    }

    const despuesDelFallo = await fetch(`http://127.0.0.1:${puertoBackend}/api/salud`, {
      signal: AbortSignal.timeout(2_000),
    });
    expect(salida).toContain('backend.http.primera_solicitud.recibida');
    expect(salida).toContain('redis.tcp.conexion.inicio');
    expect(salida).toContain('connect ECONNREFUSED [HOST_REDACTADO]');
    expect(salida).toContain('backend.redis.inicializacion_salas.fallida');
    expect(despuesDelFallo.status).toBe(200);
    expect(salida).not.toContain(`127.0.0.1:${puertoRedisCerrado}`);
  }, 40_000);
});
