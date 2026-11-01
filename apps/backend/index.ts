// Entrada del servicio «backend» en Vercel (vercel.json). `vercel dev` no lee `entrypoint`:
// toma el primer app|index|server de la raíz o de src/ que importe 'express', y src/app.ts no
// arranca nada. Este archivo va antes en esa búsqueda y solo expone el servidor real.
import type {} from 'express';

export { default } from './src/server.js';
