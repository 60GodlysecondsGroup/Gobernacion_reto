/**
 * Pruebas del formato (Markdown) de los asistentes (`node --test`, sin dependencias):
 * `npm test -w apps/frontend`.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analizarEnLinea, analizarMarkdown, hrefSeguro, textoPlano } from './formato.ts';

describe('markdown: en línea', () => {
  it('reconoce negrita, cursiva y código', () => {
    assert.deepEqual(analizarEnLinea('Hay **3 reportes** y *nada* más en `app.reportes`'), [
      { tipo: 'texto', texto: 'Hay ' },
      { tipo: 'fuerte', hijos: [{ tipo: 'texto', texto: '3 reportes' }] },
      { tipo: 'texto', texto: ' y ' },
      { tipo: 'enfasis', hijos: [{ tipo: 'texto', texto: 'nada' }] },
      { tipo: 'texto', texto: ' más en ' },
      { tipo: 'codigo', texto: 'app.reportes' },
    ]);
  });

  it('no confunde guiones bajos dentro de palabras con cursiva', () => {
    assert.deepEqual(analizarEnLinea('usar_asistente_usuario'), [
      { tipo: 'texto', texto: 'usar_asistente_usuario' },
    ]);
  });

  it('solo convierte en enlace los destinos seguros', () => {
    assert.deepEqual(analizarEnLinea('[Salas](/salas)'), [
      { tipo: 'enlace', href: '/salas', hijos: [{ tipo: 'texto', texto: 'Salas' }] },
    ]);
    assert.deepEqual(analizarEnLinea('[clic](javascript:void)'), [
      { tipo: 'texto', texto: 'clic' },
    ]);
    assert.equal(hrefSeguro('//otro.sitio'), null);
    assert.equal(hrefSeguro('tel:123'), 'tel:123');
  });

  it('enlaza direcciones sueltas sin la puntuación final', () => {
    const [, enlace, final] = analizarEnLinea('Mira https://ejemplo.org/guia.');
    assert.deepEqual(enlace, {
      tipo: 'enlace',
      href: 'https://ejemplo.org/guia',
      hijos: [{ tipo: 'texto', texto: 'https://ejemplo.org/guia' }],
    });
    assert.deepEqual(final, { tipo: 'texto', texto: '.' });
  });
});

describe('markdown: bloques', () => {
  it('conserva los saltos de línea dentro de un párrafo', () => {
    const [parrafo] = analizarMarkdown('**Fuente:** `app.x`\n**Alcance:** todo');
    assert.equal(parrafo.tipo, 'parrafo');
    assert.ok(parrafo.tipo === 'parrafo' && parrafo.contenido.some((n) => n.tipo === 'salto'));
  });

  it('separa párrafos, títulos, listas y separadores', () => {
    const bloques = analizarMarkdown(
      '## Pasos\n1. Abre el menú\n2. Elige **Salas**\n\n---\n- uno\n- dos\nCierre',
    );
    assert.deepEqual(
      bloques.map((b) => b.tipo),
      ['titulo', 'lista', 'separador', 'lista', 'parrafo'],
    );
    const lista = bloques[1];
    assert.ok(lista.tipo === 'lista' && lista.ordenada && lista.elementos.length === 2);
  });

  it('mantiene la numeración cuando una lista se interrumpe', () => {
    const [, , segunda] = analizarMarkdown('1. a\n- b\n2. c');
    assert.ok(segunda.tipo === 'lista' && segunda.ordenada && segunda.inicio === 2);
  });

  it('lee tablas con alineación y completa filas cortas', () => {
    const [tabla] = analizarMarkdown('| Día | Total |\n|:--|--:|\n| lunes | 4 |\n| martes |');
    assert.ok(tabla.tipo === 'tabla');
    assert.deepEqual(tabla.alineacion, ['izquierda', 'derecha']);
    assert.equal(tabla.filas.length, 2);
    assert.deepEqual(tabla.filas[1][1], []);
  });

  it('respeta los bloques de código tal cual', () => {
    const [codigo] = analizarMarkdown('```sql\nSELECT **x**\n```');
    assert.deepEqual(codigo, { tipo: 'codigo', lenguaje: 'sql', texto: 'SELECT **x**' });
  });

  it('cierra un bloque de código sin valla final', () => {
    const [codigo] = analizarMarkdown('```\nlinea');
    assert.deepEqual(codigo, { tipo: 'codigo', lenguaje: '', texto: 'linea' });
  });

  it('agrupa citas', () => {
    const [cita] = analizarMarkdown('> uno\n> dos');
    assert.ok(cita.tipo === 'cita' && cita.bloques.length === 1);
  });

  it('devuelve una lista vacía para texto vacío', () => {
    assert.deepEqual(analizarMarkdown('  \n\n'), []);
  });
});

describe('markdown: texto plano', () => {
  it('quita el marcado al copiar', () => {
    assert.equal(
      textoPlano('## Hola\n**Fuente:** `app.x` y [Salas](/salas)'),
      'Hola\nFuente: app.x y Salas (/salas)',
    );
  });
});
