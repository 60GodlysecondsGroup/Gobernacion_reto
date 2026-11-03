'use client';

import { ArrowRight } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso, Boton, CampoTexto, CargandoLista } from '@/components/ui';
import { mensajeDeError } from '@/lib/api/cliente';
import type { SesionPublica } from '@/lib/api/sesion';
import {
  CampoContrasena,
  CasillaRecordar,
  destinoInicial,
  rutaSegura,
  SesionYaAbierta,
} from './PiezasAcceso';
import { useSesion } from './ProveedorSesion';
import { FormularioRegistro } from './Registro';
import estilos from './Acceso.module.css';

type Modo = 'entrar' | 'registro';

/**
 * «Iniciar con mi Avatar»: una sola pantalla para entrar con una cuenta existente o crear una
 * nueva. Abre siempre en «Iniciar sesión» (salvo un enlace con `?modo=registro`); crear la cuenta
 * es la alternativa a un toque. Con sesión activa, ofrece continuar sin pedir nada. El acceso
 * del equipo (/acceso/personal) no se anuncia aquí: quien lo usa conoce su ruta.
 */
export function Acceso() {
  const { cargando, usuario, salir } = useSesion();
  const router = useRouter();
  const parametros = useSearchParams();
  const siguiente = rutaSegura(parametros.get('siguiente'));
  const [modo, setModo] = useState<Modo>(
    parametros.get('modo') === 'registro' ? 'registro' : 'entrar',
  );
  // El registro se monta la primera vez que se abre y después solo se oculta: ir a «Iniciar
  // sesión» y volver no borra lo que ya se escribió ni el personaje armado.
  const [registroAbierto, setRegistroAbierto] = useState(modo === 'registro');
  const idPestanas = useId();

  function cambiarModo(nuevo: Modo) {
    setModo(nuevo);
    if (nuevo === 'registro') setRegistroAbierto(true);
  }

  function alEntrar(nuevo: SesionPublica) {
    router.push(siguiente ?? destinoInicial(nuevo));
  }

  if (cargando) {
    return <CargandoLista filas={2} alto="6rem" etiqueta="Comprobando tu sesión…" />;
  }

  // Caso A: ya hay sesión. No se piden credenciales de nuevo.
  if (usuario) {
    return (
      <SesionYaAbierta
        antetitulo="Iniciar con mi Avatar"
        usuario={usuario}
        destino={siguiente ?? destinoInicial(usuario)}
        alSalir={() => void salir('/acceso')}
      />
    );
  }

  const pestanas: { modo: Modo; texto: string }[] = [
    { modo: 'entrar', texto: 'Iniciar sesión' },
    { modo: 'registro', texto: 'Crear cuenta' },
  ];

  return (
    <div className={estilos.pagina} data-modo={modo}>
      <EncabezadoPagina
        antetitulo="Iniciar con mi Avatar"
        titulo={modo === 'registro' ? 'Crea tu avatar y entra' : 'Entra con tu avatar'}
      >
        {/* En el registro, el progreso y cada etapa ya explican qué falta. */}
        {modo === 'entrar' && 'Escribe tu nametag y tu contraseña.'}
      </EncabezadoPagina>

      <div
        className={estilos.pestanas}
        role="tablist"
        aria-label="¿Ya tienes cuenta?"
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          const otro = modo === 'entrar' ? 'registro' : 'entrar';
          cambiarModo(otro);
          document.getElementById(`${idPestanas}-${otro}`)?.focus();
        }}
      >
        {pestanas.map((p) => (
          <button
            key={p.modo}
            id={`${idPestanas}-${p.modo}`}
            type="button"
            role="tab"
            aria-selected={modo === p.modo}
            aria-controls={`${idPestanas}-panel-${p.modo}`}
            tabIndex={modo === p.modo ? 0 : -1}
            className={estilos.pestana}
            onClick={() => cambiarModo(p.modo)}
          >
            {p.texto}
          </button>
        ))}
      </div>

      <div
        id={`${idPestanas}-panel-entrar`}
        role="tabpanel"
        aria-labelledby={`${idPestanas}-entrar`}
        className={estilos.panelEntrar}
        hidden={modo !== 'entrar'}
      >
        <FormularioEntrar alEntrar={alEntrar} alCrearCuenta={() => cambiarModo('registro')} />
      </div>
      <div
        id={`${idPestanas}-panel-registro`}
        role="tabpanel"
        aria-labelledby={`${idPestanas}-registro`}
        className={estilos.panelRegistro}
        hidden={modo !== 'registro'}
      >
        {registroAbierto && (
          <FormularioRegistro alEntrar={alEntrar} alTenerCuenta={() => cambiarModo('entrar')} />
        )}
      </div>
    </div>
  );
}

// ─── Caso B: cuenta existente ────────────────────────────────────────────────

function FormularioEntrar({
  alEntrar,
  alCrearCuenta,
}: {
  alEntrar: (usuario: SesionPublica) => void;
  alCrearCuenta: () => void;
}) {
  const { entrar } = useSesion();
  const [alias, setAlias] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [recordar, setRecordar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faltan, setFaltan] = useState<{ alias?: string; contrasena?: string }>({});

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando) return;
    const pendientes = {
      alias: alias.trim() ? undefined : 'Escribe tu nametag.',
      contrasena: contrasena ? undefined : 'Escribe tu contraseña.',
    };
    setFaltan(pendientes);
    if (pendientes.alias || pendientes.contrasena) return;

    setEnviando(true);
    setError(null);
    try {
      alEntrar(await entrar({ alias: alias.trim(), contrasena, recordar }));
    } catch (e) {
      setError(mensajeDeError(e));
      setContrasena('');
      setEnviando(false);
    }
  }

  return (
    <form className={estilos.formularioCorto} onSubmit={enviar} noValidate>
      {error && <Aviso tono="peligro">{error}</Aviso>}
      <CampoTexto
        etiqueta="Nametag"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={60}
        value={alias}
        onChange={(e) => setAlias(e.target.value)}
        error={faltan.alias}
      />
      <CampoContrasena
        etiqueta="Contraseña"
        autoComplete="current-password"
        valor={contrasena}
        alCambiar={setContrasena}
        error={faltan.contrasena}
      />
      <CasillaRecordar marcada={recordar} alCambiar={setRecordar} />
      <Boton type="submit" tamano="lg" cargando={enviando} className={estilos.enviar}>
        Entrar
        <ArrowRight aria-hidden="true" size={18} />
      </Boton>
      <p className={estilos.alterno}>
        ¿Primera vez aquí?{' '}
        <button type="button" className={estilos.enlaceTexto} onClick={alCrearCuenta}>
          Crea tu avatar
        </button>
      </p>
      <p className={estilos.nota}>
        ¿Olvidaste tu contraseña? Como no pedimos correo ni teléfono, no se puede recuperar en
        línea: pide ayuda a quien administra la plataforma.
      </p>
    </form>
  );
}
