
import express from 'express';

const app = express();

console.log('[LISTEN-PROBE] Módulo cargado', {
  node: process.version,
  vercel: process.env.VERCEL,
});

app.get('/api/__vercel_listen_probe', (_req, res) => {
  console.log('[LISTEN-PROBE] Solicitud recibida');

  return res.status(200).json({
    success: true,
    message: 'Express app.listen funciona en Vercel',
    node: process.version,
    mode: 'app.listen',
  });
});

const servidor = app.listen(3000, () => {
  console.log('[LISTEN-PROBE] Servidor iniciado');
});

servidor.on('error', (error) => {
  console.error('[LISTEN-PROBE] Error del servidor', error);
});
