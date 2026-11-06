'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Aviso, Boton, BotonEnlace, CampoSeleccion, CampoTexto } from '@/components/ui';
import { TIPOS_CANAL, type TipoCanal } from '@/config/fuentes';
import { erroresPorCampo, mensajeDeError } from '@/lib/api/cliente';
import type { DatosFuente, DatosNuevaFuente, FuenteGestion } from '@/lib/api/fuentes';
import { obtenerNecesidades, type Necesidad } from '@/lib/api/orientacion';
import { hoyEnColombia } from '@/lib/fechas';
import { pideEnlace, pideTelefono, validarFuente } from '@/lib/fuentes-validacion';
import {
  borradorDesde,
  borradorVacio,
  horarioDesde,
  validarHorario,
  type BorradorHorario,
} from '@/lib/horarios';
import comun from '../comun.module.css';
import estilos from './Fuentes.module.css';
import { SeccionFormulario } from './SeccionFormulario';
import { SelectorHorario } from './SelectorHorario';
import { SelectorUbicacion } from './SelectorUbicacion';

type Props =
  | { modo: 'crear'; alGuardar: (datos: DatosNuevaFuente) => Promise<void> }
  | {
      modo: 'editar';
      fuente: FuenteGestion;
      alGuardar: (datos: DatosFuente) => Promise<void>;
      /** Confirmación del último guardado (el formulario se reinicia con los datos nuevos). */
      confirmacion?: string;
    };

const OPCIONES_CANAL = Object.entries(TIPOS_CANAL).map(([valor, etiqueta]) => ({
  valor,
  etiqueta,
}));
const OPCIONES_ESTADO = [
  { valor: 'activo', etiqueta: 'Activo: verificada y vigente' },
  { valor: 'requiere_revision', etiqueta: 'Requiere revisión: falta comprobarla' },
];

/** Qué pide cada tipo de canal, dicho junto al selector. */
const AYUDA_CANAL: Record<TipoCanal, string> = {
  telefono: 'Pide un teléfono; el enlace es opcional.',
  web: 'Pide un enlace oficial; el teléfono es opcional.',
  chat: 'Pide un enlace oficial; el teléfono es opcional.',
  presencial: 'Teléfono y enlace son opcionales.',
  otro: 'Teléfono y enlace son opcionales.',
};

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
      // `?? ''`: también si la API aún no envía el campo (base sin la migración 0014).
      whatsapp: f.whatsapp ?? '',
      horario: f.horario ?? '',
      horarioSemanal: f.horarioSemanal,
      direccion: f.direccion ?? '',
      ubicacion: f.ubicacion,
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
    whatsapp: '',
    horario: '',
    horarioSemanal: null,
    direccion: '',
    ubicacion: null,
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
  whatsapp: datos.whatsapp,
  horario: datos.horario,
  horarioSemanal: datos.horarioSemanal,
  direccion: datos.direccion,
  ubicacion: datos.ubicacion,
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

type CampoTextoFuente =
  | 'institucion'
  | 'servicio'
  | 'descripcion'
  | 'telefono'
  | 'enlace'
  | 'whatsapp'
  | 'direccion'
  | 'fuenteOriginal'
  | 'observaciones'
  | 'fechaVerificacion';

/**
 * Datos de una fuente (F32), el mismo formulario para registrar y para editar. Los campos van
 * en secciones según su propósito y se validan mientras se escriben con las reglas del backend.
 * Ninguna fuente nueva se registra sin fecha de verificación (B.6).
 */
export function FormularioFuente(props: Props) {
  const [original] = useState(() => ({ datos: inicial(props), horario: horarioInicial(props) }));
  const [datos, setDatos] = useState<DatosNuevaFuente>(original.datos);
  const [horario, setHorario] = useState<BorradorHorario | null>(original.horario);
  const [catalogo, setCatalogo] = useState<Necesidad[] | null>(null);
  const [errorCatalogo, setErrorCatalogo] = useState(false);
  const [intentoCatalogo, setIntentoCatalogo] = useState(0);
  // Un campo muestra su error al salir de él (o al intentar guardar), no a la primera tecla.
  const [tocados, setTocados] = useState<Partial<Record<string, boolean>>>({});
  const [intentado, setIntentado] = useState(false);
  const [erroresServidor, setErroresServidor] = useState<Record<string, string>>({});
  const [mensaje, setMensaje] = useState<{ tono: 'exito' | 'peligro'; texto: string } | null>(
    props.modo === 'editar' && props.confirmacion
      ? { tono: 'exito', texto: props.confirmacion }
      : null,
  );
  const [guardando, setGuardando] = useState(false);
  // Evita un segundo envío antes de que el estado «guardando» llegue a la pantalla.
  const enviando = useRef(false);
  const formulario = useRef<HTMLFormElement>(null);
  const [enfocarError, setEnfocarError] = useState(0);

  useEffect(() => {
    let vigente = true;
    obtenerNecesidades()
      .then((r) => vigente && setCatalogo(r.necesidades))
      .catch(() => vigente && setErrorCatalogo(true));
    return () => {
      vigente = false;
    };
  }, [intentoCatalogo]);

  // Tras un intento fallido, el foco va al primer campo con error.
  useEffect(() => {
    if (enfocarError === 0) return;
    formulario.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [enfocarError]);

  const crear = props.modo === 'crear';
  const hoy = hoyEnColombia();
  const erroresCliente = validarFuente(
    { ...datos, fechaVerificacion: crear ? datos.fechaVerificacion : undefined },
    hoy,
  );
  const erroresHorario = horario ? validarHorario(horario, { exigirCompletos: intentado }) : {};
  const errorDe = (campo: string) =>
    erroresServidor[campo] ||
    (intentado || tocados[campo]
      ? erroresCliente[campo as keyof typeof erroresCliente]
      : undefined) ||
    undefined;

  const sucio = JSON.stringify({ datos, horario }) !== JSON.stringify(original);

  const cambiar = <K extends keyof DatosNuevaFuente>(campo: K, valor: DatosNuevaFuente[K]) => {
    setDatos((actual) => ({ ...actual, [campo]: valor }));
    setErroresServidor((actual) => ({ ...actual, [campo]: '' }));
    setMensaje(null);
  };
  const tocar = (campo: string) => setTocados((actual) => ({ ...actual, [campo]: true }));

  const alternarNecesidad = (codigo: string) => {
    tocar('necesidades');
    cambiar(
      'necesidades',
      datos.necesidades.includes(codigo)
        ? datos.necesidades.filter((c) => c !== codigo)
        : [...datos.necesidades, codigo],
    );
  };

  const cambiarHorario = (borrador: BorradorHorario | null) => {
    setHorario(borrador);
    setErroresServidor((actual) => ({ ...actual, horarioSemanal: '', horario: '' }));
    setMensaje(null);
  };

  const descartar = () => {
    setDatos(original.datos);
    setHorario(original.horario);
    setTocados({});
    setIntentado(false);
    setErroresServidor({});
    setMensaje(null);
  };

  async function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando.current) return;
    setIntentado(true);
    const pendientes =
      Object.keys(erroresCliente).length +
      (horario ? Object.keys(validarHorario(horario, { exigirCompletos: true })).length : 0);
    if (pendientes > 0) {
      setMensaje({
        tono: 'peligro',
        texto:
          pendientes === 1
            ? 'Revisa el campo marcado para continuar.'
            : `Revisa los ${pendientes} campos marcados para continuar.`,
      });
      setEnfocarError((n) => n + 1);
      return;
    }
    // Con horario semanal, el backend escribe el texto; sin él, se conserva el texto anterior.
    const conHorario: DatosNuevaFuente = horario
      ? { ...datos, horario: '', horarioSemanal: horarioDesde(horario) }
      : { ...datos, horarioSemanal: null };
    enviando.current = true;
    setGuardando(true);
    setErroresServidor({});
    setMensaje(null);
    try {
      if (crear) await props.alGuardar(conHorario);
      else await props.alGuardar(aEdicion(conHorario));
      // Al crear se navega a la ficha nueva: el botón sigue deshabilitado hasta salir.
      if (!crear) {
        enviando.current = false;
        setGuardando(false);
      }
    } catch (e) {
      // Los datos escritos se conservan: solo se marcan los errores.
      setErroresServidor(erroresPorCampo(e));
      setMensaje({ tono: 'peligro', texto: mensajeDeError(e) });
      setEnfocarError((n) => n + 1);
      enviando.current = false;
      setGuardando(false);
    }
  }

  const campo = (nombre: CampoTextoFuente) => ({
    value: datos[nombre],
    onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) =>
      cambiar(nombre, e.target.value),
    onBlur: () => tocar(nombre),
    error: errorDe(nombre),
  });

  const idErrorTemas = 'fuente-error-temas';
  const errorTemas = errorDe('necesidades');

  return (
    <form ref={formulario} className={estilos.formularioFuente} onSubmit={alEnviar} noValidate>
      {mensaje?.tono === 'exito' && <Aviso tono="exito">{mensaje.texto}</Aviso>}

      <SeccionFormulario
        numero={1}
        titulo="Información general"
        descripcion="Quién ofrece el servicio y qué ofrece, con las palabras de la fuente oficial."
      >
        <div className={estilos.dosColumnas}>
          <CampoTexto
            etiqueta="Institución responsable"
            obligatorio
            maxLength={120}
            autoComplete="off"
            {...campo('institucion')}
          />
          <CampoTexto
            etiqueta="Servicio o canal"
            obligatorio
            maxLength={120}
            autoComplete="off"
            {...campo('servicio')}
          />
        </div>
        <CampoTexto
          etiqueta="Descripción"
          obligatorio
          ayuda="Al menos 10 caracteres. Sin diagnósticos ni recomendaciones clínicas."
          multilinea
          rows={3}
          maxLength={1000}
          {...campo('descripcion')}
        />
      </SeccionFormulario>

      <SeccionFormulario
        numero={2}
        titulo="Canal de contacto"
        descripcion="Cómo se comunica la persona con el servicio."
      >
        <div className={estilos.tresColumnas}>
          <CampoSeleccion
            etiqueta="Tipo de canal"
            obligatorio
            ayuda={AYUDA_CANAL[datos.tipoCanal]}
            opciones={OPCIONES_CANAL}
            value={datos.tipoCanal}
            onChange={(e) => cambiar('tipoCanal', e.target.value as TipoCanal)}
            error={errorDe('tipoCanal')}
          />
          <CampoTexto
            etiqueta="Teléfono"
            obligatorio={pideTelefono(datos.tipoCanal)}
            ayuda="Números, espacios, +, paréntesis o guiones."
            type="tel"
            inputMode="tel"
            autoComplete="off"
            {...campo('telefono')}
          />
          <CampoTexto
            etiqueta="Enlace oficial"
            obligatorio={pideEnlace(datos.tipoCanal)}
            ayuda="Empieza por https:// (o http://)."
            type="url"
            inputMode="url"
            placeholder="https://"
            autoComplete="off"
            {...campo('enlace')}
          />
        </div>
        <div className={estilos.dosColumnas}>
          <CampoTexto
            etiqueta="Número de WhatsApp (opcional)"
            ayuda="Celular con indicativo internacional, p. ej. +57 300 123 4567. La ficha muestra «Contactar vía WhatsApp»."
            type="tel"
            inputMode="tel"
            placeholder="+57 300 123 4567"
            maxLength={30}
            autoComplete="off"
            {...campo('whatsapp')}
          />
        </div>
      </SeccionFormulario>

      <SeccionFormulario
        numero={3}
        titulo="Dirección y ubicación"
        descripcion={
          datos.tipoCanal === 'presencial'
            ? 'Recomendado en la atención presencial: la ficha muestra un mapa pequeño y «Cómo llegar» con Google Maps.'
            : 'Opcional. Agrégala si además se atiende en una sede física (atención híbrida); los canales virtuales se conservan.'
        }
      >
        <CampoTexto
          etiqueta="Dirección escrita (opcional)"
          ayuda="Como la indica la fuente oficial, con piso u oficina si aplica. Se muestra aunque no haya ubicación en el mapa."
          maxLength={200}
          autoComplete="off"
          {...campo('direccion')}
        />
        <div className={estilos.grupo} role="group" aria-labelledby="fuente-titulo-ubicacion">
          <p id="fuente-titulo-ubicacion" className={estilos.leyenda}>
            Ubicación en el mapa <span className={estilos.notaLeyenda}>Opcional</span>
          </p>
          <SelectorUbicacion
            ubicacion={datos.ubicacion}
            alCambiar={(ubicacion) => cambiar('ubicacion', ubicacion)}
            error={errorDe('ubicacion')}
            lugar={datos.servicio.trim() || 'esta fuente'}
          />
        </div>
      </SeccionFormulario>

      <SeccionFormulario
        numero={4}
        titulo="Disponibilidad"
        descripcion="Días y horas de atención. Puedes dejarlo sin configurar si la fuente no lo indica."
      >
        <SelectorHorario
          borrador={horario}
          alCambiar={cambiarHorario}
          errores={erroresHorario}
          textoAnterior={
            props.modo === 'editar' && !props.fuente.horarioSemanal ? datos.horario : null
          }
          errorServidor={errorDe('horarioSemanal') || errorDe('horario')}
        />
      </SeccionFormulario>

      <SeccionFormulario
        numero={5}
        titulo={crear ? 'Origen, temas y verificación' : 'Origen y temas'}
        descripcion={
          crear
            ? 'De dónde sale la información, dónde aparece en Orientación y cuándo se comprobó.'
            : 'De dónde sale la información y dónde aparece en Orientación. El estado y la verificación se cambian arriba, con sus acciones.'
        }
      >
        <CampoTexto
          etiqueta="Fuente original"
          obligatorio
          ayuda="Sitio o documento oficial de donde sale esta información."
          maxLength={300}
          {...campo('fuenteOriginal')}
        />

        <fieldset
          className={estilos.grupo}
          aria-describedby={errorTemas ? idErrorTemas : undefined}
        >
          <legend className={estilos.leyenda}>
            Temas de orientación donde aparece{' '}
            <span className={estilos.notaLeyenda}>Obligatorio · elige al menos uno</span>
          </legend>
          {errorCatalogo ? (
            <div className={comun.fila}>
              <p className={estilos.error} role="alert">
                No se pudieron cargar los temas.
              </p>
              <Boton
                variante="secundario"
                tamano="sm"
                onClick={() => {
                  setErrorCatalogo(false);
                  setIntentoCatalogo((n) => n + 1);
                }}
              >
                Reintentar
              </Boton>
            </div>
          ) : !catalogo ? (
            <p className={comun.suave}>Cargando temas…</p>
          ) : (
            <div className={estilos.casillas}>
              {catalogo.map((necesidad) => (
                <label key={necesidad.codigo} className={estilos.casilla}>
                  <input
                    type="checkbox"
                    checked={datos.necesidades.includes(necesidad.codigo)}
                    onChange={() => alternarNecesidad(necesidad.codigo)}
                    aria-invalid={errorTemas ? true : undefined}
                  />
                  {necesidad.nombre}
                </label>
              ))}
            </div>
          )}
          {errorTemas && (
            <p id={idErrorTemas} className={estilos.error} role="alert">
              {errorTemas}
            </p>
          )}
        </fieldset>

        {crear && (
          <div className={estilos.dosColumnas}>
            <CampoSeleccion
              etiqueta="Estado inicial"
              obligatorio
              opciones={OPCIONES_ESTADO}
              value={datos.estado}
              onChange={(e) => cambiar('estado', e.target.value as DatosNuevaFuente['estado'])}
            />
            <CampoTexto
              etiqueta="Fecha de verificación"
              obligatorio
              ayuda="Cuándo se comprobó en la fuente original. No puede ser futura."
              type="date"
              max={hoy}
              {...campo('fechaVerificacion')}
            />
          </div>
        )}
      </SeccionFormulario>

      <SeccionFormulario numero={6} titulo="Configuración adicional">
        <CampoTexto
          etiqueta="Observaciones internas (opcional)"
          ayuda="Solo las ve el equipo de gestión; no se muestran al público."
          multilinea
          rows={2}
          maxLength={500}
          {...campo('observaciones')}
        />
        <label className={estilos.casilla}>
          <input
            type="checkbox"
            checked={datos.esDemo}
            onChange={(e) => cambiar('esDemo', e.target.checked)}
          />
          Dato de demostración: se muestra marcado como ficticio y sin enlaces activos.
        </label>
      </SeccionFormulario>

      <div className={estilos.pieFormulario}>
        {mensaje?.tono === 'peligro' && <Aviso tono="peligro">{mensaje.texto}</Aviso>}
        <div className={comun.fila}>
          <Boton type="submit" cargando={guardando} disabled={!crear && !sucio}>
            {crear
              ? guardando
                ? 'Registrando…'
                : 'Registrar fuente'
              : guardando
                ? 'Guardando…'
                : 'Guardar cambios'}
          </Boton>
          {crear ? (
            <BotonEnlace href="/gestion/fuentes" variante="fantasma">
              Cancelar
            </BotonEnlace>
          ) : (
            sucio && (
              <Boton variante="fantasma" onClick={descartar} disabled={guardando}>
                Descartar cambios
              </Boton>
            )
          )}
          <span className={comun.suave} aria-live="polite">
            {crear
              ? 'Los campos marcados «Obligatorio» son necesarios para registrar.'
              : sucio
                ? 'Tienes cambios sin guardar.'
                : 'Sin cambios por guardar.'}
          </span>
        </div>
      </div>
    </form>
  );
}
