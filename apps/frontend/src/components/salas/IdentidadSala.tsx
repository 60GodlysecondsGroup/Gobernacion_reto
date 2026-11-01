import { Avatar } from '@/components/avatar/Avatar';
import type { ParticipanteEnSala } from '@/lib/api/salas';
import estilos from './Salas.module.css';

/** Identidad de quien está en la sala: avatar y alias siempre visibles, junto al nombre de la sala. */
export function IdentidadSala({ participante }: { participante: ParticipanteEnSala }) {
  return (
    <p className={estilos.identidadSala}>
      <span className={estilos.avatarSala}>
        <Avatar apariencia={participante.avatar} tamano={36} />
      </span>
      <span>
        <strong>{participante.alias}</strong>
        <span className={estilos.textoIdentidad}>Estás en la sala con tu alias y tu avatar</span>
      </span>
    </p>
  );
}
