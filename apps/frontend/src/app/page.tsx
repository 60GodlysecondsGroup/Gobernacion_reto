import { EstadoSistema } from '@/components/sistema/EstadoSistema';
import estilos from './page.module.css';

export default function Inicio() {
  return (
    <div className={estilos.pagina}>
      <section className={estilos.presentacion} aria-labelledby="titulo-inicio">
        <p className={estilos.antetitulo}>Prototipo · Fase 1: entorno técnico</p>
        <h1 id="titulo-inicio" className={estilos.titulo}>
          Orientación y comunidad protegida para jóvenes de Villavicencio
        </h1>
        <p className={estilos.entradilla}>
          Información institucional con fuente y fecha de verificación, y comunidades separadas por
          rango de edad. Esta versión deja lista la base técnica; las funciones se agregan por
          fases.
        </p>
      </section>

      <EstadoSistema />
    </div>
  );
}
