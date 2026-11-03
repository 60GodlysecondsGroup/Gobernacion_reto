'use client';

import { ChatAsistente } from '@/components/chat-asistente/ChatAsistente';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Tarjeta } from '@/components/ui';
import { preguntarAsistente, type RespuestaAsistente } from '@/lib/api/asistente';
import { GraficoPorDia } from './GraficoPorDia';
import estilos from './AsistenteAdmin.module.css';

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

const textoDe = (resultado: RespuestaAsistente) => resultado.respuesta;

function datosDe(resultado: RespuestaAsistente, id: string) {
  const metricas = metricasVisibles(resultado);
  const actividad = actividadDiaria(resultado);
  if (metricas.length === 0 && !actividad) return null;
  return (
    <div className={estilos.datos}>
      {metricas.length > 0 && (
        <dl className={estilos.metricas}>
          {metricas.map((metrica) => (
            <div key={`${id}-${metrica.nombre}`}>
              <dt>{metrica.nombre}</dt>
              <dd>
                <strong>{metrica.valor}</strong>
                <small>{metrica.detalle}</small>
              </dd>
            </div>
          ))}
        </dl>
      )}
      {actividad && (
        <Tarjeta
          titulo="Actividad registrada"
          descripcion="Reportes, publicaciones, respuestas y eventos DLP por día. No representa solicitudes de ayuda."
        >
          <GraficoPorDia datos={actividad} etiqueta="Eventos registrados" />
        </Tarjeta>
      )}
    </div>
  );
}

export function AsistenteAdmin() {
  return (
    <>
      <EncabezadoPagina antetitulo="Administración · inteligencia operativa" titulo="Asistente IA">
        Consulta estadísticas y actividad registrada. Las respuestas se basan en datos agregados del
        prototipo.
      </EncabezadoPagina>
      <ChatAsistente
        nombre="Refugio IA"
        descripcion="Información operativa, con fuentes y períodos claros"
        textoEnLinea="Conectado al panel"
        bienvenida={{
          titulo: 'Hola, ¿qué necesitas revisar?',
          texto:
            'Puedo resumir reportes, ocupación de salas, actividad registrada y estado operativo.',
        }}
        sugerencias={SUGERENCIAS}
        sugerenciasConFlecha
        campo={{
          id: 'pregunta-asistente',
          etiqueta: 'Escribe tu pregunta',
          placeholder: 'Pregunta por reportes, actividad o estado de la plataforma…',
        }}
        textoGenerando="Consultando datos y preparando respuesta…"
        tituloError="No se pudo completar la consulta"
        preguntar={preguntarAsistente}
        textoDe={textoDe}
        extras={datosDe}
        nota={
          <p>
            Usa solo estadísticas agregadas. No incluyas nombres, teléfonos ni detalles de
            conversaciones. El asistente no evalúa ni diagnostica riesgos.
          </p>
        }
      />
    </>
  );
}
