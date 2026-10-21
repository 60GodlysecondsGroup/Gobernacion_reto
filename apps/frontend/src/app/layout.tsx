import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible } from 'next/font/google';
import { Encabezado } from '@/components/layout/Encabezado';
import { PiePagina } from '@/components/layout/PiePagina';
import { ProveedorSesion } from '@/components/sesion/ProveedorSesion';
import '@/styles/tokens.css';
import './globals.css';

// Tipografía diseñada para máxima legibilidad (principio de accesibilidad, sección 28).
const atkinson = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--fuente-atkinson',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Comunidad Protegida · Prototipo', template: '%s · Comunidad Protegida' },
  description:
    'Prototipo de hackathon con datos sintéticos: orientación institucional y comunidad protegida para jóvenes de Villavicencio. No es un servicio de salud.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#2f6f8f',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={atkinson.variable}>
      <body>
        <a href="#contenido" className="saltar-contenido">
          Saltar al contenido
        </a>
        <ProveedorSesion>
          <Encabezado />
          <main id="contenido" className="contenedor contenedor-principal">
            {children}
          </main>
          <PiePagina />
        </ProveedorSesion>
      </body>
    </html>
  );
}
