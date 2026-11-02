import express from 'express';

const app = express();

console.log('[PROBE] Vercel ha cargado el backend');

app.get('/api/__vercel_probe', (_req, res) => {
  console.log('[PROBE] Solicitud recibida');

  res.status(200).json({
    success: true,
    message: 'Express funciona en Vercel',
    node: process.version,
    vercel: process.env.VERCEL === '1',
  });
});

export default app;