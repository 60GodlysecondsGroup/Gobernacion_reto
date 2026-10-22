/**
 * `npm run dev:local`: espera a que la base local de `npm run db:local` esté lista y arranca el
 * backend en modo desarrollo apuntando a ella. La URL se pasa como variable del proceso, que tiene
 * prioridad sobre el .env: no hace falta cambiar el .env para usar la base local.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SENAL_DB_LOCAL, URL_DB_LOCAL } from './db-local.config.js';

const limite = Date.now() + 180_000;
while (!existsSync(SENAL_DB_LOCAL)) {
  if (Date.now() > limite) {
    console.error('La base local no estuvo lista en 3 minutos. Revisa la salida de «db».');
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 500));
}

const cliTsx = fileURLToPath(import.meta.resolve('tsx/cli'));
const backend = spawn(
  process.execPath,
  [cliTsx, 'watch', '--clear-screen=false', 'src/server.ts'],
  {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: URL_DB_LOCAL, DATABASE_SSL: 'disable' },
  },
);
backend.on('exit', (codigo) => process.exit(codigo ?? 0));
for (const senal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(senal, () => backend.kill(senal));
}
