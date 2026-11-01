import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// Un solo .env para todo el monorepo: se carga el de la raíz (además del propio, si existiera).
loadEnvConfig(path.resolve(process.cwd(), '../..'));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // En Vercel (vercel.json) el backend se sirve en el mismo dominio, bajo /api y /ws: el
  // cliente usa rutas relativas aunque el .env apunte a otro backend.
  env: process.env.VERCEL ? { NEXT_PUBLIC_API_URL: '' } : undefined,
};

export default nextConfig;
