/**
 * Fuente única de los temas de Cocuyo: el backend (que controla la IA) y el frontend (que muestra
 * los accesos rápidos sin red y la página /guia) deben tener exactamente el mismo contenido.
 */
import { describe, expect, it } from 'vitest';
import {
  PRESENTACION_GUIA as PRESENTACION_FRONTEND,
  TEMAS_GUIA,
} from '../../frontend/src/config/guia.js';
import { IDS_TEMAS, PRESENTACION_GUIA, TEMAS } from '../src/modules/cocuyo/cocuyo.catalogo.js';

const contenido = (tema: {
  id: string;
  pregunta: string;
  parrafos: string[];
  enlace?: { href: string; texto: string };
  conCanales?: boolean;
}) => ({
  id: tema.id,
  pregunta: tema.pregunta,
  parrafos: tema.parrafos,
  enlace: tema.enlace ?? null,
  conCanales: Boolean(tema.conCanales),
});

describe('catálogo de Cocuyo', () => {
  it('el backend y el frontend tienen los mismos temas, textos, enlaces y orden', () => {
    expect(TEMAS.map(contenido)).toEqual(TEMAS_GUIA.map(contenido));
    expect(PRESENTACION_GUIA).toBe(PRESENTACION_FRONTEND);
  });

  it('conserva los siete temas originales de la guía', () => {
    expect(TEMAS.map((tema) => tema.id)).toEqual([...IDS_TEMAS]);
    expect(IDS_TEMAS).toEqual([
      'que-es',
      'comunidad',
      'privacidad',
      'salas',
      'reportar',
      'orientacion',
      'limites',
    ]);
  });

  it('cada tema tiene descripción para la IA y señales para el clasificador local', () => {
    for (const tema of TEMAS) {
      expect(tema.descripcion.length, tema.id).toBeGreaterThan(20);
      expect(tema.senales.length, tema.id).toBeGreaterThan(0);
      // Los enlaces son rutas internas, nunca URLs externas.
      if (tema.enlace) expect(tema.enlace.href, tema.id).toMatch(/^\/[a-z]/);
    }
  });
});
