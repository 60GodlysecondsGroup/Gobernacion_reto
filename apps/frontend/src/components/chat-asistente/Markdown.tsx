'use client';

import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { memo, useMemo, type ReactNode } from 'react';
import { analizarMarkdown, type Bloque, type EnLinea } from './formato';
import { BotonCopiar } from './BotonCopiar';
import estilos from './ChatAsistente.module.css';

const ALINEACION = { izquierda: 'left', centro: 'center', derecha: 'right' } as const;

function Enlace({ href, children }: { href: string; children: ReactNode }) {
  if (href.startsWith('/') || href.startsWith('#')) return <Link href={href}>{children}</Link>;
  if (/^(mailto|tel):/i.test(href)) return <a href={href}>{children}</a>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowUpRight className={estilos.iconoExterno} size={13} aria-hidden="true" />
      <span className="visualmente-oculto"> (se abre en otra pestaña)</span>
    </a>
  );
}

function pintarEnLinea(nodos: EnLinea[]): ReactNode[] {
  return nodos.map((nodo, i) => {
    switch (nodo.tipo) {
      case 'texto':
        return nodo.texto;
      case 'salto':
        return <br key={i} />;
      case 'codigo':
        return <code key={i}>{nodo.texto}</code>;
      case 'fuerte':
        return <strong key={i}>{pintarEnLinea(nodo.hijos)}</strong>;
      case 'enfasis':
        return <em key={i}>{pintarEnLinea(nodo.hijos)}</em>;
      case 'enlace':
        return (
          <Enlace key={i} href={nodo.href}>
            {pintarEnLinea(nodo.hijos)}
          </Enlace>
        );
    }
  });
}

function pintarBloques(bloques: Bloque[]): ReactNode[] {
  return bloques.map((bloque, i) => {
    switch (bloque.tipo) {
      case 'parrafo':
        return <p key={i}>{pintarEnLinea(bloque.contenido)}</p>;
      case 'titulo': {
        const Titulo = (['h3', 'h4', 'h5'] as const)[bloque.nivel - 1];
        return <Titulo key={i}>{pintarEnLinea(bloque.contenido)}</Titulo>;
      }
      case 'lista': {
        const elementos = bloque.elementos.map((contenido, j) => (
          <li key={j}>{pintarEnLinea(contenido)}</li>
        ));
        return bloque.ordenada ? (
          <ol key={i} start={bloque.inicio === 1 ? undefined : bloque.inicio}>
            {elementos}
          </ol>
        ) : (
          <ul key={i}>{elementos}</ul>
        );
      }
      case 'codigo':
        return (
          <div className={estilos.bloqueCodigo} key={i}>
            <div className={estilos.barraCodigo}>
              <span>{bloque.lenguaje || 'código'}</span>
              <BotonCopiar texto={bloque.texto} etiqueta="Copiar código" />
            </div>
            <pre tabIndex={0}>
              <code>{bloque.texto}</code>
            </pre>
          </div>
        );
      case 'cita':
        return <blockquote key={i}>{pintarBloques(bloque.bloques)}</blockquote>;
      case 'tabla':
        return (
          <div className={estilos.tabla} key={i} tabIndex={0} role="region" aria-label="Tabla">
            <table>
              <thead>
                <tr>
                  {bloque.cabecera.map((celda, j) => (
                    <th
                      key={j}
                      scope="col"
                      style={{ textAlign: ALINEACION[bloque.alineacion[j] ?? 'izquierda'] }}
                    >
                      {pintarEnLinea(celda)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bloque.filas.map((fila, j) => (
                  <tr key={j}>
                    {fila.map((celda, k) => (
                      <td
                        key={k}
                        style={{ textAlign: ALINEACION[bloque.alineacion[k] ?? 'izquierda'] }}
                      >
                        {pintarEnLinea(celda)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'separador':
        return <hr key={i} />;
    }
  });
}

/** Respuesta de un asistente con formato. Se memoriza: solo se vuelve a analizar si cambia el texto. */
export const Markdown = memo(function Markdown({ texto }: { texto: string }) {
  const bloques = useMemo(() => analizarMarkdown(texto), [texto]);
  return <div className={estilos.markdown}>{pintarBloques(bloques)}</div>;
});
