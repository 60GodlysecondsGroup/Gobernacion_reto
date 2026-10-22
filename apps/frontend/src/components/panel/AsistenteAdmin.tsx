'use client';

import { ArrowUp, Bot, Sparkles } from 'lucide-react';
import { Fragment, useState, type FormEvent } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso, Tarjeta } from '@/components/ui';
import { mensajeDeError } from '@/lib/api/cliente';
import { preguntarAsistente, type RespuestaAsistente } from '@/lib/api/asistente';
import { GraficoPorDia } from './GraficoPorDia';
import estilos from './AsistenteAdmin.module.css';

type Mensaje = { id: number; pregunta: string; resultado: RespuestaAsistente };

const SUGERENCIAS = [
  'Dame un resumen ejecutivo del estado de la plataforma.',
  '¿Cuántos reportes tenemos pendientes?',
  '¿Cuántas personas están actualmente en las salas?',
  '¿Cómo se compara la actividad de hoy con la de ayer?',
];

function metricasVisibles(resultado: RespuestaAsistente) {
  const filas: { nombre: string; valor: string; detalle: string }[] = [];
  for (const metrica of resultado.metricas) {
    const datos = metrica.datos as Record<string, unknown>;
    if (metrica.herramienta === 'getReportsSummary') {
      const estados = datos.estados as Record<string, number> | undefined;
      filas.push(
        {
          nombre: 'Reportes pendientes',
          valor: String(estados?.pendiente ?? 0),
          detalle: 'estado actual',
        },
        { nombre: 'Reportes hoy', valor: String(datos.hoy ?? 0), detalle: 'calendario de Bogotá' },
      );
    }
    if (metrica.herramienta === 'getRoomOccupancy') {
      filas.push({
        nombre: 'Personas en salas',
        valor: String(datos.ocupacionActual ?? 0),
        detalle: 'salas abiertas',
      });
    }
    if (metrica.herramienta === 'getPlatformOverview') {
      const reportes = datos.reportes as Record<string, number> | undefined;
      const salas = datos.salas as Record<string, number> | undefined;
      filas.push(
        {
          nombre: 'Reportes pendientes',
          valor: String(reportes?.pendiente ?? 0),
          detalle: 'estado actual',
        },
        {
          nombre: 'Personas en salas',
          valor: String(salas?.personas ?? 0),
          detalle: 'ocupación actual',
        },
      );
    }
    if (metrica.herramienta === 'getOperationalStatus') {
      filas.push(
        {
          nombre: 'Reportes pendientes',
          valor: String(datos.reportesPendientes ?? 0),
          detalle: 'revisión humana',
        },
        {
          nombre: 'Fuentes por revisar',
          valor: String(datos.fuentesPorRevisar ?? 0),
          detalle: 'estado actual',
        },
      );
    }
  }
  return filas.slice(0, 4);
}

function actividadDiaria(resultado: RespuestaAsistente) {
  const actividad = resultado.metricas.find((m) => m.herramienta === 'getActivityTrends')?.datos as
    | {
        actividad?: {
          dia: string;
          reportes: number;
          hilos: number;
          respuestas: number;
          bloqueosDlp: number;
        }[];
      }
    | undefined;
  return actividad?.actividad?.map((fila) => ({
    dia: fila.dia,
    total: fila.reportes + fila.hilos + fila.respuestas + fila.bloqueosDlp,
  }));
}

function respuestaConFormato(texto: string) {
  return texto.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((fragmento, indice) => {
    if (fragmento.startsWith('**') && fragmento.endsWith('**')) {
      return <strong key={indice}>{fragmento.slice(2, -2)}</strong>;
    }
    if (fragmento.startsWith('`') && fragmento.endsWith('`')) {
      return (
        <code className={estilos.codigo} key={indice}>
          {fragmento.slice(1, -1)}
        </code>
      );
    }
    return fragmento.split('\n').map((linea, indiceLinea) => (
      <Fragment key={`${indice}-${indiceLinea}`}>
        {indiceLinea > 0 && <br />}
        {linea}
      </Fragment>
    ));
  });
}

export function AsistenteAdmin() {
  const [pregunta, setPregunta] = useState('');
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(texto = pregunta) {
    const limpia = texto.trim();
    if (!limpia || cargando) return;
    setPregunta('');
    setError(null);
    setCargando(true);
    try {
      const resultado = await preguntarAsistente(limpia);
      setMensajes((actuales) => [...actuales, { id: Date.now(), pregunta: limpia, resultado }]);
    } catch (e) {
      setPregunta(limpia);
      setError(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    void enviar();
  }

  return (
    <>
      <EncabezadoPagina antetitulo="Administración · inteligencia operativa" titulo="Asistente IA">
        Consulta estadísticas y actividad registrada. Las respuestas se basan en datos agregados del
        prototipo.
      </EncabezadoPagina>
      <section className={estilos.marco} aria-label="Conversación con el asistente">
        <div className={estilos.encabezadoAsistente}>
          <span className={estilos.iconoAsistente}>
            <Bot size={22} aria-hidden="true" />
          </span>
          <div>
            <h2>Refugio IA</h2>
            <p>Información operativa, con fuentes y períodos claros</p>
          </div>
          <span className={estilos.enLinea}>
            <i /> Conectado al panel
          </span>
        </div>
        <div className={estilos.conversacion} aria-live="polite" aria-busy={cargando}>
          {mensajes.length === 0 ? (
            <div className={estilos.bienvenida}>
              <span className={estilos.destello}>
                <Sparkles size={20} aria-hidden="true" />
              </span>
              <h3>Hola, ¿qué necesitas revisar?</h3>
              <p>
                Puedo resumir reportes, ocupación de salas, actividad registrada y estado operativo.
              </p>
              <div className={estilos.sugerencias}>
                {SUGERENCIAS.map((sugerencia) => (
                  <button
                    key={sugerencia}
                    type="button"
                    onClick={() => void enviar(sugerencia)}
                    disabled={cargando}
                  >
                    {sugerencia}
                    <ArrowUp size={15} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            mensajes.map(({ id, pregunta: texto, resultado }) => (
              <article className={estilos.turno} key={id}>
                <p className={estilos.pregunta}>{texto}</p>
                <div className={estilos.respuesta}>
                  <span className={estilos.avatar}>
                    <Bot size={17} aria-hidden="true" />
                  </span>
                  <div className={estilos.contenidoRespuesta}>
                    <div className={estilos.respuestaTexto}>
                      {respuestaConFormato(resultado.respuesta)}
                    </div>
                    {metricasVisibles(resultado).length > 0 && (
                      <div className={estilos.metricas}>
                        {metricasVisibles(resultado).map((metrica) => (
                          <div key={`${id}-${metrica.nombre}`}>
                            <span>{metrica.nombre}</span>
                            <strong>{metrica.valor}</strong>
                            <small>{metrica.detalle}</small>
                          </div>
                        ))}
                      </div>
                    )}
                    {actividadDiaria(resultado) && (
                      <Tarjeta
                        titulo="Actividad registrada"
                        descripcion="Reportes, publicaciones, respuestas y eventos DLP por día. No representa solicitudes de ayuda."
                      >
                        <GraficoPorDia
                          datos={actividadDiaria(resultado)!}
                          etiqueta="Eventos registrados"
                        />
                      </Tarjeta>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
          {cargando && (
            <div className={estilos.generando}>
              <span />
              <span />
              <span /> Consultando datos y preparando respuesta…
            </div>
          )}
        </div>
        {error && (
          <div className={estilos.error}>
            <Aviso tono="peligro" titulo="No se pudo completar la consulta">
              {error}
            </Aviso>
          </div>
        )}
        <form className={estilos.compositor} onSubmit={alEnviar}>
          <label className="visualmente-oculto" htmlFor="pregunta-asistente">
            Escribe tu pregunta
          </label>
          <textarea
            id="pregunta-asistente"
            value={pregunta}
            onChange={(evento) => setPregunta(evento.target.value)}
            placeholder="Pregunta por reportes, actividad o estado de la plataforma…"
            maxLength={800}
            rows={2}
            disabled={cargando}
          />
          <button
            type="submit"
            aria-label="Enviar pregunta"
            disabled={!pregunta.trim() || cargando}
          >
            <ArrowUp size={19} aria-hidden="true" />
          </button>
        </form>
        <p className={estilos.notaPrivacidad}>
          Usa solo estadísticas agregadas. No incluyas nombres, teléfonos ni detalles de
          conversaciones. El asistente no evalúa ni diagnostica riesgos.
        </p>
      </section>
    </>
  );
}
