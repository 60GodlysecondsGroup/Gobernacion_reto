/**
 * Pruebas de la geometría de la ruleta de Orientación. Usan el ejecutor de pruebas de Node
 * (`node --test`), sin dependencias: `npm test -w apps/frontend`.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  RADIO_MEDIO,
  anguloDe,
  giroHacia,
  indiceCircular,
  indiceSegunTecla,
  pasosMasCortos,
  posicionEnRuleta,
  tamanoBoton,
  trazadoSector,
} from './ruleta.ts';

describe('ruleta: ángulos', () => {
  it('reparte los sectores en partes iguales para cualquier número de temas', () => {
    for (const total of [1, 2, 3, 6, 7, 12]) {
      const angulos = Array.from({ length: total }, (_, i) => anguloDe(i, total));
      assert.equal(angulos[0], 0);
      angulos.forEach((a, i) => assert.ok(Math.abs(a - (360 / total) * i) < 1e-9));
    }
  });

  it('normaliza índices fuera de rango', () => {
    assert.equal(indiceCircular(-1, 6), 5);
    assert.equal(indiceCircular(6, 6), 0);
    assert.equal(indiceCircular(13, 6), 1);
    assert.equal(indiceCircular(3, 0), 0);
  });
});

describe('ruleta: giro por el camino corto', () => {
  it('pasa del último al primero con un solo paso', () => {
    assert.equal(pasosMasCortos(5, 0, 6), 1);
    assert.equal(pasosMasCortos(0, 5, 6), -1);
    assert.equal(pasosMasCortos(1, 4, 6), 3);
    assert.equal(pasosMasCortos(2, 2, 6), 0);
    assert.equal(pasosMasCortos(0, 0, 1), 0);
  });

  it('acumula el giro sin saltos de vuelta completa', () => {
    let giro = 0;
    let actual = 0;
    // Seis pasos hacia delante: una vuelta entera, siempre de 60 en 60 grados.
    for (let k = 1; k <= 6; k++) {
      const siguiente = indiceCircular(actual + 1, 6);
      const nuevo = giroHacia(giro, actual, siguiente, 6);
      assert.equal(nuevo - giro, 60);
      giro = nuevo;
      actual = siguiente;
    }
    assert.equal(giro, 360);
    assert.equal(giroHacia(0, 0, 5, 6), -60);
  });

  it('el sector elegido siempre queda bajo el puntero', () => {
    const total = 7;
    let giro = 0;
    let actual = 0;
    for (const destino of [3, 6, 0, 4, 1, 1, 5]) {
      giro = giroHacia(giro, actual, destino, total);
      actual = destino;
      const residuo = (((giro - anguloDe(destino, total)) % 360) + 360) % 360;
      assert.ok(residuo < 1e-9 || 360 - residuo < 1e-9);
    }
  });
});

describe('ruleta: teclado', () => {
  it('las flechas giran en círculo e Inicio/Fin van a los extremos', () => {
    assert.equal(indiceSegunTecla('ArrowRight', 5, 6), 0);
    assert.equal(indiceSegunTecla('ArrowDown', 2, 6), 3);
    assert.equal(indiceSegunTecla('ArrowLeft', 0, 6), 5);
    assert.equal(indiceSegunTecla('ArrowUp', 3, 6), 2);
    assert.equal(indiceSegunTecla('Home', 4, 6), 0);
    assert.equal(indiceSegunTecla('End', 1, 6), 5);
    assert.equal(indiceSegunTecla('Enter', 1, 6), null);
    assert.equal(indiceSegunTecla('ArrowRight', 0, 0), null);
  });
});

describe('ruleta: posiciones y tamaños', () => {
  it('coloca el primer sector arriba y el resto en sentido horario', () => {
    assert.deepEqual(posicionEnRuleta(0, 4), { x: 50, y: 50 - RADIO_MEDIO / 2 });
    assert.deepEqual(posicionEnRuleta(1, 4), { x: 50 + RADIO_MEDIO / 2, y: 50 });
    assert.deepEqual(posicionEnRuleta(2, 4), { x: 50, y: 50 + RADIO_MEDIO / 2 });
  });

  it('todos los centros caen dentro del contenedor', () => {
    for (const total of [1, 3, 6, 12, 20]) {
      for (let i = 0; i < total; i++) {
        const { x, y } = posicionEnRuleta(i, total);
        assert.ok(x >= 0 && x <= 100 && y >= 0 && y <= 100);
      }
    }
  });

  it('los botones vecinos no se solapan', () => {
    for (const total of [2, 3, 6, 8, 12, 16]) {
      const lado = tamanoBoton(total);
      const a = posicionEnRuleta(0, total);
      const b = posicionEnRuleta(1, total);
      const distancia = Math.hypot(a.x - b.x, a.y - b.y);
      // Distancia entre centros mayor que el lado: los cuadrados no se tocan en la cuerda.
      assert.ok(distancia > lado, `${total} temas: ${distancia} <= ${lado}`);
      assert.ok(lado > 0);
    }
  });

  it('genera un trazado cerrado para cada sector, también con un solo tema', () => {
    for (const total of [1, 2, 6, 9]) {
      for (let i = 0; i < total; i++) {
        const d = trazadoSector(i, total);
        assert.match(d, /^M /);
        assert.match(d, /Z$/);
        assert.doesNotMatch(d, /NaN/);
      }
    }
  });
});
