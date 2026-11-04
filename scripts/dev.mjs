#!/usr/bin/env node
/**
 * Arranque de desarrollo: backend (puerto 4000) y frontend (puerto 3000) en una sola terminal.
 *
 * Funciona igual con `npm run dev`, `bun run dev` o `node scripts/dev.mjs`. Lanza directamente
 * los dos procesos con Node (sin capas de npm ni concurrently), así consume menos memoria.
 *
 * Por qué existe: el `dev` anterior usaba `npm run dev -w apps/...`. Bun reescribe `npm run`
 * como `bun run` pero no entiende `-w`, así que volvía a ejecutar el `dev` de la raíz una y otra
 * vez (procesos infinitos) y nunca arrancaba ningún servidor.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WINDOWS = process.platform === 'win32';
const COLORES = { backend: '\x1b[36m', frontend: '\x1b[35m', dev: '\x1b[33m' };
const FIN = '\x1b[0m';

const log = (origen, texto) => {
  for (const linea of String(texto).split(/\r?\n/)) {
    if (linea.trim()) console.log(`${COLORES[origen]}[${origen}]${FIN} ${linea}`);
  }
};

// ── Comprobaciones previas: fallar rápido y con un mensaje claro ─────────────────────────
function leerEnv() {
  const archivo = path.join(RAIZ, '.env');
  if (!existsSync(archivo)) {
    log('dev', 'Falta el archivo .env en la raíz. Copia .env.example como .env y complétalo.');
    process.exit(1);
  }
  const valores = {};
  for (const linea of readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const coincidencia = linea.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (coincidencia) valores[coincidencia[1]] = coincidencia[2].replace(/^["']|["']$/g, '');
  }
  return valores;
}

const env = leerEnv();
if (!env.DATABASE_URL) {
  log('dev', 'Falta DATABASE_URL en el .env (ver .env.example).');
  process.exit(1);
}

const binario = (paquete, relativo) => {
  const ruta = path.join(RAIZ, 'node_modules', paquete, relativo);
  if (!existsSync(ruta)) {
    log('dev', `No encuentro ${paquete}. Instala las dependencias una vez con: npm install`);
    process.exit(1);
  }
  return ruta;
};
const TSX = binario('tsx', 'dist/cli.mjs');
const NEXT = binario('next', 'dist/bin/next');

const puertoLibre = (puerto) =>
  new Promise((resolver) => {
    const prueba = createServer()
      .once('error', () => resolver(false))
      .once('listening', () => prueba.close(() => resolver(true)))
      .listen(puerto);
  });

const PUERTO_BACKEND = Number(env.BACKEND_PORT || process.env.BACKEND_PORT || 4000);
for (const [nombre, puerto] of [
  ['backend', PUERTO_BACKEND],
  ['frontend', 3000],
]) {
  if (!(await puertoLibre(puerto))) {
    log(
      'dev',
      `El puerto ${puerto} (${nombre}) ya está ocupado: probablemente quedó otra ejecución abierta.\n` +
        `Ciérrala (Ctrl + C en su terminal) o, en Windows, mira quién lo usa con:  netstat -ano | findstr :${puerto}`,
    );
    process.exit(1);
  }
}

// ── Procesos ────────────────────────────────────────────────────────────────────────────
// Siempre con Node (aunque se haya lanzado con Bun): Next.js y tsx están probados con Node.
const NODE = process.versions.bun ? 'node' : process.execPath;
const entornoHijos = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', FORCE_COLOR: '1' };

const hijos = [];
let cerrando = false;

function lanzar(nombre, args, cwd) {
  const hijo = spawn(NODE, args, { cwd, env: entornoHijos, stdio: ['ignore', 'pipe', 'pipe'] });
  hijo.stdout.on('data', (datos) => log(nombre, datos));
  hijo.stderr.on('data', (datos) => log(nombre, datos));
  hijo.on('exit', (codigo) => {
    if (cerrando) return;
    log(
      'dev',
      `El ${nombre} se detuvo (código ${codigo}). Revisa el error de arriba; cierro el resto.`,
    );
    detener(1);
  });
  hijos.push(hijo);
}

function detener(codigo = 0) {
  if (cerrando) return;
  cerrando = true;
  for (const hijo of hijos) {
    if (hijo.exitCode !== null) continue;
    // En Windows hay que cerrar el árbol completo (tsx watch y Next lanzan subprocesos).
    if (WINDOWS) spawnSync('taskkill', ['/pid', String(hijo.pid), '/T', '/F'], { stdio: 'ignore' });
    else hijo.kill('SIGTERM');
  }
  process.exit(codigo);
}

process.on('SIGINT', () => detener(0));
process.on('SIGTERM', () => detener(0));

log('dev', `Arrancando backend (puerto ${PUERTO_BACKEND}) y frontend (puerto 3000)…`);
lanzar(
  'backend',
  [TSX, 'watch', '--clear-screen=false', 'src/server.ts'],
  path.join(RAIZ, 'apps/backend'),
);
lanzar('frontend', [NEXT, 'dev', '--port', '3000'], path.join(RAIZ, 'apps/frontend'));

// Aviso de «listo» comprobando que los dos servidores responden de verdad (no depende de
// lo que imprima cada herramienta, que cambia entre versiones y sistemas operativos).
const responde = async (url) => {
  try {
    const respuesta = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return respuesta.status < 500 ? respuesta : null;
  } catch {
    return null;
  }
};

const inicio = Date.now();
let aviso30 = false;
while (!cerrando) {
  const [salud, web] = await Promise.all([
    responde(`http://localhost:${PUERTO_BACKEND}/api/salud`),
    responde('http://localhost:3000/'),
  ]);
  if (salud && web) {
    const segundos = Math.round((Date.now() - inicio) / 1000);
    log(
      'dev',
      `Listo en ${segundos} s: abre http://localhost:3000 en el navegador. Ctrl + C para detener.`,
    );
    // La conexión a la base puede tardar unos segundos más (sobre todo con Supabase).
    let baseOk = false;
    for (let intento = 0; intento < 8 && !baseOk && !cerrando; intento++) {
      const datos = await (
        await responde(`http://localhost:${PUERTO_BACKEND}/api/salud`)
      )
        ?.json()
        .catch(() => null);
      baseOk = datos?.baseDeDatos?.estado === 'ok';
      if (!baseOk) await new Promise((resolver) => setTimeout(resolver, 2500));
    }
    if (!baseOk && !cerrando) {
      log('dev', 'Aviso: el backend no logra conectar con la base de datos. Revisa DATABASE_URL.');
    }
    break;
  }
  if (!aviso30 && Date.now() - inicio > 30_000) {
    aviso30 = true;
    log(
      'dev',
      'Sigue arrancando (la primera compilación tarda más en equipos con pocos recursos)…',
    );
  }
  await new Promise((resolver) => setTimeout(resolver, 2000));
}
