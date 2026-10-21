import { Insignia } from '@/components/ui';
import type { SalaResumen } from '@/lib/api/salas';

/** Ocupación «n/10» con su estado en texto (no solo en color). */
export function OcupacionSala({
  sala,
}: {
  sala: Pick<SalaResumen, 'ocupacion' | 'capacidad' | 'estado'>;
}) {
  const cifra = `${sala.ocupacion}/${sala.capacidad}`;
  if (sala.estado === 'llena') return <Insignia tono="peligro">Llena · {cifra}</Insignia>;
  if (sala.ocupacion === 0) return <Insignia>Sin personas · {cifra}</Insignia>;
  return <Insignia tono="exito">Con cupo · {cifra}</Insignia>;
}
