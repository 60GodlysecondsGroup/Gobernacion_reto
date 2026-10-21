import type { Metadata } from 'next';
import { Insignia, Tarjeta } from '@/components/ui';
import { DemostracionFormulario } from './DemostracionFormulario';
import estilos from './page.module.css';

export const metadata: Metadata = { title: 'Guía de estilos' };

const COLORES = [
  { token: '--color-primario', uso: 'Acciones principales y enlaces' },
  { token: '--color-primario-oscuro', uso: 'Marca y estados activos' },
  { token: '--color-acento', uso: 'Reservado para «Necesito ayuda»' },
  { token: '--color-exito', uso: 'Correcto · fuente activa' },
  { token: '--color-advertencia', uso: 'Atención · requiere revisión' },
  { token: '--color-peligro', uso: 'Error · inactivo o bloqueado' },
  { token: '--color-texto', uso: 'Texto principal' },
  { token: '--color-texto-suave', uso: 'Texto secundario' },
  { token: '--color-superficie-suave', uso: 'Fondos de apoyo' },
];

const TAMANOS = [
  '--texto-3xl',
  '--texto-2xl',
  '--texto-xl',
  '--texto-lg',
  '--texto-md',
  '--texto-sm',
  '--texto-xs',
];

export default function GuiaDeEstilos() {
  return (
    <div className={estilos.pagina}>
      <header className={estilos.cabecera}>
        <h1 className={estilos.titulo}>Guía de estilos</h1>
        <p className={estilos.entradilla}>
          Referencia para el equipo: tokens de <code>src/styles/tokens.css</code> y componentes base
          de <code>src/components/ui</code>. Toda pantalla nueva se construye con ellos.
        </p>
      </header>

      <Tarjeta titulo="Paleta" descripcion="Los pares de texto y fondo cumplen contraste AA.">
        <ul className={estilos.paleta}>
          {COLORES.map(({ token, uso }) => (
            <li key={token} className={estilos.color}>
              <span
                className={estilos.muestra}
                style={{ background: `var(${token})` }}
                aria-hidden="true"
              />
              <code>{token}</code>
              <span className={estilos.uso}>{uso}</span>
            </li>
          ))}
        </ul>
      </Tarjeta>

      <Tarjeta
        titulo="Tipografía"
        descripcion="Atkinson Hyperlegible, diseñada para máxima legibilidad."
      >
        <ul className={estilos.tipografia}>
          {TAMANOS.map((token) => (
            <li key={token} style={{ fontSize: `var(${token})` }}>
              <code className={estilos.tokenTexto}>{token}</code> Información clara y verificable
            </li>
          ))}
        </ul>
      </Tarjeta>

      <Tarjeta titulo="Insignias de estado" descripcion="El texto siempre acompaña al color.">
        <div className={estilos.fila}>
          <Insignia tono="exito">Activo</Insignia>
          <Insignia tono="advertencia">Requiere revisión</Insignia>
          <Insignia tono="peligro">Inactivo</Insignia>
          <Insignia tono="info">Información</Insignia>
          <Insignia>Neutro</Insignia>
        </div>
      </Tarjeta>

      <Tarjeta
        titulo="Botones y campos de texto"
        descripcion="Ejemplo funcional de validación en el cliente. No guarda ni envía nada."
      >
        <DemostracionFormulario />
      </Tarjeta>
    </div>
  );
}
