import estilos from './Panel.module.css';

const formatoDia = new Intl.DateTimeFormat('es-CO', { day: 'numeric', timeZone: 'UTC' });
const formatoLargo = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

/**
 * Barras de bloqueos DLP por día, con datos reales del backend. Cada barra lleva su valor y una
 * descripción accesible; el gráfico tiene además una tabla equivalente para lectores de pantalla.
 */
export function GraficoPorDia({
  datos,
  etiqueta = 'Bloqueos',
}: {
  datos: { dia: string; total: number }[];
  etiqueta?: string;
}) {
  const maximo = Math.max(1, ...datos.map((d) => d.total));
  const fecha = (dia: string) => new Date(`${dia}T00:00:00Z`);
  return (
    <figure
      className={`${estilos.grafico} ${maximo === 1 && datos.every((d) => d.total === 0) ? estilos.graficoVacio : ''}`}
      style={{ margin: 0 }}
    >
      {datos.every((d) => d.total === 0) && (
        <p className={estilos.mensajeVacio}>Sin {etiqueta.toLowerCase()} en estos días.</p>
      )}
      <div className={estilos.barras} aria-hidden="true">
        {datos.map(({ dia, total }) => (
          <div
            key={dia}
            className={estilos.columna}
            title={`${formatoLargo.format(fecha(dia))}: ${total}`}
          >
            {total > 0 && <span className={estilos.valorBarra}>{total}</span>}
            <div
              className={`${estilos.barra} ${total === 0 ? estilos.barraVacia : ''}`}
              style={{ height: `${(total / maximo) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className={estilos.ejeX} aria-hidden="true">
        {datos.map(({ dia }, i) => (
          <span key={dia}>
            {datos.length <= 14 || i % Math.ceil(datos.length / 10) === 0
              ? formatoDia.format(fecha(dia))
              : ''}
          </span>
        ))}
      </div>
      <table className="visualmente-oculto">
        <caption>{etiqueta} por día</caption>
        <tbody>
          {datos.map(({ dia, total }) => (
            <tr key={dia}>
              <th scope="row">{formatoLargo.format(fecha(dia))}</th>
              <td>{total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
