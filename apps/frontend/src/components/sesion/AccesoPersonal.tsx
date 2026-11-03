'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso, Boton, CampoTexto, CargandoLista } from '@/components/ui';
import { mensajeDeError } from '@/lib/api/cliente';
import {
  CampoContrasena,
  CasillaRecordar,
  destinoInicial,
  rutaSegura,
  SesionYaAbierta,
} from './PiezasAcceso';
import { useSesion } from './ProveedorSesion';
import estilos from './Acceso.module.css';

/**
 * Acceso del equipo (/acceso/personal): correo y contraseña de una cuenta de moderación, de
 * gestión de fuentes o de administración. Abre la misma sesión que «Iniciar con mi
 * Avatar», pero sin nametag ni avatar.
 */
export function AccesoPersonal() {
  const { cargando, usuario, salir, entrarPersonal } = useSesion();
  const router = useRouter();
  const siguiente = rutaSegura(useSearchParams().get('siguiente'));
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [recordar, setRecordar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faltan, setFaltan] = useState<{ correo?: string; contrasena?: string }>({});

  if (cargando) return <CargandoLista filas={2} alto="6rem" etiqueta="Comprobando tu sesión…" />;

  if (usuario) {
    return (
      <SesionYaAbierta
        antetitulo="Acceso del equipo"
        usuario={usuario}
        destino={siguiente ?? destinoInicial(usuario)}
        alSalir={() => void salir('/acceso/personal')}
      />
    );
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando) return;
    const pendientes = {
      correo: correo.trim() ? undefined : 'Escribe tu correo.',
      contrasena: contrasena ? undefined : 'Escribe tu contraseña.',
    };
    setFaltan(pendientes);
    if (pendientes.correo || pendientes.contrasena) return;

    setEnviando(true);
    setError(null);
    try {
      const nuevo = await entrarPersonal({ correo: correo.trim(), contrasena, recordar });
      router.push(siguiente ?? destinoInicial(nuevo));
    } catch (e) {
      setError(mensajeDeError(e));
      setContrasena('');
      setEnviando(false);
    }
  }

  return (
    <div className={estilos.pagina}>
      <EncabezadoPagina antetitulo="Acceso del equipo" titulo="Entra con tu correo">
        Para las cuentas de moderación, gestión de fuentes y administración de la plataforma.
      </EncabezadoPagina>

      <form className={estilos.formularioCorto} onSubmit={enviar} noValidate>
        {error && <Aviso tono="peligro">{error}</Aviso>}
        <CampoTexto
          etiqueta="Correo"
          type="email"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          error={faltan.correo}
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
          ¿Eres joven?{' '}
          <Link
            className={estilos.enlaceTexto}
            href={`/acceso${siguiente ? `?siguiente=${encodeURIComponent(siguiente)}` : ''}`}
          >
            Entra con tu avatar
          </Link>
        </p>
        <p className={estilos.nota}>
          ¿Olvidaste tu contraseña o tu cuenta no está activa? Habla con quien administra la
          plataforma.
        </p>
      </form>
    </div>
  );
}
