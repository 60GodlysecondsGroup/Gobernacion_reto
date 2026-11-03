'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Aviso, Boton, CampoSeleccion, CampoTexto } from '@/components/ui';
import { TIPOS_CANAL, type TipoCanal } from '@/config/fuentes';
import { erroresPorCampo, mensajeDeError } from '@/lib/api/cliente';
import type { DatosFuente, DatosNuevaFuente, FuenteGestion } from '@/lib/api/fuentes';
import { obtenerNecesidades, type Necesidad } from '@/lib/api/orientacion';
import { hoyEnColombia } from '@/lib/fechas';
import {
  borradorDesde,
  borradorVacio,
  horarioDesde,
  validarHorario,
  type BorradorHorario,
} from '@/lib/horarios';
import comun from '../comun.module.css';
import estilos from './Fuentes.module.css';
import { SelectorHorario } from './SelectorHorario';

type Props =
  | { modo: 'crear'; alGuardar: (datos: DatosNuevaFuente) => Promise<void> }
  | { modo: 'editar'; fuente: FuenteGestion; alGuardar: (datos: DatosFuente) => Promise<void> };

const OPCIONES_CANAL = Object.entries(TIPOS_CANAL).map(([valor, etiqueta]) => ({
  valor,
  etiqueta,
}));
const OPCIONES_ESTADO = [
  { valor: 'activo', etiqueta: 'Activo: verificada y vigente' },
  { valor: 'requiere_revision', etiqueta: 'Requiere revisión: falta comprobarla' },
];

function inicial(props: Props): DatosNuevaFuente {
  if (props.modo === 'editar') {
    const f = props.fuente;
    return {
      institucion: f.institucion,
      servicio: f.servicio,
      descripcion: f.descripcion,
      tipoCanal: f.tipoCanal,
      telefono: f.telefono ?? '',
      enlace: f.enlace ?? '',
      horario: f.horario ?? '',
      horarioSemanal: f.horarioSemanal,
      fuenteOriginal: f.fuenteOriginal,
      necesidades: f.necesidades.map((n) => n.codigo),
      observaciones: f.observaciones ?? '',
      esDemo: f.esDemo,
      estado: 'activo',
      fechaVerificacion: f.fechaVerificacion,
    };
  }
  return {
    institucion: '',
    servicio: '',
    descripcion: '',
    tipoCanal: 'telefono',
    telefono: '',
    enlace: '',
    horario: '',
    horarioSemanal: null,
    fuenteOriginal: '',
    necesidades: [],
    observaciones: '',
    esDemo: true,
    estado: 'activo',
    fechaVerificacion: hoyEnColombia(),
  };
}

/** Al editar no se envían estado ni fecha: cambian solo con las acciones de verificación. */
const aEdicion = (datos: DatosNuevaFuente): DatosFuente => ({
  institucion: datos.institucion,
  servicio: datos.servicio,
  descripcion: datos.descripcion,
  tipoCanal: datos.tipoCanal,
  telefono: datos.telefono,
  enlace: datos.enlace,
  horario: datos.horario,
  horarioSemanal: datos.horarioSemanal,
  fuenteOriginal: datos.fuenteOriginal,
  necesidades: datos.necesidades,
  observaciones: datos.observaciones,
  esDemo: datos.esDemo,
});

/**
 * Horario que se edita. Las fuentes con horario solo en texto (anteriores al horario semanal)
 * empiezan en null: conservan su texto hasta que alguien configure el horario semanal.
 */
function horarioInicial(props: Props): BorradorHorario | null {
  if (props.modo === 'crear') return borradorVacio();
  const { horario, horarioSemanal } = props.fuente;
  if (horarioSemanal) return borradorDesde(horarioSemanal);
  return horario ? null : borradorVacio();
}

/** Datos de una fuente (F32). Ninguna fuente nueva se registra sin fecha de verificación (B.6). */
export function FormularioFuente(props: Props) {
  const [datos, setDatos] = useState<DatosNuevaFuente>(() => inicial(props));
  const [horario, setHorario] = useState<BorradorHorario | null>(() => horarioInicial(props));
  const [revisarHorario, setRevisarHorario] = useState(false);
  const [necesidades, setNecesidades] = useState<Necesidad[]>([]);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [mensaje, setMensaje] = useState<{ tono: 'exito' | 'peligro'; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vigente = true;
    obtenerNecesidades()
      .then((r) => vigente && setNecesidades(r.necesidades))
      .catch(() => vigente && setNecesidades([]));
    return () => {
      vigente = false;
    };
  }, []);

  const cambiar = <K extends keyof DatosNuevaFuente>(campo: K, valor: DatosNuevaFuente[K]) => {
    setDatos((actual) => ({ ...actual, [campo]: valor }));
    setErrores((actual) => ({ ...actual, [campo]: '' }));
    setMensaje(null);
  };

  const alternarNecesidad = (codigo: string) =>
    cambiar(
      'necesidades',
      datos.necesidades.includes(codigo)
        ? datos.necesidades.filter((c) => c !== codigo)
        : [...datos.necesidades, codigo],
    );

  const cambiarHorario = (borrador: BorradorHorario | null) => {
    setHorario(borrador);
    setErrores((actual) => ({ ...actual, horarioSemanal: '' }));
    setMensaje(null);
  };

  const erroresHorario = horario
    ? validarHorario(horario, { exigirCompletos: revisarHorario })
    : {};

  async function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (horario && Object.keys(validarHorario(horario, { exigirCompletos: true })).length > 0) {
      setRevisarHorario(true);
      setMensaje({
        tono: 'peligro',
        texto: 'Revisa el horario: hay intervalos incompletos, al revés o que se cruzan.',
      });
      return;
    }
    // Con horario semanal, el backend escribe el texto; sin él, se conserva el texto anterior.
    const conHorario: DatosNuevaFuente = horario
      ? { ...datos, horario: '', horarioSemanal: horarioDesde(horario) }
      : { ...datos, horarioSemanal: null };
    setGuardando(true);
    setErrores({});
    setMensaje(null);
    try {
      if (props.modo === 'crear') {
        await props.alGuardar(conHorario);
      } else {
        await props.alGuardar(aEdicion(conHorario));
        setMensaje({ tono: 'exito', texto: 'Cambios guardados y registrados en la bitácora.' });
      }
    } catch (e) {
      setErrores(erroresPorCampo(e));
      setMensaje({ tono: 'peligro', texto: mensajeDeError(e) });
    } finally {
      setGuardando(false);
    }
  }

  const texto = (campo: 'institucion' | 'servicio' | 'telefono' | 'enlace' | 'fuenteOriginal') => ({
    value: datos[campo],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => cambiar(campo, e.target.value),
    error: errores[campo] || undefined,
  });

  return (
    <form className={comun.formulario} onSubmit={alEnviar} noValidate>
      {mensaje && <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>}

      <div className={estilos.dosColumnas}>
        <CampoTexto
          etiqueta="Institución responsable"
          obligatorio
          maxLength={120}
          {...texto('institucion')}
        />
        <CampoTexto
          etiqueta="Servicio o canal"
          obligatorio
          maxLength={120}
          {...texto('servicio')}
        />
      </div>

      <CampoTexto
        etiqueta="Descripción"
        obligatorio
        ayuda="Al menos 10 caracteres. Qué ofrece, con las palabras de la fuente oficial. Sin diagnósticos ni recomendaciones clínicas."
        multilinea
        rows={3}
        maxLength={1000}
        value={datos.descripcion}
        onChange={(e) => cambiar('descripcion', e.target.value)}
        error={errores.descripcion || undefined}
      />

      <div className={estilos.dosColumnas}>
        <CampoSeleccion
          etiqueta="Tipo de canal"
          obligatorio
          opciones={OPCIONES_CANAL}
          value={datos.tipoCanal}
          onChange={(e) => cambiar('tipoCanal', e.target.value as TipoCanal)}
          error={errores.tipoCanal || undefined}
        />
        <CampoTexto
          etiqueta="Teléfono"
          ayuda="Obligatorio para canales telefónicos."
          {...texto('telefono')}
        />
        <CampoTexto
          etiqueta="Enlace oficial"
          ayuda="Obligatorio para web y chat. Debe empezar por https://."
          inputMode="url"
          {...texto('enlace')}
        />
      </div>

      <SelectorHorario
        borrador={horario}
        alCambiar={cambiarHorario}
        errores={erroresHorario}
        textoAnterior={
          props.modo === 'editar' && !props.fuente.horarioSemanal ? datos.horario : null
        }
        errorServidor={errores.horarioSemanal || errores.horario || undefined}
      />

      <CampoTexto
        etiqueta="Fuente original"
        obligatorio
        ayuda="Sitio o documento oficial de donde sale esta información."
        maxLength={300}
        {...texto('fuenteOriginal')}
      />

      <fieldset className={estilos.grupo}>
        <legend className={estilos.leyenda}>
          Temas de orientación donde aparece{' '}
          <span className={estilos.notaLeyenda}>Elige al menos uno</span>
        </legend>
        <div className={estilos.casillas}>
          {necesidades.map((necesidad) => (
            <label key={necesidad.codigo} className={estilos.casilla}>
              <input
                type="checkbox"
                checked={datos.necesidades.includes(necesidad.codigo)}
                onChange={() => alternarNecesidad(necesidad.codigo)}
              />
              {necesidad.nombre}
            </label>
          ))}
        </div>
        {errores.necesidades && (
          <p className={estilos.error} role="alert">
            {errores.necesidades}
          </p>
        )}
      </fieldset>

      {props.modo === 'crear' && (
        <div className={estilos.dosColumnas}>
          <CampoSeleccion
            etiqueta="Estado inicial"
            opciones={OPCIONES_ESTADO}
            value={datos.estado}
            onChange={(e) => cambiar('estado', e.target.value as DatosNuevaFuente['estado'])}
          />
          <CampoTexto
            etiqueta="Fecha de verificación"
            obligatorio
            ayuda="Cuándo se comprobó en la fuente original."
            type="date"
            max={hoyEnColombia()}
            value={datos.fechaVerificacion}
            onChange={(e) => cambiar('fechaVerificacion', e.target.value)}
            error={errores.fechaVerificacion || undefined}
          />
        </div>
      )}

      <CampoTexto
        etiqueta="Observaciones internas (opcional)"
        ayuda="Solo las ve el equipo de gestión; no se muestran al público."
        multilinea
        rows={2}
        maxLength={500}
        value={datos.observaciones}
        onChange={(e) => cambiar('observaciones', e.target.value)}
        error={errores.observaciones || undefined}
      />

      <label className={estilos.casilla}>
        <input
          type="checkbox"
          checked={datos.esDemo}
          onChange={(e) => cambiar('esDemo', e.target.checked)}
        />
        Dato de demostración: se muestra marcado como ficticio y sin enlaces activos.
      </label>

      <div className={comun.fila}>
        <Boton type="submit" cargando={guardando}>
          {props.modo === 'crear' ? 'Registrar fuente' : 'Guardar cambios'}
        </Boton>
      </div>
    </form>
  );
}
