import estilos from './Orientacion.module.css';

/**
 * Carga del explorador con su misma forma: el círculo de la ruleta y la tarjeta del edificio
 * con su rótulo. Ocupa el mismo sitio que el explorador, así que al llegar los temas nada salta.
 */
export function CargandoExplorador() {
  return (
    <div className={estilos.explorador} role="status" aria-live="polite">
      <span className="visualmente-oculto">Cargando temas…</span>
      <div className={estilos.zonaRuleta} aria-hidden="true">
        <span className={`esqueleto ${estilos.esqueletoRuleta}`} />
        <span className={`esqueleto ${estilos.esqueletoLinea}`} style={{ width: '70%' }} />
      </div>
      <div className={estilos.contenedorEdificio} aria-hidden="true">
        <div className={`${estilos.edificio} ${estilos.edificioCargando}`}>
          <span className={`esqueleto ${estilos.esqueletoEscena}`} />
          <span className={`esqueleto ${estilos.esqueletoLinea}`} style={{ width: '45%' }} />
          <span className={`esqueleto ${estilos.esqueletoLinea}`} style={{ width: '85%' }} />
        </div>
      </div>
    </div>
  );
}
