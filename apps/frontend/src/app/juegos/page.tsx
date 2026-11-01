import { redirect } from 'next/navigation';

/**
 * Los minijuegos viven dentro de las salas (cada sala tiene su rincón de actividades). Esta ruta
 * se conserva para que los enlaces antiguos no fallen y lleva a las salas.
 */
export default function PaginaJuegos() {
  redirect('/salas');
}
