'use client';

import { useState, type FormEvent } from 'react';
import { Boton, CampoTexto, Insignia } from '@/components/ui';
import estilos from './page.module.css';

const esAliasValido = (alias: string) => alias.trim().length >= 3 && alias.trim().length <= 30;

export function DemostracionFormulario() {
  const [alias, setAlias] = useState('');
  const [intentado, setIntentado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [validado, setValidado] = useState(false);

  const error =
    intentado && !esAliasValido(alias) ? 'El alias debe tener entre 3 y 30 caracteres.' : undefined;

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setIntentado(true);
    setValidado(false);
    if (!esAliasValido(alias)) return;
    setCargando(true);
    setTimeout(() => {
      setCargando(false);
      setValidado(true);
    }, 800);
  }

  function limpiar() {
    setAlias('');
    setIntentado(false);
    setValidado(false);
  }

  return (
    <form className={estilos.formulario} onSubmit={alEnviar} noValidate>
      <CampoTexto
        etiqueta="Alias de ejemplo"
        ayuda="Entre 3 y 30 caracteres. Solo de muestra."
        value={alias}
        onChange={(evento) => {
          setAlias(evento.target.value);
          setValidado(false);
        }}
        error={error}
        autoComplete="off"
      />
      <CampoTexto
        etiqueta="Texto largo"
        ayuda="Variante multilínea, pensada para hilos y respuestas."
        multilinea
        rows={3}
      />
      <div className={estilos.fila}>
        <Boton type="submit" cargando={cargando}>
          Validar
        </Boton>
        <Boton variante="secundario" onClick={limpiar}>
          Limpiar
        </Boton>
        <Boton variante="fantasma" onClick={() => setAlias('LunaDemo')}>
          Usar «LunaDemo»
        </Boton>
        <Boton disabled>Deshabilitado</Boton>
      </div>
      <p aria-live="polite">
        {validado && <Insignia tono="exito">Alias válido (no se guarda)</Insignia>}
      </p>
    </form>
  );
}
