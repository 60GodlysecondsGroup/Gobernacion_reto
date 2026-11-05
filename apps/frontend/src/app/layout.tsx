import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Suspense } from 'react';
import { GuiaVirtual } from '@/components/guia/GuiaVirtual';
import { Encabezado } from '@/components/layout/Encabezado';
import { BarraInferior } from '@/components/layout/Navegacion';
import { BarraProgreso } from '@/components/movimiento/BarraProgreso';
import { LuzPuntero } from '@/components/movimiento/LuzPuntero';
import { PiePagina } from '@/components/layout/PiePagina';
import { ProveedorMovimiento } from '@/components/layout/ProveedorMovimiento';
import { ProveedorSesion } from '@/components/sesion/ProveedorSesion';
import { ProveedorNotificaciones } from '@/components/ui/Notificaciones';
import { cookies } from 'next/headers';
import { COOKIE_TEMA, esTema } from '@/lib/tema';
import '@/styles/tokens.css';
import './globals.css';

// Fuentes alojadas en el proyecto (licencia SIL OFL 1.1, ver app/fuentes): la demo funciona sin
// conexión a internet y no se envían datos a terceros para cargarlas.
// Texto: Atkinson Hyperlegible, diseñada para máxima legibilidad (accesibilidad, sección 28).
const atkinson = localFont({
  src: [
    { path: './fuentes/atkinson-hyperlegible-latin-400-normal.woff2', weight: '400' },
    {
      path: './fuentes/atkinson-hyperlegible-latin-400-italic.woff2',
      weight: '400',
      style: 'italic',
    },
    { path: './fuentes/atkinson-hyperlegible-latin-700-normal.woff2', weight: '700' },
  ],
  variable: '--fuente-atkinson',
  display: 'swap',
});

// Títulos: Bricolage Grotesque (variable), con carácter juvenil sin perder sobriedad.
const bricolage = localFont({
  src: './fuentes/bricolage-grotesque-latin-wght-normal.woff2',
  weight: '200 800',
  variable: '--fuente-bricolage',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Comunidad Protegida | Un espacio para jóvenes en Villavicencio',
    template: '%s · Comunidad Protegida',
  },
  description:
    'Espacio digital de orientación, participación y convivencia segura para jóvenes de 10 a 22 años en Villavicencio, Meta.',
  robots: { index: false, follow: false },
  applicationName: 'Comunidad Protegida',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f1fb' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
  // Ocupa toda la pantalla y activa `env(safe-area-inset-*)`: los márgenes, la barra inferior,
  // las hojas y la sala inmersiva ya los respetan (sin esto valen 0).
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // El tema elegido viaja en una cookie: el servidor lo pinta en <html> y no hace falta ningún
  // <script> (React 19 no los ejecuta dentro de componentes). Sin elección, manda el sistema.
  const guardado = (await cookies()).get(COOKIE_TEMA)?.value;
  const tema = esTema(guardado) ? guardado : undefined;
  return (
    // `suppressHydrationWarning`: el interruptor cambia `data-tema` en el cliente.
    <html
      lang="es"
      className={`${atkinson.variable} ${bricolage.variable}`}
      data-tema={tema}
      suppressHydrationWarning
    >
      <body>
        <a href="#contenido" className="saltar-contenido">
          Saltar al contenido
        </a>
        <Suspense fallback={null}>
          <BarraProgreso />
        </Suspense>
        <div className="progreso-scroll" aria-hidden="true" />
        <LuzPuntero />
        <ProveedorMovimiento>
          <ProveedorSesion>
            <ProveedorNotificaciones>
              <Encabezado />
              <main id="contenido" className="contenedor contenedor-principal">
                {children}
              </main>
              <PiePagina />
              <BarraInferior />
              <GuiaVirtual />
            </ProveedorNotificaciones>
          </ProveedorSesion>
        </ProveedorMovimiento>
      </body>
    </html>
  );
}
