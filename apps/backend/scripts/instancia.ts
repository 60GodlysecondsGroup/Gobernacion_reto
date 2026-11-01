/**
 * Una instancia del backend en el puerto indicado, para probar las salas con varias instancias
 * que comparten Redis (`npm run dev:distribuido`). Si el .env no trae REDIS_URL, usa el Redis
 * local de `npm run redis:local`.
 *
 *   tsx scripts/instancia.ts 4001
 */
import { existsSync } from 'node:fs';

const envRaiz = new URL('../../../.env', import.meta.url);
if (existsSync(envRaiz)) process.loadEnvFile(envRaiz);

process.env.BACKEND_PORT = process.argv[2] ?? '4001';
process.env.REDIS_URL ||= 'redis://localhost:6379';

await import('../src/server.js');
