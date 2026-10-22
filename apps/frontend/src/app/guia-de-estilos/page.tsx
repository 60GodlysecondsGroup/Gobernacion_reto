import type { Metadata } from 'next';
import { Logo, MarcaCompleta } from '@/components/layout/Logo';
import { EstadoVacio, Insignia, Tarjeta } from '@/components/ui';
import { DemostracionComponentes } from './DemostracionComponentes';
import { DemostracionFormulario } from './DemostracionFormulario';
import estilos from './page.module.css';

export const metadata: Metadata = { title: 'Guía de estilos' };

const ARCHIVOS_MARCA = [
  { archivo: 'logo-icono.svg', uso: 'Icono de aplicación y favicon' },
  { archivo: 'logo-horizontal.svg', uso: 'Logotipo sobre fondos claros' },
  { archivo: 'logo-horizontal-negativo.svg', uso: 'Logotipo sobre fondos oscuros' },
  { archivo: 'logo-simbolo.svg', uso: 'Símbolo sin loseta, fondos claros' },
  { archivo: 'logo-simbolo-negativo.svg', uso: 'Símbolo sin loseta, fondos oscuros' },
];

const VENTANAS = [
  { token: '--ventana-cielo', uso: 'Comunidad A · 10–12' },
  { token: '--ventana-ambar', uso: 'Comunidad B · 13–15' },
  { token: '--ventana-menta', uso: 'Comunidad C · 16–17' },
  { token: '--ventana-lila', uso: 'Comunidad D · 18–22' },
];

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
          Referencia para el equipo: marca, tokens de <code>src/styles/tokens.css</code> y
          componentes base de <code>src/components/ui</code>. Toda pantalla nueva se construye con
          ellos.
        </p>
      </header>

      <Tarjeta
        titulo="Marca «Refugio»"
        descripcion="Un arco que abraza cuatro ventanas: la protección y las cuatro comunidades por edad, cada una con su luz."
      >
        <div className={estilos.marca}>
          <div className={estilos.lienzoMarca}>
            <MarcaCompleta tamano={52} subtitulo="Orientación y comunidad para jóvenes" />
          </div>
          <div className={`${estilos.lienzoMarca} ${estilos.lienzoOscuro}`}>
            <MarcaCompleta
              tamano={52}
              tono="oscuro"
              subtitulo="Orientación y comunidad para jóvenes"
            />
          </div>
          <div className={estilos.tamanosMarca}>
            {[64, 40, 24, 16].map((t) => (
              <Logo key={t} tamano={t} />
            ))}
            <Logo variante="simbolo" tamano={44} />
            <span className={estilos.fondoOscuroChico}>
              <Logo variante="simbolo" tono="oscuro" tamano={44} />
            </span>
          </div>
          <ul className={estilos.archivosMarca}>
            {ARCHIVOS_MARCA.map(({ archivo, uso }) => (
              <li key={archivo}>
                <a href={`/marca/${archivo}`} download>
                  {archivo}
                </a>
                <span>{uso}</span>
              </li>
            ))}
          </ul>
        </div>
      </Tarjeta>

      <Tarjeta
        titulo="Luces de las ventanas"
        descripcion="Acentos de marca: identifican comunidades y temas. Nunca se usan como color de texto sobre blanco."
      >
        <ul className={estilos.paleta}>
          {VENTANAS.map(({ token, uso }) => (
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

      <Tarjeta
        titulo="Estados y confirmaciones"
        descripcion="Vacío, diálogo de confirmación y notificación breve. Ejemplos sin efectos reales."
      >
        <div className={estilos.estados}>
          <EstadoVacio titulo="Todavía no hay hilos">
            Un estado vacío explica qué falta y propone el siguiente paso.
          </EstadoVacio>
          <DemostracionComponentes />
        </div>
      </Tarjeta>
    </div>
  );
}
