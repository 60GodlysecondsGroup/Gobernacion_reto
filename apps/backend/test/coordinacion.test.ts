import {
  crearCoordinacionMemoria,
  crearMemoriaCompartida,
} from '../src/modules/salas/salas.coordinacion.js';
import { contratoCoordinacion } from './coordinacion.contrato.js';

contratoCoordinacion('memoria', async (presenciaMs) => {
  const memoria = crearMemoriaCompartida();
  const uno = crearCoordinacionMemoria({ presenciaMs, memoria });
  const dos = crearCoordinacionMemoria({ presenciaMs, memoria });
  return {
    uno,
    dos,
    cerrar: async () => {
      await Promise.all([uno.cerrar(), dos.cerrar()]);
    },
  };
});
