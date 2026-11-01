'use client';

import { ArrowRight, Eye, EyeOff, LogOut } from 'lucide-react';
import { useState } from 'react';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Boton, BotonEnlace, CampoTexto } from '@/components/ui';
import type { SesionPublica } from '@/lib/api/sesion';
import estilos from './Acceso.module.css';

/*
 * Piezas comunes de los dos accesos: «Iniciar con mi Avatar» (/acceso) y el acceso del equipo con
 * correo (/acceso/personal).
 */

/** Solo rutas internas: evita redirecciones abiertas a otros sitios. */
export const rutaSegura = (ruta: string | null) =>
  ruta && ruta.startsWith('/') && !ruta.startsWith('//') ? ruta : null;

export function destinoInicial(usuario: SesionPublica): string {
  if (usuario.comunidad) return '/comunidad';
  if (usuario.permisos.includes('revisar_reportes')) return '/panel';
  if (usuario.permisos.includes('gestionar_fuentes')) return '/gestion/fuentes';
  return '/perfil';
}

/** Caso A de ambos accesos: ya hay sesión y se ofrece seguir o cerrarla, sin pedir credenciales. */
export function SesionYaAbierta({
  antetitulo,
  usuario,
  destino,
  alSalir,
}: {
  antetitulo: string;
  usuario: SesionPublica;
  destino: string;
  alSalir: () => void;
}) {
  return (
    <div className={estilos.pagina}>
      <EncabezadoPagina antetitulo={antetitulo} titulo={`¡Hola, ${usuario.alias}!`}>
        Tu sesión sigue abierta en este dispositivo.
      </EncabezadoPagina>
      <div className={estilos.tarjeta}>
        <p>
          Puedes seguir donde ibas. Si este dispositivo no es tuyo, cierra la sesión al terminar.
        </p>
        <div className={estilos.acciones}>
          <BotonEnlace href={destino} tamano="lg">
            Continuar
            <ArrowRight aria-hidden="true" size={18} />
          </BotonEnlace>
          <Boton variante="secundario" tamano="lg" onClick={alSalir}>
            <LogOut aria-hidden="true" size={18} />
            Cerrar sesión
          </Boton>
        </div>
      </div>
    </div>
  );
}

export function CampoContrasena({
  etiqueta,
  valor,
  alCambiar,
  error,
  ayuda,
  autoComplete,
  obligatorio,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  error?: string;
  ayuda?: string;
  autoComplete: 'current-password' | 'new-password';
  obligatorio?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={estilos.contrasena}>
      <CampoTexto
        etiqueta={etiqueta}
        type={visible ? 'text' : 'password'}
        name="password"
        autoComplete={autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        maxLength={128}
        obligatorio={obligatorio}
        ayuda={ayuda}
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        error={error}
      />
      <button
        type="button"
        className={estilos.mostrar}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}
        {visible ? 'Ocultar' : 'Mostrar'}
        <span className="visualmente-oculto"> contraseña</span>
      </button>
    </div>
  );
}

export function CasillaRecordar({
  marcada,
  alCambiar,
}: {
  marcada: boolean;
  alCambiar: (valor: boolean) => void;
}) {
  return (
    <label className={estilos.casilla}>
      <input type="checkbox" checked={marcada} onChange={(e) => alCambiar(e.target.checked)} />
      <span>
        Recordarme en este dispositivo
        <small>Tu sesión dura 30 días. No lo marques en un dispositivo compartido.</small>
      </span>
    </label>
  );
}
