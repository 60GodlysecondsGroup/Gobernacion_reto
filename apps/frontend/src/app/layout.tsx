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
  title: { default: 'Comunidad Protegida · Prototipo', template: '%s · Comunidad Protegida' },
  description:
    'Prototipo de hackathon con datos sintéticos: orientación institucional y comunidad protegida para jóvenes de Villavicencio. No es un servicio de salud.',
  robots: { index: false, follow: false },
  applicationName: 'Comunidad Protegida',
};

export const viewport: Viewport = {
  themeColor: '#eef2fa',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${atkinson.variable} ${bricolage.variable}`}>
      <body>
        <a href="#contenido" className="saltar-contenido">
          Saltar al contenido
        </a>
        <Suspense fallback={null}>
          <BarraProgreso />
        </Suspense>
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
